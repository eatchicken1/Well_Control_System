import type { Alert, BackendLevel, FlowDataPoint } from '../context/WellControlContext';
import { operatorEventPresentation } from './operatorEventPresentation';
import { parseSourceDateMs } from './sourceTime';

export type MonitoringEventKind = 'observation' | 'alarm';
/**
 * Mirrors the backend SafetyIncidentState lifecycle contract
 * (Watch/Open/Hold/Recovery/Resolved/ClosedUnresolved/Normal) projected into
 * operator-facing statuses. Never re-derive these by heuristics: `hold`
 * means the backend switched interpretation frameworks (telemetry gap /
 * hydraulic boundary / pump-rate change) while RETAINING incident identity,
 * and `watching` is the backend Watch state - not merely "level == 1".
 */
export type MonitoringLifecycleStatus =
  | 'active'
  | 'watching'
  | 'hold'
  | 'recovering'
  | 'ended'
  | 'closedUnresolved';
export type MonitoringAckStatus = 'not-required' | 'unacknowledged' | 'acknowledged';

export interface MonitoringEventStreamItem {
  id: string;
  kind: MonitoringEventKind;
  level: BackendLevel;
  currentLevel: BackendLevel;
  peakLevel: BackendLevel;
  startTime: string;
  endTime: string;
  lastTime: string;
  message: string;
  description?: string;
  lifecycleStatus: MonitoringLifecycleStatus;
  ackStatus: MonitoringAckStatus;
  duration: number;
  sampleCount: number;
  backendEventId?: string;
  activeSignals?: string[];
  isActive: boolean;
  sortTimestamp?: number;
  sourceAlertId?: number;
}

export type MonitoringEventFilter = 'all' | 'alarms' | 'unacknowledged';
export type MonitoringEventVisualTone = 'neutral' | 'amber' | 'orange' | 'red';

// A single L1 frame is an observation, not an operator event. Requiring the
// smallest two-frame span removes one-frame spikes while leaving the backend
// incident engine as the sole source of formal L2+ events.
const MIN_L1_OBSERVATION_SAMPLES = 2;

interface TimedPoint {
  value: FlowDataPoint;
  index: number;
  timestamp: number;
}

function safeLevel(value: unknown): BackendLevel {
  const level = Math.round(Number(value));
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

function parseTimestamp(date: string | undefined, time: string | undefined, fallback = Number.NaN) {
  const rawTime = String(time || '').trim();
  if (!rawTime) return fallback;
  const direct = parseSourceDateMs(rawTime);
  if (direct !== null) return direct;
  const rawDate = String(date || '').trim().replaceAll('/', '-');
  const combined = rawDate ? parseSourceDateMs(`${rawDate} ${rawTime}`) : null;
  return combined ?? fallback;
}

function pointTimestamp(point: FlowDataPoint, index: number) {
  if (Number.isFinite(point.timestampMs)) return Number(point.timestampMs);
  return parseTimestamp(undefined, point.time, index);
}

function durationMs(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

function lifecycle(value: string | undefined, currentLevel: BackendLevel): MonitoringLifecycleStatus {
  const normalized = String(value || '').trim().toLowerCase();
  // Backend SafetyIncidentState values are matched explicitly (lowercased):
  // resolved, closedunresolved are terminal; hold keeps the incident alive
  // with interpretation frozen; watch is the advisory-only observation state.
  if (normalized === 'closedunresolved') return 'closedUnresolved';
  if (['resolved', 'closed', 'ended', 'complete', 'completed'].includes(normalized)) return 'ended';
  if (['recovering', 'recovered', 'recovery', 'cooldown', 'cooling'].includes(normalized)) return 'recovering';
  if (normalized === 'hold') return 'hold';
  if (normalized === 'watch') return 'watching';
  if (normalized === 'open') return 'active';
  return currentLevel >= 2 ? 'active' : 'ended';
}

function ackStatus(alert: Alert): MonitoringAckStatus {
  const normalized = String(alert.ackStatus || '').trim().toLowerCase();
  if (alert.acknowledged || ['acknowledged', 'acked', 'confirmed'].includes(normalized)) return 'acknowledged';
  return 'unacknowledged';
}

function alertStartTimestamp(alert: Alert, fallback: number) {
  return parseTimestamp(alert.date, alert.time, fallback);
}

function alertLastTimestamp(alert: Alert, fallback: number) {
  return parseTimestamp(alert.lastDate || alert.date, alert.lastTime || alert.time, fallback);
}

function dateTimeLabel(date: string | undefined, time: string | undefined) {
  return date ? `${date} ${time || ''}`.trim() : String(time || '');
}

/**
 * Projects consecutive backend L1 frames into observation spans. A non-L1 frame
 * or a backend event-id change closes the span; no new detection threshold is introduced.
 */
export function projectL1ObservationWindows(flowHistory: FlowDataPoint[]): MonitoringEventStreamItem[] {
  const ordered: TimedPoint[] = flowHistory
    .map((value, index) => ({ value, index, timestamp: pointTimestamp(value, index) }))
    .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
  const projected: MonitoringEventStreamItem[] = [];
  let current: {
    eventId?: string;
    startTime: string;
    lastTime: string;
    startTimestamp: number;
    lastTimestamp: number;
    sampleCount: number;
    message: string;
    description?: string;
  } | null = null;

  const close = (isActive: boolean) => {
    if (!current) return;
    if (current.sampleCount < MIN_L1_OBSERVATION_SAMPLES) {
      current = null;
      return;
    }
    const suffix = `${current.eventId || 'local'}-${current.startTimestamp}-${projected.length}`;
    projected.push({
      id: `observation-${suffix}`,
      kind: 'observation',
      level: 1,
      currentLevel: isActive ? 1 : 0,
      peakLevel: 1,
      // The first source frame is the canonical start. It is never replaced
      // by a later refresh; only lastTime/endTime advances with the span.
      startTime: current.startTime,
      endTime: current.lastTime,
      lastTime: current.lastTime,
      message: current.message,
      description: current.description,
      lifecycleStatus: isActive ? 'active' : 'ended',
      ackStatus: 'not-required',
      duration: durationMs(current.startTimestamp, current.lastTimestamp),
      sampleCount: current.sampleCount,
      backendEventId: current.eventId,
      isActive,
      sortTimestamp: current.startTimestamp,
    });
    current = null;
  };

  ordered.forEach(({ value, timestamp }, orderedIndex) => {
    const isL1 = safeLevel(value.backendLevel) === 1;
    const eventId = String(value.eventId || '').trim() || undefined;
    const eventChanged = Boolean(current && current.eventId && eventId && current.eventId !== eventId);
    if (!isL1 || eventChanged) close(false);
    if (!isL1) return;

    if (!current) {
      const presentation = operatorEventPresentation({
        publicLevel: 1,
        eventTitle: value.eventTitle,
        physicalDescription: value.eventDescription,
        abnormalParameters: value.abnormalParameters,
      }, 1);
      current = {
        eventId,
        startTime: value.time,
        lastTime: value.time,
        startTimestamp: timestamp,
        lastTimestamp: timestamp,
        sampleCount: 1,
        message: presentation.title,
        description: presentation.description,
      };
    } else {
      const presentation = operatorEventPresentation({
        publicLevel: 1,
        eventTitle: value.eventTitle,
        physicalDescription: value.eventDescription,
        abnormalParameters: value.abnormalParameters,
      }, 1);
      current.lastTime = value.time;
      current.lastTimestamp = timestamp;
      current.sampleCount += 1;
      current.eventId ||= eventId;
      current.message = presentation.title || current.message;
      current.description = presentation.description || current.description;
    }

    if (orderedIndex === ordered.length - 1) close(true);
  });
  close(false);
  return projected;
}

/** Keeps the existing L2+ queue boundary while aggregating snapshots by backend event id. */
export function projectAlarmEvents(alerts: Alert[]): MonitoringEventStreamItem[] {
  const groups = new Map<string, Alert[]>();
  alerts.forEach((alert, index) => {
    const currentLevel = safeLevel(alert.currentBackendLevel ?? alert.backendLevel);
    const peakLevel = safeLevel(alert.peakBackendLevel ?? alert.backendLevel);
    if (Math.max(currentLevel, peakLevel) < 2) return;
    // A formal alarm needs continuity. The first raw SSE frame is only a
    // candidate; keep it out of the operator event list until a second frame
    // confirms the same backend event identity. Terminal lifecycle records
    // are also subject to this rule so a transition cannot appear as a
    // one-frame alarm.
    const observedSamples = Math.max(0, Math.round(Number(alert.count) || 0));
    if (observedSamples < 2) return;
    const backendEventId = String(alert.backendEventId || '').trim() || `local-${alert.id}-${index}`;
    const group = groups.get(backendEventId) || [];
    group.push(alert);
    groups.set(backendEventId, group);
  });

  return [...groups.entries()].map(([backendEventId, group], groupIndex) => {
    const ordered = group
      .map((alert, index) => ({ alert, index, last: alertLastTimestamp(alert, index) }))
      .sort((a, b) => a.last - b.last || a.index - b.index);
    const latest = ordered.at(-1)!.alert;
    const starts = group.map((alert, index) => alertStartTimestamp(alert, index));
    const lasts = group.map((alert, index) => alertLastTimestamp(alert, starts[index]));
    const startTimestamp = Math.min(...starts);
    const lastTimestamp = Math.max(...lasts);
    const latestCurrentLevel = safeLevel(latest.currentBackendLevel ?? latest.backendLevel);
    const peakLevel = group.reduce<BackendLevel>((peak, alert) => (
      Math.max(peak, safeLevel(alert.peakBackendLevel ?? alert.backendLevel), safeLevel(alert.backendLevel)) as BackendLevel
    ), 0);
    const normalizedLifecycle = lifecycle(latest.lifecycleStatus || latest.eventState, latestCurrentLevel);
    // A held incident is still OPEN: the backend retains its identity and the
    // operator warning while interpretation is frozen (telemetry gap /
    // hydraulic boundary). Only terminal states clear the live level.
    const isActive = normalizedLifecycle === 'active' || normalizedLifecycle === 'hold';
    const currentLevel = isActive ? latestCurrentLevel : 0;

    const presentation = operatorEventPresentation({
      publicLevel: latestCurrentLevel,
      eventTitle: latest.title,
      physicalDescription: latest.description,
      primaryParameter: latest.primaryParameter,
      activeSignals: latest.activeSignals,
    }, latestCurrentLevel);
    const earliestAlert = group[starts.indexOf(startTimestamp)] || group[0];
    const canonicalStart = dateTimeLabel(earliestAlert.date, earliestAlert.time);
    const canonicalEnd = dateTimeLabel(latest.lastDate || latest.date, latest.lastTime || latest.time);
    return {
      id: `alarm-${backendEventId}`,
      kind: 'alarm' as const,
      level: currentLevel,
      currentLevel,
      peakLevel,
      startTime: canonicalStart,
      endTime: canonicalEnd,
      lastTime: canonicalEnd,
      message: presentation.title,
      description: presentation.description,
      lifecycleStatus: normalizedLifecycle,
      ackStatus: ackStatus(latest),
      duration: durationMs(startTimestamp, lastTimestamp),
      sampleCount: Math.max(1, ...group.map((alert) => Number(alert.count) || 1)),
      backendEventId,
      activeSignals: latest.activeSignals,
      isActive,
      sortTimestamp: startTimestamp + groupIndex * 0,
      sourceAlertId: latest.id,
    };
  }).sort((a, b) => (a.sortTimestamp || 0) - (b.sortTimestamp || 0));
}

export function mergeMonitoringEvents(
  observations: MonitoringEventStreamItem[],
  alarms: MonitoringEventStreamItem[],
): MonitoringEventStreamItem[] {
  const alarmEventIds = new Set(alarms.map((item) => item.backendEventId).filter(Boolean));
  const uniqueObservations = new Map<string, MonitoringEventStreamItem>();
  observations.forEach((item) => {
    if (item.backendEventId && alarmEventIds.has(item.backendEventId)) return;
    const key = item.backendEventId ? `backend:${item.backendEventId}` : item.id;
    const previous = uniqueObservations.get(key);
    if (!previous) {
      uniqueObservations.set(key, item);
      return;
    }
    uniqueObservations.set(key, {
      ...previous,
      endTime: item.endTime,
      lastTime: item.lastTime,
      duration: Math.max(previous.duration, item.duration),
      sampleCount: previous.sampleCount + item.sampleCount,
      lifecycleStatus: item.lifecycleStatus,
      isActive: item.isActive,
    });
  });

  return [...uniqueObservations.values(), ...alarms].sort((a, b) => {
    const left = a.sortTimestamp ?? parseTimestamp(undefined, a.startTime, 0);
    const right = b.sortTimestamp ?? parseTimestamp(undefined, b.startTime, 0);
    return left - right || a.id.localeCompare(b.id);
  });
}

export function filterMonitoringEvents(items: MonitoringEventStreamItem[], filter: MonitoringEventFilter) {
  if (filter === 'alarms') return items.filter((item) => item.kind === 'alarm');
  if (filter === 'unacknowledged') return items.filter((item) => item.kind === 'alarm' && item.ackStatus === 'unacknowledged');
  return items;
}

export function monitoringEventVisualTone(item: MonitoringEventStreamItem): MonitoringEventVisualTone {
  if (item.kind === 'observation' || !item.isActive) return 'neutral';
  if (item.currentLevel >= 4) return 'red';
  if (item.currentLevel === 3) return 'orange';
  return 'amber';
}

export interface FollowLatestState {
  isFollowing: boolean;
  newEventCount: number;
  itemCount: number;
}

export function updateFollowLatestForScroll(state: FollowLatestState, isAtBottom: boolean): FollowLatestState {
  return isAtBottom
    ? { ...state, isFollowing: true, newEventCount: 0 }
    : { ...state, isFollowing: false };
}

export function updateFollowLatestForItems(state: FollowLatestState, itemCount: number) {
  const added = Math.max(0, itemCount - state.itemCount);
  return {
    state: {
      isFollowing: state.isFollowing,
      newEventCount: state.isFollowing ? 0 : state.newEventCount + added,
      itemCount,
    },
    shouldScroll: state.isFollowing && added > 0,
  };
}

export function restoreFollowLatest(state: FollowLatestState): FollowLatestState {
  return { ...state, isFollowing: true, newEventCount: 0 };
}
