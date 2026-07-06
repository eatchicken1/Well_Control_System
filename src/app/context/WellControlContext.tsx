import { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { appendAccessToken, authenticatedFetch, getAccessToken } from '../api/authToken';
import { saveSelectedWells } from '../api/authApi';
import { useAuth } from './AuthContext';

export type AlertStatus = 'normal' | 'warning' | 'critical';
export type BackendLevel = 0 | 1 | 2 | 3 | 4;
export type CycleState = 0 | 1 | 2 | 3 | 4 | 5;
export type DataSourceMode = 'realtime';
export type DataSourceConnectionStatus = 'connecting' | 'connected' | 'paused' | 'disconnected' | 'error';

export interface WellInfo {
  wellId: string;
  wellName: string;
  block: string;
  depth: number;
  crew: string;
  dataSource: 'replay' | 'realtime';
  baselineVersion: string;
  startTime?: string;
  endTime?: string;
  discoveryTime?: string;
  wellNameStd?: string;
  wellNameRaw?: string;
  blockName?: string;
  targetLayer?: string;
  depthMinM?: number;
  depthMaxM?: number;
  qualityGrade?: string;
  recordCount?: number;
  realtimeTableName?: string;
  sampleStartTime?: string;
  sampleEndTime?: string;
}

export interface MonitoringData {
  pitGain: number;
  pitVolume: number;
  returnResponse: number;
  flowIn: number;
  flowOut: number;
  casingPressure: number;
  drillPipePressure: number;
  spp: number;
  sppPredicted: number;
  spm: number;
  mudWeight: number;
  mudTemp: number;
  rop: number;
  hookLoad: number;
  totalGas: number;
  torque: number;
  wellDepth?: number;
  bitDepth: number;
  rpm: number;
  confidenceLevel: number;
  pumpState: string;
  condition: string;
  formation?: string;
}

export interface CycleInfo {
  state: CycleState;
  stateLabel: string;
  shortLabel: string;
  description: string;
  cycleIndex: number;
  elapsedInState: number;
  totalStateSeconds: number;
  progress: number;
  tStopPump: string | null;
  tStartPump: string | null;
  tStable: string | null;
}

export interface BaselineInfo {
  totalCycles: number;
  qualifiedCycles: number;
  frozenCycles: number;
  acceptedCycleCount: number;
  isColdStart: boolean;
  coldStartRemaining: number;
  qualityScore: number;
  templateCoverage: number;
  lastResetReason: string | null;
  lastResetTime: string | null;
}

export interface AlgorithmInterfaceInfo {
  rootPath: string;
  mode: 'adapter-preview' | 'connected';
  endpoints: Array<{
    name: string;
    command: string;
    status: 'ready';
  }>;
}

export interface Alert {
  id: number;
  wellId?: string;
  wellName?: string;
  wellBlock?: string;
  wellDepth?: number;
  bitDepth?: number;
  formation?: string;
  time: string;
  date: string;
  lastTime?: string;
  lastDate?: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged: boolean;
  code?: string;
  backendEventId: string;
  backendLevel: BackendLevel;
  peakBackendLevel: BackendLevel;
  formalEvalLevel: BackendLevel;
  peakFormalEvalLevel: BackendLevel;
  activeSignals: string[];
  eventState: string;
  pumpState: string;
  count?: number;
}

export interface BackendDetectionState {
  publicLevel: BackendLevel;
  formalEvalLevel: BackendLevel;
  reason: string;
  activeSignals: string[];
  eventState: string;
  pumpState: string;
  timestamp: string;
  eventId: string | null;
  baselineValid: boolean;
  baselineWarmup: boolean;
  monitoringReady: boolean;
  baselineCount: number;
  baselineSource: string;
  baselineSelection: string;
  baselineStartTime: string;
  baselineEndTime: string;
  baselineInvalidReason: string;
}

export interface FlowDataPoint {
  time: string;
  timestampMs?: number;
  backendLevel?: BackendLevel;
  eventId?: string | null;
  flowIn: number;
  flowOut: number;
  returnResponse?: number;
  pitGain?: number;
  pitVolume?: number;
  bitDepth?: number;
  spm?: number;
  totalGas?: number;
  hookLoad?: number;
}

export interface PressureDataPoint {
  time: string;
  timestampMs?: number;
  backendLevel?: BackendLevel;
  eventId?: string | null;
  casingPressure: number;
  drillPipePressure: number;
  spp?: number;
  sppPredicted?: number;
}

export interface HistoryRecord {
  id: number;
  time: string;
  date: string;
  pitGain: number;
  pitVolume: number;
  returnResponse: number;
  flowIn: number;
  flowOut: number;
  casingPressure: number;
  drillPipePressure: number;
  spp: number;
  sppPredicted: number;
  spm: number;
  totalGas: number;
  hookLoad: number;
  mudWeight: number;
  rop: number;
  bitDepth: number;
  pumpState: string;
  cycleState: CycleState;
  backendLevel: BackendLevel;
  baselineValid: boolean;
  baselineWarmup: boolean;
  monitoringReady: boolean;
  baselineCount: number;
  status: AlertStatus;
}

export interface ThresholdSettings {
  returnResponseWarning: number;
  returnResponseCritical: number;
  pitGainWarning: number;
  pitGainCritical: number;
  casingPressureWarning: number;
  mudWeightWarning: number;
  sppResidualWarning: number;
  sppResidualCritical: number;
  cusumDecisionInterval: number;
  rlsForgettingFactor: number;
  madTolerance: number;
  gasLagWindowMinutes: number;
  stopFlowDecayThreshold: number;
  coldStartCycleCount: number;
  covariancePenaltyThreshold: number;
}

export const DEFAULT_REALTIME_ENDPOINT = '/api/realtime';
const STORAGE_PREFIX = 'wcs-overflow-2026';
const STORAGE_SELECTED_WELL = `${STORAGE_PREFIX}:selected-well-id`;
const STORAGE_MONITORED_WELLS = `${STORAGE_PREFIX}:monitored-well-ids`;
const STORAGE_REALTIME_TABS = `${STORAGE_PREFIX}:realtime-tab-well-ids`;
const STORAGE_REALTIME_ENDPOINT = `${STORAGE_PREFIX}:realtime-endpoint`;
const STORAGE_WELL_RUNTIME_STATES = `${STORAGE_PREFIX}:well-runtime-states`;
const STORAGE_WELL_SNAPSHOTS = `${STORAGE_PREFIX}:well-snapshots`;
const STORAGE_MANUAL_STOPPED_WELLS = `${STORAGE_PREFIX}:manual-stopped-well-ids`;
const STORAGE_ACKNOWLEDGED_EVENTS = `${STORAGE_PREFIX}:acknowledged-events`;
const STORAGE_ALERT_EVENTS = `${STORAGE_PREFIX}:alert-events`;

export interface RealtimeStartOption {
  frame: number;
  timestamp: string;
  relMin: number | null;
  label: string;
}

export interface RealtimeTimeBounds {
  firstTime: string;
  lastTime: string;
  discoveryTime: string;
  discoveryFrame: number;
  discoveryRelMin: number | null;
}

export interface RealTimeRecord extends Partial<MonitoringData> {
  [key: string]: unknown;
  sampleTime?: string;
  timestamp?: string | number;
  cycleState?: CycleState | number | string;
}

export interface DataSourceState {
  mode: DataSourceMode;
  adapterName: string;
  status: DataSourceConnectionStatus;
  endpoint: string | null;
  message: string;
  lastRecordAt: string | null;
  recordCount: number;
}

export interface WellRuntimeState {
  wellId: string;
  status: DataSourceConnectionStatus;
  isRunning: boolean;
  shouldAutoRestore?: boolean;
  recordCount: number;
  lastRecordAt: string | null;
  backendLevel: BackendLevel;
  latestWellDepth?: number;
  latestBitDepth?: number;
  latestFormation?: string;
  monitoringStartedAt: string | null;
  startedSampleTime: string | null;
  message: string;
  updatedAt: string;
}

interface WellMonitoringSnapshot {
  currentData: MonitoringData;
  currentSampleTime: string;
  lastRecordAt: string | null;
  monitoringStartedAt: string | null;
  startedSampleTime: string | null;
  flowHistory: FlowDataPoint[];
  pressureHistory: PressureDataPoint[];
  backendDetection: BackendDetectionState;
  historyRecords: HistoryRecord[];
  cycleInfo: CycleInfo;
  shutInActive: boolean;
  shutInStartedAt: string | null;
  latestWellDepth?: number;
  latestBitDepth?: number;
  latestFormation?: string;
}

export interface SelectedWellViewState {
  currentData: MonitoringData;
  currentSampleTime: string;
  flowHistory: FlowDataPoint[];
  pressureHistory: PressureDataPoint[];
  backendDetection: BackendDetectionState;
  historyRecords: HistoryRecord[];
  cycleInfo: CycleInfo;
  shutInActive: boolean;
  shutInStartedAt: string | null;
  latestWellDepth?: number;
  latestBitDepth?: number;
  latestFormation?: string;
  fromSnapshotFallback: boolean;
}

type AcknowledgedEventMap = Record<string, true>;

interface DataSourceAdapter {
  connect: (well: WellInfo, seed: MonitoringData) => void;
  disconnect: () => void;
  onRecord: (callback: (record: RealTimeRecord) => void) => void;
  onStatus: (callback: (state: DataSourceState) => void) => void;
}

function hasRuntimeResumeProgress(runtime?: WellRuntimeState | null) {
  return Boolean(
    runtime && (
      Boolean(runtime.lastRecordAt)
      || Boolean(runtime.startedSampleTime)
      || (runtime.recordCount ?? 0) > 0
    ),
  );
}

function hasSnapshotResumeProgress(snapshot?: WellMonitoringSnapshot | null) {
  return Boolean(
    snapshot && (
      Boolean(snapshot.currentSampleTime)
      || Boolean(snapshot.lastRecordAt)
      || Boolean(snapshot.startedSampleTime)
      || snapshot.flowHistory.length > 0
      || snapshot.pressureHistory.length > 0
      || snapshot.historyRecords.length > 0
    ),
  );
}

function hasWellResumeProgress(runtime?: WellRuntimeState | null, snapshot?: WellMonitoringSnapshot | null) {
  return hasRuntimeResumeProgress(runtime) || hasSnapshotResumeProgress(snapshot);
}

function parseDateLikeMs(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const variants = text.includes('T') ? [text] : [text, text.replace(' ', 'T')];
  for (const variant of variants) {
    const parsed = new Date(variant).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sampleTimeFromRecord(record?: Partial<RealTimeRecord> | null) {
  if (!record || typeof record !== 'object') return '';
  const row = record as Record<string, unknown>;
  return String(row.sampleTime ?? row.sample_time ?? row.timestamp ?? '').trim();
}

function normalizeSampleTime(value?: string | null) {
  return value ? value.replace('T', ' ').trim() : '';
}

function isStrictlyNewerSampleTime(candidate?: string | null, previous?: string | null) {
  const candidateMs = parseDateLikeMs(candidate);
  const previousMs = parseDateLikeMs(previous);
  if (candidateMs === null) return false;
  if (previousMs === null) return true;
  return candidateMs > previousMs;
}

function nextPreviewCursorFrom(sampleTime?: string | null) {
  const normalized = normalizeSampleTime(sampleTime);
  if (!normalized) return '';
  return shiftTimestamp(normalized, 1000) || normalized;
}

function formatRuntimeFrameMessage(message: string, recordCount: number) {
  if (!message || recordCount <= 0 || !message.includes('帧')) return message;
  return message.replace(/\d+\s*帧/, `${recordCount} 帧`);
}

function estimateMonitoringStartedAtFromSamples(startedSampleTime?: string | null, latestSampleTime?: string | null) {
  const startMs = parseDateLikeMs(startedSampleTime);
  const latestMs = parseDateLikeMs(latestSampleTime);
  if (startMs === null || latestMs === null) return null;
  const elapsedMs = Math.max(0, latestMs - startMs);
  if (elapsedMs <= 0) return null;
  return new Date(Math.max(0, Date.now() - elapsedMs)).toISOString();
}

function resolveMonitoringStartedAt(
  runtime?: WellRuntimeState | null,
  snapshot?: WellMonitoringSnapshot | null,
  fallbackStartSample?: string | null,
  fallbackLatestSample?: string | null,
) {
  const persisted = runtime?.monitoringStartedAt || snapshot?.monitoringStartedAt;
  if (persisted) return persisted;
  const startedSampleTime = runtime?.startedSampleTime || snapshot?.startedSampleTime || fallbackStartSample || null;
  const latestSampleTime = runtime?.lastRecordAt || snapshot?.lastRecordAt || snapshot?.currentSampleTime || fallbackLatestSample || null;
  return estimateMonitoringStartedAtFromSamples(startedSampleTime, latestSampleTime);
}

interface WellControlContextType {
  isRunning: boolean;
  currentData: MonitoringData;
  flowHistory: FlowDataPoint[];
  pressureHistory: PressureDataPoint[];
  alerts: Alert[];
  historyRecords: HistoryRecord[];
  thresholds: ThresholdSettings;
  alertStatus: AlertStatus;
  backendDetection: BackendDetectionState;
  cycleInfo: CycleInfo;
  baselineInfo: BaselineInfo;
  wells: WellInfo[];
  wellRuntimeStates: Record<string, WellRuntimeState>;
  monitoredWellIds: string[];
  realtimeTabWellIds: string[];
  wellInfo: WellInfo;
  selectedWellId: string;
  algorithmInterface: AlgorithmInterfaceInfo;
  dataSourceState: DataSourceState;
  realtimeEndpoint: string;
  startOptions: RealtimeStartOption[];
  selectedStartFrame: number;
  selectedStartTime: string;
  currentSampleTime: string;
  timeBounds: RealtimeTimeBounds;
  shutInActive: boolean;
  shutInStartedAt: string | null;
  selectedWellView: SelectedWellViewState;
  selectedWellManuallyStopped: boolean;
  isWellManuallyStopped: (wellId: string) => boolean;
  buildRealtimeApiUrl: (path: string) => string;
  setIsRunning: (v: boolean) => void;
  handleReset: () => void;
  acknowledgeAlert: (id: number) => void;
  acknowledgeAll: () => void;
  selectWell: (wellId: string) => void;
  toggleMonitoredWell: (wellId: string) => void;
  addMonitoredWell: (wellId: string) => void;
  removeMonitoredWell: (wellId: string) => void;
  openRealtimeWell: (wellId: string) => void;
  startWellMonitoring: (wellId: string) => void;
  stopWellMonitoring: (wellId: string) => void;
  pauseWellMonitoring: (wellId: string) => void;
  resumeWellMonitoring: (wellId: string) => void;
  selectStartFrame: (frame: number) => void;
  updateSelectedStartTime: (value: string) => void;
  startShutInProcedure: () => void;
  updateThresholds: (t: ThresholdSettings) => void;
  updateRealtimeEndpoint: (endpoint: string) => void;
}

const WellControlContext = createContext<WellControlContextType | null>(null);
const MONITORING_WINDOW_MS = 30 * 60 * 1000;
const MIN_MONITORING_POINTS = 1500;
// Backend stream rate is clamped to >=200ms, so a full 30min window is ~9000 frames.
// Keep a small hard cap to protect the browser from malformed/high-frequency streams
// without truncating the intended 30min window under the current backend contract.
const MAX_MONITORING_POINTS = 10000;
const MAX_STORED_SNAPSHOT_POINTS = 1800;
const MAX_STORED_HISTORY_RECORDS = 2200;
const STREAM_CONNECT_TIMEOUT_MS = 10000;
const PREVIEW_BATCH_LIMIT = 240;
const PREVIEW_IDLE_POLL_MS = 4000;
const SNAPSHOT_PERSIST_DEBOUNCE_MS = 220;
const RUNTIME_PERSIST_DEBOUNCE_MS = 220;

export function useWellControl() {
  const ctx = useContext(WellControlContext);
  if (!ctx) throw new Error('useWellControl must be used inside WellControlProvider');
  return ctx;
}

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  returnResponseWarning: 8,
  returnResponseCritical: 18,
  pitGainWarning: 1.2,
  pitGainCritical: 3,
  casingPressureWarning: 3.8,
  mudWeightWarning: 1.15,
  sppResidualWarning: 0.42,
  sppResidualCritical: 1.15,
  cusumDecisionInterval: 5.6,
  rlsForgettingFactor: 0.98,
  madTolerance: 2.8,
  gasLagWindowMinutes: 90,
  stopFlowDecayThreshold: 82,
  coldStartCycleCount: 20,
  covariancePenaltyThreshold: 0.3,
};

const WELLS: WellInfo[] = [
  {
    wellId: '大页1H2-4',
    wellName: '大页1H2-4',
    block: '实时监测井 · MySQL',
    depth: 4200,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '威231',
    wellName: '威231',
    block: '实时监测井 · MySQL',
    depth: 3900,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '中江2',
    wellName: '中江2',
    block: '实时监测井 · MySQL',
    depth: 4100,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '磨溪022-H21',
    wellName: '磨溪022-H21',
    block: '实时监测井 · MySQL',
    depth: 4300,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '中深103',
    wellName: '中深103',
    block: '实时监测井 · MySQL',
    depth: 4450,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '乐山1',
    wellName: '乐山1',
    block: '实时监测井 · MySQL',
    depth: 3720,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '五宝浅20',
    wellName: '五宝浅20',
    block: '实时监测井 · MySQL',
    depth: 3560,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '天府2',
    wellName: '天府2',
    block: '实时监测井 · MySQL',
    depth: 4080,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '威213',
    wellName: '威213',
    block: '实时监测井 · MySQL',
    depth: 3980,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '宁225',
    wellName: '宁225',
    block: '实时监测井 · MySQL',
    depth: 4020,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '蓬兴101',
    wellName: '蓬兴101',
    block: '实时监测井 · MySQL',
    depth: 4320,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
  {
    wellId: '顺探1',
    wellName: '顺探1',
    block: '实时监测井 · MySQL',
    depth: 4180,
    crew: '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
  },
];

const ALGORITHM_INTERFACE: AlgorithmInterfaceInfo = {
  rootPath: 'D:\\Study\\research\\wall_control\\V7.0\\kick_detection_system\\src\\KickDetectionSystem.Api',
  mode: 'connected',
  endpoints: [
    {
      name: 'MySQL 实时判级',
      command: '/api/realtime/wells/:wellKey/stream',
      status: 'ready',
    },
    {
      name: '事件日志',
      command: 'frame.log_entries',
      status: 'ready',
    },
    {
      name: '实时预览',
      command: '/api/realtime/wells/:wellKey',
      status: 'ready',
    },
  ],
};

const CYCLE_STATES: Array<Omit<CycleInfo, 'cycleIndex' | 'elapsedInState' | 'totalStateSeconds' | 'progress' | 'tStopPump' | 'tStartPump' | 'tStable'>> = [
  {
    state: 0,
    stateLabel: '井筒扰动观察',
    shortLabel: '观察',
    description: '关注抽汲诱发的井筒体积扰动',
  },
  {
    state: 1,
    stateLabel: '钻进稳定',
    shortLabel: '稳态',
    description: '稳定段进入基线候选池',
  },
  {
    state: 2,
    stateLabel: '循环稳定',
    shortLabel: '循环',
    description: '泵仍运行，建立停泵前压力参照',
  },
  {
    state: 3,
    stateLabel: '停泵监测',
    shortLabel: '停泵',
    description: '持续跟踪停泵出口流量与总池体积变化',
  },
  {
    state: 4,
    stateLabel: '开泵恢复',
    shortLabel: '开泵',
    description: '重新建立开泵后的水力参照',
  },
  {
    state: 5,
    stateLabel: '实时监测',
    shortLabel: '检测',
    description: '实时判级进入稳定监测窗口',
  },
];

const CYCLE_DURATIONS = [10, 12, 10, 12, 16, 12];
const TOTAL_CYCLE_SECONDS = CYCLE_DURATIONS.reduce((sum, item) => sum + item, 0);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatNow() {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  return { timeStr, dateStr };
}

function formatRecordTime(value?: string | number) {
  if (value === undefined || value === null || value === '') return formatNow();
  const parsed = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatNow();
  const timeStr = `${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}:${parsed.getSeconds().toString().padStart(2, '0')}`;
  const dateStr = `${parsed.getFullYear()}-${(parsed.getMonth() + 1).toString().padStart(2, '0')}-${parsed.getDate().toString().padStart(2, '0')}`;
  return { timeStr, dateStr };
}

function formatRecordDateTime(value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  const parsed = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mi = String(parsed.getMinutes()).padStart(2, '0');
  const ss = String(parsed.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function recordMillis(value?: string | number) {
  if (value === undefined || value === null || value === '') return Date.now();
  const parsed = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
}

function keepMonitoringWindow<T extends { timestampMs?: number }>(items: T[]) {
  const bounded = items.length > MAX_MONITORING_POINTS ? items.slice(-MAX_MONITORING_POINTS) : items;
  if (bounded.length <= MIN_MONITORING_POINTS) return bounded;
  const latest = bounded.at(-1)?.timestampMs;
  if (!Number.isFinite(latest)) return bounded.slice(-MIN_MONITORING_POINTS);
  const cutoff = Number(latest) - MONITORING_WINDOW_MS;
  const byTime = bounded.filter((item) => !Number.isFinite(item.timestampMs) || Number(item.timestampMs) >= cutoff);
  const kept = byTime.length < MIN_MONITORING_POINTS ? bounded.slice(-MIN_MONITORING_POINTS) : byTime;
  return kept.length > MAX_MONITORING_POINTS ? kept.slice(-MAX_MONITORING_POINTS) : kept;
}

function sortMonitoringPoints<T extends { timestampMs?: number }>(items: T[]) {
  let previous = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const current = Number(item.timestampMs ?? 0);
    if (current < previous) {
      return [...items].sort((a, b) => Number(a.timestampMs ?? 0) - Number(b.timestampMs ?? 0));
    }
    previous = current;
  }
  return items;
}

function dedupeMonitoringPoints<T extends { timestampMs?: number; time?: string }>(items: T[]) {
  if (items.length <= 1) return items;
  const deduped: T[] = [];
  let previousKey = '';
  for (const item of items) {
    const key = `${Number(item.timestampMs ?? 0)}|${String(item.time ?? '')}`;
    if (key === previousKey) continue;
    deduped.push(item);
    previousKey = key;
  }
  return deduped;
}

function dedupeHistoryRecords(items: HistoryRecord[]) {
  if (items.length <= 1) return items;
  const deduped: HistoryRecord[] = [];
  let previousKey = '';
  for (const item of items) {
    const key = `${item.date}|${item.time}|${item.bitDepth}|${item.backendLevel}`;
    if (key === previousKey) continue;
    deduped.push(item);
    previousKey = key;
  }
  return deduped;
}

function readNumber(record: RealTimeRecord, keys: string[], fallback: number) {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function finite(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function readString(record: Record<string, unknown>, keys: string[], fallback = '') {
  const value = readValue(record, keys);
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || fallback;
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function parseFrameMillis(value?: string) {
  if (!value) return Number.NaN;
  const millis = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(millis) ? millis : Number.NaN;
}

function toDatetimeLocalValue(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}` : '';
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return '';
  return value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
}

function shiftTimestamp(value: string, deltaMs: number) {
  if (!value) return '';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  const shifted = new Date(parsed.getTime() + deltaMs);
  const yyyy = shifted.getFullYear();
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  const hh = String(shifted.getHours()).padStart(2, '0');
  const mi = String(shifted.getMinutes()).padStart(2, '0');
  const ss = String(shifted.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function persistStringListState(key: string, value: string[]) {
  writeStoredJson(key, value);
  return value;
}

function persistStringValueState(key: string, value: string) {
  if (typeof window === 'undefined') return value;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
  return value;
}

function saveWellSelection(key: string, value: string) {
  persistStringValueState(key, value);
}

function saveWellListSelection(key: string, value: string[]) {
  persistStringListState(key, value);
}

function getInitialManualStoppedWellIds() {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const saved = window.localStorage.getItem(STORAGE_MANUAL_STOPPED_WELLS);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sanitizeWellRuntimeState(value: unknown): WellRuntimeState | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const wellId = String(row.wellId || '').trim();
  if (!wellId) return null;
  const rawStatus = String(row.status || 'paused');
  const persistedRunning = readBoolean(row.isRunning, false);
  const wasActive = persistedRunning || rawStatus === 'connected' || rawStatus === 'connecting';
  const explicitAutoRestore = typeof row.shouldAutoRestore === 'boolean' ? row.shouldAutoRestore : undefined;
  const hasResumeProgress = Boolean(row.lastRecordAt || row.startedSampleTime);
  return {
    wellId,
    status: wasActive ? 'connecting' : (['paused', 'disconnected', 'error'].includes(rawStatus) ? rawStatus as DataSourceConnectionStatus : 'paused'),
    isRunning: false,
    shouldAutoRestore: explicitAutoRestore ?? (wasActive || hasResumeProgress),
    recordCount: Math.max(0, finite(row.recordCount, 0)),
    lastRecordAt: row.lastRecordAt ? String(row.lastRecordAt) : null,
    backendLevel: normalizeBackendLevel(row.backendLevel),
    latestWellDepth: Number.isFinite(Number(row.latestWellDepth)) ? Number(row.latestWellDepth) : undefined,
    latestBitDepth: Number.isFinite(Number(row.latestBitDepth)) ? Number(row.latestBitDepth) : undefined,
    latestFormation: row.latestFormation ? String(row.latestFormation) : undefined,
    monitoringStartedAt: row.monitoringStartedAt ? String(row.monitoringStartedAt) : null,
    startedSampleTime: row.startedSampleTime ? String(row.startedSampleTime) : null,
    message: wasActive
      ? '正在恢复上次监测流'
      : String(row.message || '待启动'),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

function getInitialWellRuntimeStates() {
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_WELL_RUNTIME_STATES, {});
  const snapshots = getInitialWellSnapshots();
  const sanitized: Record<string, WellRuntimeState> = {};
  Object.entries(stored).forEach(([key, value]) => {
    const runtime = sanitizeWellRuntimeState(value);
    if (!runtime) return;
    const snapshot = snapshots[runtime.wellId] || snapshots[key];
    sanitized[runtime.wellId] = {
      ...runtime,
      lastRecordAt: runtime.lastRecordAt || snapshot?.lastRecordAt || snapshot?.currentSampleTime || null,
      startedSampleTime: runtime.startedSampleTime || snapshot?.startedSampleTime || snapshot?.currentSampleTime || null,
      monitoringStartedAt: resolveMonitoringStartedAt(runtime, snapshot),
      latestWellDepth: runtime.latestWellDepth ?? snapshot?.latestWellDepth ?? snapshot?.currentData.wellDepth,
      latestBitDepth: runtime.latestBitDepth ?? snapshot?.latestBitDepth ?? snapshot?.currentData.bitDepth,
      latestFormation: runtime.latestFormation ?? snapshot?.latestFormation ?? snapshot?.currentData.formation,
      shouldAutoRestore: runtime.shouldAutoRestore ?? (runtime.status === 'connecting' || runtime.status === 'connected' || runtime.isRunning),
    };
  });
  Object.entries(snapshots).forEach(([wellId, snapshot]) => {
    if (sanitized[wellId]) return;
    if (
      !snapshot.currentSampleTime
      && !snapshot.lastRecordAt
      && !snapshot.startedSampleTime
      && snapshot.flowHistory.length === 0
      && snapshot.pressureHistory.length === 0
      && snapshot.historyRecords.length === 0
    ) return;
    sanitized[wellId] = {
      wellId,
      status: 'connecting',
      isRunning: false,
      shouldAutoRestore: true,
      recordCount: snapshot.historyRecords.length,
      lastRecordAt: snapshot.lastRecordAt || snapshot.currentSampleTime || null,
      backendLevel: snapshot.backendDetection.publicLevel,
      latestWellDepth: snapshot.latestWellDepth ?? snapshot.currentData.wellDepth,
      latestBitDepth: snapshot.latestBitDepth ?? snapshot.currentData.bitDepth,
      latestFormation: snapshot.latestFormation ?? snapshot.currentData.formation,
      monitoringStartedAt: resolveMonitoringStartedAt(null, snapshot),
      startedSampleTime: snapshot.startedSampleTime || snapshot.currentSampleTime || null,
      message: '已从本地快照恢复，正在续接检测流',
      updatedAt: new Date().toISOString(),
    };
  });
  return sanitized;
}


function sanitizeStoredMonitoringData(value: unknown): MonitoringData {
  const fallback = makeInitialData(WELLS[0]);
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Record<string, unknown>;
  return {
    ...fallback,
    ...row as Partial<MonitoringData>,
    pitGain: finite(row.pitGain, fallback.pitGain),
    pitVolume: finite(row.pitVolume, fallback.pitVolume),
    returnResponse: finite(row.returnResponse, fallback.returnResponse),
    flowIn: finite(row.flowIn, fallback.flowIn),
    flowOut: finite(row.flowOut, fallback.flowOut),
    casingPressure: finite(row.casingPressure, fallback.casingPressure),
    drillPipePressure: finite(row.drillPipePressure, fallback.drillPipePressure),
    spp: finite(row.spp, fallback.spp),
    sppPredicted: finite(row.sppPredicted, fallback.sppPredicted),
    spm: finite(row.spm, fallback.spm),
    mudWeight: finite(row.mudWeight, fallback.mudWeight),
    mudTemp: finite(row.mudTemp, fallback.mudTemp),
    rop: finite(row.rop, fallback.rop),
    hookLoad: finite(row.hookLoad, fallback.hookLoad),
    totalGas: finite(row.totalGas, fallback.totalGas),
    torque: finite(row.torque, fallback.torque),
    wellDepth: Number.isFinite(Number(row.wellDepth)) ? Number(row.wellDepth) : fallback.wellDepth,
    bitDepth: finite(row.bitDepth, fallback.bitDepth),
    rpm: finite(row.rpm, fallback.rpm),
    confidenceLevel: finite(row.confidenceLevel, fallback.confidenceLevel),
    pumpState: row.pumpState ? String(row.pumpState) : fallback.pumpState,
    condition: row.condition ? String(row.condition) : fallback.condition,
    formation: row.formation ? String(row.formation) : fallback.formation,
  };
}

function sanitizeStoredBackendDetection(value: unknown): BackendDetectionState {
  if (!value || typeof value !== 'object') return INITIAL_BACKEND_DETECTION;
  const row = value as Partial<BackendDetectionState> & Record<string, unknown>;
  return {
    ...INITIAL_BACKEND_DETECTION,
    ...row,
    publicLevel: normalizeBackendLevel(row.publicLevel),
    formalEvalLevel: normalizeBackendLevel(row.formalEvalLevel),
    reason: String(row.reason || INITIAL_BACKEND_DETECTION.reason),
    activeSignals: parseActiveSignals(row.activeSignals),
    eventState: String(row.eventState || INITIAL_BACKEND_DETECTION.eventState),
    pumpState: String(row.pumpState || INITIAL_BACKEND_DETECTION.pumpState),
    timestamp: String(row.timestamp || INITIAL_BACKEND_DETECTION.timestamp),
    eventId: row.eventId ? String(row.eventId) : null,
    baselineValid: readBoolean(row.baselineValid, INITIAL_BACKEND_DETECTION.baselineValid),
    baselineWarmup: readBoolean(row.baselineWarmup, INITIAL_BACKEND_DETECTION.baselineWarmup),
    monitoringReady: readBoolean(row.monitoringReady, INITIAL_BACKEND_DETECTION.monitoringReady),
    baselineCount: Math.max(0, finite(row.baselineCount, INITIAL_BACKEND_DETECTION.baselineCount)),
    baselineSource: String(row.baselineSource || INITIAL_BACKEND_DETECTION.baselineSource),
    baselineSelection: String(row.baselineSelection || INITIAL_BACKEND_DETECTION.baselineSelection),
    baselineStartTime: String(row.baselineStartTime || INITIAL_BACKEND_DETECTION.baselineStartTime),
    baselineEndTime: String(row.baselineEndTime || INITIAL_BACKEND_DETECTION.baselineEndTime),
    baselineInvalidReason: String(row.baselineInvalidReason || INITIAL_BACKEND_DETECTION.baselineInvalidReason),
  };
}

function sanitizeStoredCycleInfo(value: unknown): CycleInfo {
  const fallback = getCycleInfo(0);
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Partial<CycleInfo> & Record<string, unknown>;
  const state = parseCycleState(row.state) ?? fallback.state;
  return {
    ...fallback,
    ...row,
    state,
    stateLabel: String(row.stateLabel || fallback.stateLabel),
    shortLabel: String(row.shortLabel || fallback.shortLabel),
    description: String(row.description || fallback.description),
    cycleIndex: Math.max(1, Math.round(finite(row.cycleIndex, fallback.cycleIndex))),
    elapsedInState: Math.max(0, finite(row.elapsedInState, fallback.elapsedInState)),
    totalStateSeconds: Math.max(1, finite(row.totalStateSeconds, fallback.totalStateSeconds)),
    progress: clamp(finite(row.progress, fallback.progress), 0, 100),
    tStopPump: row.tStopPump ? String(row.tStopPump) : null,
    tStartPump: row.tStartPump ? String(row.tStartPump) : null,
    tStable: row.tStable ? String(row.tStable) : null,
  };
}

function sanitizeStoredFlowHistory(value: unknown): FlowDataPoint[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((item) => item && typeof item === 'object' && typeof (item as { time?: unknown }).time === 'string') as FlowDataPoint[];
  return keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints(valid))).slice(-MAX_STORED_SNAPSHOT_POINTS);
}

function sanitizeStoredPressureHistory(value: unknown): PressureDataPoint[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((item) => item && typeof item === 'object' && typeof (item as { time?: unknown }).time === 'string') as PressureDataPoint[];
  return keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints(valid))).slice(-MAX_STORED_SNAPSHOT_POINTS);
}

function sanitizeStoredHistoryRecords(value: unknown): HistoryRecord[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((item) => item && typeof item === 'object' && typeof (item as { time?: unknown }).time === 'string') as HistoryRecord[];
  return dedupeHistoryRecords(valid).slice(-MAX_STORED_HISTORY_RECORDS);
}

function sanitizeWellMonitoringSnapshot(value: unknown): WellMonitoringSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  return {
    currentData: sanitizeStoredMonitoringData(row.currentData),
    currentSampleTime: row.currentSampleTime ? String(row.currentSampleTime) : '',
    lastRecordAt: row.lastRecordAt ? String(row.lastRecordAt) : null,
    monitoringStartedAt: row.monitoringStartedAt ? String(row.monitoringStartedAt) : null,
    startedSampleTime: row.startedSampleTime ? String(row.startedSampleTime) : null,
    flowHistory: sanitizeStoredFlowHistory(row.flowHistory),
    pressureHistory: sanitizeStoredPressureHistory(row.pressureHistory),
    backendDetection: sanitizeStoredBackendDetection(row.backendDetection),
    historyRecords: sanitizeStoredHistoryRecords(row.historyRecords),
    cycleInfo: sanitizeStoredCycleInfo(row.cycleInfo),
    shutInActive: readBoolean(row.shutInActive, false),
    shutInStartedAt: row.shutInStartedAt ? String(row.shutInStartedAt) : null,
    latestWellDepth: Number.isFinite(Number(row.latestWellDepth)) ? Number(row.latestWellDepth) : undefined,
    latestBitDepth: Number.isFinite(Number(row.latestBitDepth)) ? Number(row.latestBitDepth) : undefined,
    latestFormation: row.latestFormation ? String(row.latestFormation) : undefined,
  };
}

function serializeWellMonitoringSnapshot(snapshot: WellMonitoringSnapshot): WellMonitoringSnapshot {
  return {
    ...snapshot,
    flowHistory: keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints(snapshot.flowHistory))).slice(-MAX_STORED_SNAPSHOT_POINTS),
    pressureHistory: keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints(snapshot.pressureHistory))).slice(-MAX_STORED_SNAPSHOT_POINTS),
    historyRecords: dedupeHistoryRecords(snapshot.historyRecords).slice(-MAX_STORED_HISTORY_RECORDS),
  };
}

function getInitialWellSnapshots() {
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_WELL_SNAPSHOTS, {});
  const sanitized: Record<string, WellMonitoringSnapshot> = {};
  Object.entries(stored).forEach(([key, value]) => {
    const snapshot = sanitizeWellMonitoringSnapshot(value);
    if (snapshot) sanitized[key] = snapshot;
  });
  return sanitized;
}
function getInitialAcknowledgedEvents() {
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_ACKNOWLEDGED_EVENTS, {});
  const sanitized: AcknowledgedEventMap = {};
  Object.entries(stored).forEach(([key, value]) => {
    if (value === true) sanitized[key] = true;
  });
  return sanitized;
}

function alertLevelFromBackend(level: BackendLevel) {
  if (level >= 4) return 'critical' as const;
  if (level >= 2) return 'warning' as const;
  return 'info' as const;
}

function sanitizeAlert(value: unknown): Alert | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const backendEventId = String(row.backendEventId || '').trim();
  const message = String(row.message || '').trim();
  if (!backendEventId || !message) return null;
  const backendLevel = normalizeBackendLevel(row.backendLevel);
  const formalEvalLevel = normalizeBackendLevel(row.formalEvalLevel);
  const id = Math.max(1, Math.round(finite(row.id, 0)));
  return {
    id,
    wellId: row.wellId ? String(row.wellId) : undefined,
    wellName: row.wellName ? String(row.wellName) : undefined,
    wellBlock: row.wellBlock ? String(row.wellBlock) : undefined,
    wellDepth: Number.isFinite(Number(row.wellDepth)) ? Number(row.wellDepth) : undefined,
    bitDepth: Number.isFinite(Number(row.bitDepth)) ? Number(row.bitDepth) : undefined,
    formation: row.formation ? String(row.formation) : undefined,
    time: String(row.time || ''),
    date: String(row.date || ''),
    lastTime: row.lastTime ? String(row.lastTime) : undefined,
    lastDate: row.lastDate ? String(row.lastDate) : undefined,
    level: alertLevelFromBackend(backendLevel),
    message,
    acknowledged: readBoolean(row.acknowledged, false),
    code: row.code ? String(row.code) : undefined,
    backendEventId,
    backendLevel,
    peakBackendLevel: normalizeBackendLevel(row.peakBackendLevel ?? backendLevel),
    formalEvalLevel,
    peakFormalEvalLevel: normalizeBackendLevel(row.peakFormalEvalLevel ?? formalEvalLevel),
    activeSignals: parseActiveSignals(row.activeSignals),
    eventState: String(row.eventState || 'tracking'),
    pumpState: String(row.pumpState || 'Unknown'),
    count: Math.max(1, Math.round(finite(row.count, 1))),
  };
}

function getInitialAlerts() {
  const stored = readStoredJson<unknown[]>(STORAGE_ALERT_EVENTS, []);
  return Array.isArray(stored)
    ? stored.flatMap((item) => {
      const alert = sanitizeAlert(item);
      return alert ? [alert] : [];
    }).slice(0, 120)
    : [];
}

function formatStartLabel(frame: number, timestamp: string) {
  const time = timestamp ? timestamp.replace(/^(\d{4})-(\d{2})-(\d{2})[ T]/, '$2-$3 ') : `帧 ${frame}`;
  return time;
}

function buildStartOptionsFromTimeIndex(data: {
  frame_count?: number;
  frameCount?: number;
  first_time?: string;
  firstTime?: string;
  last_time?: string;
  lastTime?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  discovery_time?: string;
  discoveryTime?: string;
  discovery_frame?: number;
  discoveryFrame?: number;
  discovery_rel_min?: number | null;
  discoveryRelMin?: number | null;
  discovery?: { frame?: number | null; timestamp?: string; rel_min?: number | null; relMin?: number | null } | null;
  options?: Array<{ frame: number; timestamp: string; rel_min?: number | null; relMin?: number | null }>;
}): RealtimeStartOption[] {
  const options = (data.options || []).map((option) => {
    const frame = finite(option.frame, 0);
    return {
      frame,
      timestamp: option.timestamp,
      relMin: option.rel_min ?? option.relMin ?? null,
      label: formatStartLabel(frame, option.timestamp),
    };
  });
  const discoveryTime = data.discovery_time || data.discoveryTime || data.discovery?.timestamp || '';
  if (discoveryTime) {
    const explicitFrame = Number(data.discovery_frame ?? data.discoveryFrame ?? data.discovery?.frame);
    const firstMs = parseFrameMillis(data.first_time || data.firstTime || data.start_time || data.startTime || '');
    const lastMs = parseFrameMillis(data.last_time || data.lastTime || data.end_time || data.endTime || '');
    const discoveryMs = parseFrameMillis(discoveryTime);
    const estimatedFrame = Number.isFinite(explicitFrame)
      ? explicitFrame
      : Number.isFinite(firstMs) && Number.isFinite(lastMs) && Number.isFinite(discoveryMs) && lastMs > firstMs
        ? Math.round(((discoveryMs - firstMs) / (lastMs - firstMs)) * Math.max(0, Number(data.frame_count ?? data.frameCount) - 1))
        : 0;
    const safeFrame = Math.max(0, Math.min(Math.max(0, Number(data.frame_count ?? data.frameCount ?? 1) - 1), estimatedFrame));
    options.unshift({
      frame: safeFrame,
      timestamp: discoveryTime,
      relMin: data.discovery_rel_min ?? data.discoveryRelMin ?? data.discovery?.rel_min ?? data.discovery?.relMin ?? 0,
      label: `现场发现 ${formatStartLabel(safeFrame, discoveryTime)}`,
    });
  }
  const byFrame = new Map<number, RealtimeStartOption>();
  for (const option of options) {
    if (!byFrame.has(option.frame) || option.label.startsWith('现场发现')) byFrame.set(option.frame, option);
  }
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}

function getInitialRealtimeEndpoint() {
  if (typeof window === 'undefined') return DEFAULT_REALTIME_ENDPOINT;
  const saved = window.localStorage.getItem(STORAGE_REALTIME_ENDPOINT);
  return normalizeRealtimeEndpoint(saved || DEFAULT_REALTIME_ENDPOINT);
}

function normalizeRealtimeEndpoint(endpoint: string) {
  const next = endpoint.trim() || DEFAULT_REALTIME_ENDPOINT;
  return next.startsWith('/api/realtime') ? next : DEFAULT_REALTIME_ENDPOINT;
}

function createInitialDataSourceState(endpoint: string, selectedStartTime = ''): DataSourceState {
  return {
    mode: 'realtime',
    adapterName: endpoint ? 'MySQL 实时数据接口' : '真实数据接口',
    status: endpoint ? 'paused' : 'error',
    endpoint: endpoint || null,
    message: endpoint
      ? selectedStartTime
        ? '已选择开始时间，点击开始监测'
        : '等待选择开始时间并启动监测'
      : '真实接口未配置，系统保持离线待命',
    lastRecordAt: null,
    recordCount: 0,
  };
}

function isRuntimeStreamActive(runtime?: WellRuntimeState | null) {
  return Boolean(
    runtime && (
      runtime.isRunning
      || runtime.status === 'connected'
      || runtime.status === 'connecting'
    ),
  );
}

interface InitialSelectedViewState {
  currentData: MonitoringData;
  currentSampleTime: string;
  flowHistory: FlowDataPoint[];
  pressureHistory: PressureDataPoint[];
  backendDetection: BackendDetectionState;
  historyRecords: HistoryRecord[];
  cycleInfo: CycleInfo;
  shutInActive: boolean;
  shutInStartedAt: string | null;
}

function createInitialSelectedViewState(selectedWellId: string): InitialSelectedViewState {
  const snapshots = getInitialWellSnapshots();
  const snapshot = snapshots[selectedWellId];
  const fallbackWell = WELLS.find((well) => well.wellId === selectedWellId) || WELLS[0];
  return {
    currentData: snapshot?.currentData || makeInitialData(fallbackWell),
    currentSampleTime: snapshot?.currentSampleTime || '',
    flowHistory: snapshot?.flowHistory || [],
    pressureHistory: snapshot?.pressureHistory || [],
    backendDetection: snapshot?.backendDetection || INITIAL_BACKEND_DETECTION,
    historyRecords: snapshot?.historyRecords || [],
    cycleInfo: snapshot?.cycleInfo || getCycleInfo(0),
    shutInActive: snapshot?.shutInActive || false,
    shutInStartedAt: snapshot?.shutInStartedAt || null,
  };
}

function makeInitialData(well: WellInfo): MonitoringData {
  return {
    pitGain: 0,
    pitVolume: 0,
    returnResponse: 0,
    flowIn: 0,
    flowOut: 0,
    casingPressure: 0,
    drillPipePressure: 0,
    spp: 0,
    sppPredicted: 0,
    spm: 0,
    mudWeight: 0,
    mudTemp: 0,
    rop: 0,
    hookLoad: 0,
    totalGas: 0,
    torque: 0,
    wellDepth: well.depth,
    bitDepth: well.depth - 28,
    rpm: 0,
    confidenceLevel: 0,
    pumpState: 'Normal',
    condition: '等待接入',
    formation: well.targetLayer || '',
  };
}

function createWellMonitoringSnapshot(well: WellInfo): WellMonitoringSnapshot {
  const initialData = makeInitialData(well);
  return {
    currentData: initialData,
    currentSampleTime: '',
    lastRecordAt: null,
    monitoringStartedAt: null,
    startedSampleTime: null,
    flowHistory: [],
    pressureHistory: [],
    backendDetection: INITIAL_BACKEND_DETECTION,
    historyRecords: [],
    cycleInfo: getCycleInfo(0),
    shutInActive: false,
    shutInStartedAt: null,
    latestWellDepth: initialData.wellDepth,
    latestBitDepth: initialData.bitDepth,
    latestFormation: initialData.formation,
  };
}

function normalizeRealTimeRecord(record: RealTimeRecord, previous: MonitoringData): MonitoringData {
  const flowIn = readNumber(record, ['flowIn', 'inlet_smooth', 'inlet_raw', 'inlet_flow_raw', 'inletFlow', 'inlet_flow', 'pump_flow_in'], previous.flowIn);
  const flowOut = readNumber(record, ['flowOut', 'outlet_smooth', 'outlet_raw', 'outlet_flow_raw', 'outletFlow', 'outlet_flow', 'return_flow'], previous.flowOut);
  const spp = readNumber(record, ['spp', 'standpipe_pressure_mpa', 'spp_mpa', 'standpipePressureMpa'], previous.spp);
  const sppPredicted = readNumber(record, ['sppPredicted', 'spp_predicted_mpa', 'spp_model_mpa', 'predicted_spp_mpa'], previous.sppPredicted || spp);
  const pitVolume = readNumber(record, ['pitVolume', 'pool_smooth', 'pool_raw', 'total_pit_volume_m3', 'pit_volume', 'totalPitVolumeM3'], previous.pitVolume);
  const derivedPitGain = Number.isFinite(pitVolume) && Number.isFinite(previous.pitVolume) ? pitVolume - previous.pitVolume : previous.pitGain;
  const pitGain = readNumber(record, ['pitGain', 'pool_delta_abs', 'gain_loss_raw', 'pit_gain_m3', 'pitGainM3'], derivedPitGain);
  const derivedReturnResponse = flowOut > 0 && flowIn > 0 ? ((flowOut - flowIn) / Math.max(flowIn, 1)) * 100 : 0;
  const returnResponse = Math.max(0, readNumber(record, ['returnResponse', 'outlet_delta_pct', 'return_response_pct'], derivedReturnResponse));
  const casingPressure = readNumber(
    record,
    ['casingPressure', 'cp', 'casing_pressure_mpa', 'casingPressureMpa', 'logging_casing_pressure_mpa', 'measured_casing_pressure_mpa'],
    previous.casingPressure,
  );

  return {
    pitGain,
    pitVolume,
    returnResponse,
    flowIn,
    flowOut,
    casingPressure,
    drillPipePressure: readNumber(record, ['drillPipePressure', 'standpipe_pressure_mpa', 'spp_mpa'], spp),
    spp,
    sppPredicted,
    spm: readNumber(record, ['spm', 'pump_spm_total', 'pumpSpmTotal', 'pump_spm'], previous.spm),
    mudWeight: readNumber(record, ['mudWeight', 'inlet_density_g_cm3', 'mud_weight'], previous.mudWeight),
    mudTemp: readNumber(record, ['mudTemp', 'inlet_temperature_c', 'outlet_temperature_c'], previous.mudTemp),
    rop: readNumber(record, ['rop', 'rate_of_penetration', 'rop_m_h'], previous.rop),
    hookLoad: readNumber(record, ['hookLoad', 'hookLoadKn', 'hook_load_kn'], previous.hookLoad),
    totalGas: readNumber(record, ['totalGas', 'gas', 'total_gas_pct', 'gas_pct'], previous.totalGas),
    torque: readNumber(record, ['torque', 'torque_knm'], previous.torque),
    wellDepth: readNumber(record, ['wellDepth', 'well_depth', 'well_depth_m', 'holeDepth', 'hole_depth', 'hole_depth_m', 'measuredDepth', 'measured_depth', 'measured_depth_m', 'currentDepth', 'current_depth', 'depth', '井深'], previous.wellDepth ?? previous.bitDepth),
    bitDepth: readNumber(record, ['bitDepth', 'bit_depth', 'bit_depth_m', 'bitPosition', 'bit_position', 'bit_position_m', '钻头位置'], previous.bitDepth),
    rpm: readNumber(record, ['rpm', 'rotary_rpm'], previous.rpm),
    confidenceLevel: readNumber(record, ['confidenceLevel', 'formal_eval_level', 'public_level', 'confidence_level'], previous.confidenceLevel),
    pumpState: String(record.pumpState || record.pump_state || previous.pumpState || 'Normal'),
    condition: String(record.condition || previous.condition || '实时检测'),
    formation: readString(record, ['formation', 'formation_name', 'layer', 'layer_name', 'stratum', 'stratum_name', 'horizon', 'horizon_name', 'lithology', 'block_name', '层位'], previous.formation || ''),
  };
}

function parseCycleState(value: unknown): CycleState | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 0 && rounded <= 5 ? rounded as CycleState : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parseCycleState(parsed);
  }
  return null;
}

function buildRealtimeApiUrl(endpoint: string, path: string) {
  const base = endpoint.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${base}${suffix}`, window.location.origin).toString();
}

function buildRealtimeStreamUrl(endpoint: string, wellId: string, startTime: string, rateMs: number) {
    const url = new URL(buildRealtimeApiUrl(endpoint, `/wells/${encodeURIComponent(wellId)}/stream`));
    url.searchParams.set('rateMs', String(rateMs));
    if (startTime) url.searchParams.set('startTime', startTime);
    return appendAccessToken(url.toString());
}

const INITIAL_BACKEND_DETECTION: BackendDetectionState = {
  publicLevel: 0,
  formalEvalLevel: 0,
  reason: '',
  activeSignals: [],
  eventState: 'normal',
  pumpState: 'Unknown',
  timestamp: '',
  eventId: null,
  baselineValid: false,
  baselineWarmup: true,
  monitoringReady: false,
  baselineCount: 0,
  baselineSource: '',
  baselineSelection: '',
  baselineStartTime: '',
  baselineEndTime: '',
  baselineInvalidReason: '',
};

function normalizeBackendLevel(value: unknown): BackendLevel {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(4, Math.round(numeric))) as BackendLevel;
}

function backendLevelToStatus(level: BackendLevel): AlertStatus {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}

function parseActiveSignals(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayAlarmText(value: unknown) {
  return String(value || '')
    .replace(/返出响应/g, '出口流量响应')
    .replace(/返出/g, '出口流量')
    .replace(/流量差分/g, '出口流量');
}

interface BackendLogEntry {
  eventId: string;
  publicLevel: BackendLevel;
  formalEvalLevel: BackendLevel;
  reason: string;
  activeSignals: string[];
  eventState: string;
  pumpState: string;
  timestamp: string;
  startTime?: string;
  endTime?: string;
  sampleCount?: number;
}

function normalizeBackendLogEntries(record: RealTimeRecord): BackendLogEntry[] {
  const rawEntriesValue = readValue(record as Record<string, unknown>, ['log_entries', 'logEntries']);
  const rawEntries = Array.isArray(rawEntriesValue) ? rawEntriesValue : [];
  return rawEntries.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const publicLevel = normalizeBackendLevel(
      readValue(row, ['public_level', 'publicLevel', 'level', 'formal_eval_level', 'formalEvalLevel']),
    );
    const timestamp = String(readValue(row, ['timestamp']) ?? record.timestamp ?? record.sampleTime ?? record.sample_time ?? '');
    const eventId = String(readValue(row, ['event_id', 'eventId']) ?? `${timestamp || 'frame'}-${readValue(row, ['frame']) ?? index}-${publicLevel}`);
    const eventState = String(readValue(row, ['event_state', 'eventState']) || (publicLevel >= 4 ? 'confirmed' : publicLevel >= 2 ? 'tracking' : publicLevel === 1 ? 'recovering' : 'normal'));
    const shouldKeep = publicLevel >= 2 || eventState === 'recovering' || eventState === 'normal';
    if (!shouldKeep) return [];
    return [{
      eventId,
      publicLevel,
      formalEvalLevel: normalizeBackendLevel(readValue(row, ['formal_eval_level', 'formalEvalLevel']) ?? publicLevel),
      reason: displayAlarmText(readValue(row, ['reason']) || `实时判级 L${publicLevel}`),
      activeSignals: parseActiveSignals(readValue(row, ['active_signals', 'activeSignals'])),
      eventState,
      pumpState: String(readValue(row, ['pump_state', 'pumpState']) || record.pump_state || record.pumpState || 'Unknown'),
      timestamp,
      startTime: String(readValue(row, ['start_time', 'startTime']) || ''),
      endTime: String(readValue(row, ['end_time', 'endTime']) || ''),
      sampleCount: finite(readValue(row, ['sample_count', 'sampleCount']), 0) || undefined,
    }];
  });
}

function backendEventKey(entry: BackendLogEntry) {
  return `${entry.eventId}:${entry.startTime || entry.timestamp || ''}`;
}

function normalizeBackendDetection(record: RealTimeRecord): BackendDetectionState {
  const source = record as Record<string, unknown>;
  const logs = normalizeBackendLogEntries(record);
  const latestLog = logs.at(-1);
  const publicLevel = normalizeBackendLevel(
    readValue(source, ['public_level', 'publicLevel', 'formal_eval_level', 'formalEvalLevel', 'confidence_level', 'confidenceLevel'])
      ?? latestLog?.publicLevel,
  );
  const formalEvalLevel = normalizeBackendLevel(
    readValue(source, ['formal_eval_level', 'formalEvalLevel']) ?? latestLog?.formalEvalLevel ?? publicLevel,
  );
  const timestamp = String(readValue(source, ['timestamp', 'sampleTime', 'sample_time']) || latestLog?.timestamp || '');
  const activeSignals = parseActiveSignals(readValue(source, ['active_signals', 'activeSignals']));
  const baselines = (readValue(source, ['baselines']) as Record<string, unknown> | undefined) ?? undefined;
  const frameEventIdValue = readValue(source, ['event_id', 'eventId']);
  const frameEventId = frameEventIdValue === undefined || frameEventIdValue === null || String(frameEventIdValue).trim() === ''
    ? null
    : String(frameEventIdValue);
  const baselineCount = finite(
    readValue(source, ['eval_baseline_count', 'evalBaselineCount'])
      ?? readValue(baselines ?? {}, ['count', 'Count']),
    0,
  );
  const baselineWarmup = readBoolean(readValue(source, ['baseline_warmup', 'baselineWarmup']), false);
  const monitoringReady = readBoolean(readValue(source, ['monitoring_ready', 'monitoringReady']), publicLevel >= 0);
  const baselineValid = readBoolean(readValue(source, ['baseline_valid', 'baselineValid']), baselineCount >= 20);
  const baselineInvalidReason = String(readValue(source, ['baseline_invalid_reason', 'baselineInvalidReason']) || '');
  return {
    publicLevel,
    formalEvalLevel,
    reason: displayAlarmText(readValue(source, ['reason']) || latestLog?.reason || ''),
    activeSignals: activeSignals.length > 0 ? activeSignals : latestLog?.activeSignals || [],
    eventState: String(
      readValue(source, ['event_state', 'eventState'])
        || latestLog?.eventState
        || (publicLevel >= 4 ? 'confirmed' : publicLevel >= 2 ? 'tracking' : publicLevel === 1 ? 'observing' : 'normal'),
    ),
    pumpState: String(readValue(source, ['pump_state', 'pumpState']) || latestLog?.pumpState || 'Unknown'),
    timestamp,
    eventId: latestLog?.eventId || (publicLevel >= 2 ? frameEventId : null),
    baselineValid,
    baselineWarmup,
    monitoringReady,
    baselineCount,
    baselineSource: String(
      readValue(source, ['eval_baseline_source', 'evalBaselineSource'])
        || readValue(baselines ?? {}, ['source', 'Source'])
        || '',
    ),
    baselineSelection: String(
      readValue(source, ['eval_baseline_selection', 'evalBaselineSelection'])
        || readValue(baselines ?? {}, ['selection', 'Selection'])
        || '',
    ),
    baselineStartTime: String(
      readValue(source, ['eval_baseline_start_time', 'evalBaselineStartTime'])
        || readValue(baselines ?? {}, ['startTime', 'StartTime'])
        || '',
    ),
    baselineEndTime: String(
      readValue(source, ['eval_baseline_end_time', 'evalBaselineEndTime', 'dynamic_baseline_end_time', 'dynamicBaselineEndTime'])
        || readValue(baselines ?? {}, ['endTime', 'EndTime'])
        || '',
    ),
    baselineInvalidReason: baselineInvalidReason || (!baselineValid && !baselineWarmup ? '基线未建立或已失效' : ''),
  };
}

function isMonitorableEventRecord(record: RealTimeRecord, data: MonitoringData) {
  if (record.monitoring_ready === false || record.monitoringReady === false) return false;
  if (record.baseline_warmup === true || record.baselineWarmup === true) return false;
  return true;
}

function normalizeRealtimeWell(item: unknown): WellInfo | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const key = String(row.key || row.well_key || row.wellId || row.well_id || row.tableName || row.table_name || '').trim();
  if (!key) return null;
  const recordCount = finite(row.recordCount ?? row.record_count ?? row.realtimeRowCount ?? row.realtime_row_count ?? row.frameCount ?? row.frame_count, 0);
  const depth = finite(
    row.depth
    ?? row.depth_m
    ?? row.depthMaxM
    ?? row.depth_max_m
    ?? row.registeredDepthMax
    ?? row.registered_depth_max
    ?? row.depthMinM
    ?? row.depth_min_m,
    4200,
  );
  const wellName = String(row.wellName || row.well_name_std || row.well_name_raw || row.name || key).trim();
  const blockName = String(row.blockName || row.block_name || '').trim();
  const targetLayer = String(
    row.targetLayer
    || row.target_layer
    || row.formation
    || row.formation_name
    || row.layer
    || row.layer_name
    || '',
  ).trim();
  return {
    wellId: key,
    wellName,
    block: blockName ? `${blockName} · MySQL` : '实时监测井 · MySQL',
    depth,
    crew: recordCount > 0 ? `${recordCount.toLocaleString('zh-CN')} 条记录` : '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
    startTime: String(row.startTime || row.start_time || row.sampleStartTime || row.sample_start_time || ''),
    endTime: String(row.endTime || row.end_time || row.sampleEndTime || row.sample_end_time || ''),
    discoveryTime: String(row.discoveryTime || row.discovery_time || row.sampleStartTime || row.sample_start_time || ''),
    wellNameStd: String(row.wellNameStd || row.well_name_std || wellName || ''),
    wellNameRaw: String(row.wellNameRaw || row.well_name_raw || wellName || ''),
    blockName,
    targetLayer,
    depthMinM: Number.isFinite(Number(row.depthMinM ?? row.depth_min_m)) ? Number(row.depthMinM ?? row.depth_min_m) : undefined,
    depthMaxM: Number.isFinite(Number(row.depthMaxM ?? row.depth_max_m ?? row.registeredDepthMax ?? row.registered_depth_max))
      ? Number(row.depthMaxM ?? row.depth_max_m ?? row.registeredDepthMax ?? row.registered_depth_max)
      : undefined,
    qualityGrade: String(row.qualityGrade || row.quality_grade || 'UNKNOWN'),
    recordCount,
    realtimeTableName: String(row.realtimeTableName || row.realtime_table_name || row.tableName || row.table_name || ''),
    sampleStartTime: String(row.sampleStartTime || row.sample_start_time || ''),
    sampleEndTime: String(row.sampleEndTime || row.sample_end_time || ''),
  };
}

class SseDetectionDataSourceAdapter implements DataSourceAdapter {
  private stream: EventSource | null = null;
  private recordCallback: (record: RealTimeRecord) => void = () => {};
  private statusCallback: (state: DataSourceState) => void = () => {};
  private recordCount = 0;
  private lastSampleTime: string | null = null;
  private closedByClient = false;

  constructor(private endpoint: string, private startTime: string, private rateMs = 1200) {}

  connect(well: WellInfo) {
    this.disconnect();
    this.closedByClient = false;
    this.recordCount = 0;
    this.lastSampleTime = null;

    if (typeof EventSource === 'undefined') {
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'error',
        endpoint: this.endpoint,
        message: '当前浏览器不支持 SSE 流式接口',
        lastRecordAt: null,
        recordCount: 0,
      });
      return;
    }

    const url = buildRealtimeStreamUrl(this.endpoint, well.wellId, this.startTime || well.discoveryTime || well.startTime || '', this.rateMs);
    this.emitStatus({
      mode: 'realtime',
      adapterName: 'V7 实时检测流',
      status: 'connecting',
      endpoint: url,
      message: `正在建立 ${well.wellName} 实时检测流`,
      lastRecordAt: null,
      recordCount: 0,
    });

    try {
      this.stream = new EventSource(url, { withCredentials: true });
    } catch {
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'error',
        endpoint: url,
        message: '检测流地址无效',
        lastRecordAt: null,
        recordCount: 0,
      });
      return;
    }

    this.stream.addEventListener('start', () => {
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'connecting',
        endpoint: url,
        message: '正在按起始时间计算检测窗口',
        lastRecordAt: null,
        recordCount: this.recordCount,
      });
    });

    this.stream.addEventListener('init', (event) => {
      const data = JSON.parse((event as MessageEvent).data || '{}');
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'connected',
        endpoint: url,
        message: `检测流已接入 · 起始 ${data.start_time || this.startTime || '--'}`,
        lastRecordAt: null,
        recordCount: this.recordCount,
      });
    });

    this.stream.addEventListener('frame', (event) => {
      const frame = JSON.parse((event as MessageEvent).data || '{}') as RealTimeRecord;
      const sampleTime = String(frame.timestamp || frame.sampleTime || frame.sample_time || '');
      if (sampleTime) this.lastSampleTime = sampleTime;
      this.recordCount += 1;
      this.recordCallback(frame);
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'connected',
        endpoint: url,
        message: `检测流推送中 · ${well.wellName} · ${this.recordCount} 帧`,
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
      });
    });

    this.stream.addEventListener('done', () => {
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'paused',
        endpoint: url,
        message: `检测窗口推送完成 · ${this.recordCount} 帧`,
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
      });
      this.disconnect();
    });

    this.stream.addEventListener('error', (event) => {
      const data = (() => {
        try {
          return JSON.parse((event as MessageEvent).data || '{}');
        } catch {
          return {};
        }
      })() as { error?: string };
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 实时检测流',
        status: 'error',
        endpoint: url,
        message: data.error || '检测流连接中断，请检查接口和 MySQL',
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
      });
      this.disconnect();
    });
  }

  disconnect() {
    this.closedByClient = true;
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
  }

  onRecord(callback: (record: RealTimeRecord) => void) {
    this.recordCallback = callback;
  }

  onStatus(callback: (state: DataSourceState) => void) {
    this.statusCallback = callback;
  }

  private emitStatus(state: DataSourceState) {
    if (this.closedByClient && state.status === 'error') return;
    this.statusCallback(state);
  }
}

class PreviewPollingDataSourceAdapter implements DataSourceAdapter {
  private recordCallback: (record: RealTimeRecord) => void = () => {};
  private statusCallback: (state: DataSourceState) => void = () => {};
  private controller: AbortController | null = null;
  private fetchTimer: number | null = null;
  private replayTimer: number | null = null;
  private queue: RealTimeRecord[] = [];
  private recordCount = 0;
  private lastSampleTime: string | null = null;
  private closedByClient = false;
  private fetching = false;
  private previewUrl: string | null = null;
  private cursorStartTime = '';
  private started = false;
  private well: WellInfo | null = null;
  private accessToken = '';

  constructor(
    private endpoint: string,
    private startTime: string,
    private rateMs = 1200,
    private batchLimit = PREVIEW_BATCH_LIMIT,
    private idlePollMs = PREVIEW_IDLE_POLL_MS,
    private fallbackReason = '',
  ) {}

  connect(well: WellInfo) {
    this.disconnect();
    this.closedByClient = false;
    this.recordCount = 0;
    this.lastSampleTime = null;
    this.started = false;
    this.queue = [];
    this.fetching = false;
    this.well = well;
    this.accessToken = getAccessToken();
    this.previewUrl = buildRealtimeApiUrl(this.endpoint, `/wells/${encodeURIComponent(well.wellId)}`);
    this.cursorStartTime = normalizeSampleTime(this.startTime || well.discoveryTime || well.startTime || '');
    this.emitStatus({
      mode: 'realtime',
      adapterName: 'V7 预览回放',
      status: 'connecting',
      endpoint: this.previewUrl,
      message: this.fallbackReason
        ? `${this.fallbackReason}，正在切换预览回放`
        : `正在建立 ${well.wellName} 预览回放`,
      lastRecordAt: null,
      recordCount: 0,
    });
    void this.fetchNextBatch(true);
  }

  disconnect() {
    this.closedByClient = true;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    if (this.fetchTimer !== null) {
      window.clearTimeout(this.fetchTimer);
      this.fetchTimer = null;
    }
    if (this.replayTimer !== null) {
      window.clearTimeout(this.replayTimer);
      this.replayTimer = null;
    }
    this.queue = [];
    this.fetching = false;
    this.well = null;
  }

  onRecord(callback: (record: RealTimeRecord) => void) {
    this.recordCallback = callback;
  }

  onStatus(callback: (state: DataSourceState) => void) {
    this.statusCallback = callback;
  }

  private scheduleFetch(delayMs: number) {
    if (this.closedByClient || this.fetchTimer !== null) return;
    this.fetchTimer = window.setTimeout(() => {
      this.fetchTimer = null;
      void this.fetchNextBatch();
    }, Math.max(0, delayMs));
  }

  private async fetchNextBatch(initial = false) {
    if (this.closedByClient || this.fetching || !this.well || !this.previewUrl) return;
    this.fetching = true;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const url = new URL(this.previewUrl, window.location.origin);
    url.searchParams.set('limit', String(this.batchLimit));
    if (this.cursorStartTime) url.searchParams.set('startTime', this.cursorStartTime);
    if (this.accessToken) url.searchParams.set('access_token', this.accessToken);

    try {
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        signal: controller.signal,
        credentials: 'same-origin',
        headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : undefined,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as {
        frames?: RealTimeRecord[];
        realtimeEngine?: { startTime?: string; endTime?: string; mode?: string };
      };
      if (controller.signal.aborted || this.closedByClient) return;

      const frames = Array.isArray(data.frames) ? data.frames : [];
      const freshFrames = frames.filter((frame) => {
        const sampleTime = normalizeSampleTime(sampleTimeFromRecord(frame));
        if (!sampleTime) return true;
        return isStrictlyNewerSampleTime(sampleTime, this.lastSampleTime);
      });
      const engineStart = normalizeSampleTime(String(data.realtimeEngine?.startTime || this.cursorStartTime || this.startTime || ''));

      if (freshFrames.length === 0) {
        this.emitStatus({
          mode: 'realtime',
          adapterName: 'V7 预览回放',
          status: this.recordCount > 0 ? 'connected' : 'connecting',
          endpoint: url.toString(),
          message: this.recordCount > 0
            ? `预览轮询待新点 · ${this.well.wellName} · ${this.recordCount} 帧`
            : `预览回放待命 · 起始 ${engineStart ? formatRecordTime(engineStart).timeStr : '--'}`,
          lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
          recordCount: this.recordCount,
        });
        this.scheduleFetch(initial ? Math.max(1500, Math.min(this.idlePollMs, this.rateMs * 2)) : this.idlePollMs);
        return;
      }

      if (!this.started) {
        this.started = true;
        this.emitStatus({
          mode: 'realtime',
          adapterName: 'V7 预览回放',
          status: 'connected',
          endpoint: url.toString(),
          message: `已切换预览回放 · 起始 ${engineStart ? formatRecordTime(engineStart).timeStr : '--'}`,
          lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
          recordCount: this.recordCount,
        });
      }

      this.queue.push(...freshFrames);
      const lastQueuedTime = normalizeSampleTime(sampleTimeFromRecord(freshFrames.at(-1)));
      if (lastQueuedTime) {
        this.cursorStartTime = nextPreviewCursorFrom(lastQueuedTime) || lastQueuedTime;
      }
      this.drainQueue();
    } catch (error) {
      if (controller.signal.aborted || this.closedByClient) return;
      const message = error instanceof Error ? error.message : '未知错误';
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 预览回放',
        status: 'error',
        endpoint: this.previewUrl,
        message: `预览回放失败：${message}`,
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
      });
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
      this.fetching = false;
    }
  }

  private drainQueue() {
    if (this.closedByClient || this.replayTimer !== null) return;

    const emitNext = () => {
      this.replayTimer = null;
      if (this.closedByClient) return;
      const frame = this.queue.shift();
      if (!frame) {
        this.scheduleFetch(this.idlePollMs);
        return;
      }

      const sampleTime = normalizeSampleTime(sampleTimeFromRecord(frame));
      if (sampleTime) this.lastSampleTime = sampleTime;
      this.recordCount += 1;
      this.recordCallback(frame);
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 预览回放',
        status: 'connected',
        endpoint: this.previewUrl,
        message: `预览回放中 · ${this.well?.wellName || ''} · ${this.recordCount} 帧`,
        lastRecordAt: sampleTime ? formatRecordDateTime(sampleTime) : null,
        recordCount: this.recordCount,
      });

      if (this.queue.length > 0) {
        this.replayTimer = window.setTimeout(emitNext, this.rateMs);
      } else {
        this.scheduleFetch(this.idlePollMs);
      }
    };

    this.replayTimer = window.setTimeout(emitNext, this.recordCount === 0 ? 0 : this.rateMs);
  }

  private emitStatus(state: DataSourceState) {
    if (this.closedByClient && state.status === 'error') return;
    this.statusCallback(state);
  }
}

class ResilientRealtimeDataSourceAdapter implements DataSourceAdapter {
  private recordCallback: (record: RealTimeRecord) => void = () => {};
  private statusCallback: (state: DataSourceState) => void = () => {};
  private activeAdapter: DataSourceAdapter | null = null;
  private activeWell: WellInfo | null = null;
  private seedData: MonitoringData | null = null;
  private closedByClient = false;
  private totalRecordCount = 0;
  private lastSampleTime: string | null = null;
  private fallbackActivated = false;
  private connectWatchdog: number | null = null;

  constructor(
    private endpoint: string,
    private startTime: string,
    private rateMs = 1200,
    private connectTimeoutMs = STREAM_CONNECT_TIMEOUT_MS,
  ) {}

  connect(well: WellInfo, seed: MonitoringData) {
    this.disconnect();
    this.closedByClient = false;
    this.activeWell = well;
    this.seedData = seed;
    this.totalRecordCount = 0;
    this.lastSampleTime = null;
    this.fallbackActivated = false;
    this.startSse();
  }

  disconnect() {
    this.closedByClient = true;
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
    this.activeAdapter?.disconnect();
    this.activeAdapter = null;
    this.activeWell = null;
    this.seedData = null;
  }

  onRecord(callback: (record: RealTimeRecord) => void) {
    this.recordCallback = callback;
  }

  onStatus(callback: (state: DataSourceState) => void) {
    this.statusCallback = callback;
  }

  private startSse() {
    if (!this.activeWell || !this.seedData) return;
    const adapter = new SseDetectionDataSourceAdapter(this.endpoint, this.startTime, this.rateMs);
    this.activeAdapter = adapter;
    this.bindAdapter(adapter, false);
    this.armWatchdog();
    adapter.connect(this.activeWell, this.seedData);
  }

  private bindAdapter(adapter: DataSourceAdapter, isFallback: boolean) {
    adapter.onRecord((record) => {
      if (this.closedByClient) return;
      const sampleTime = normalizeSampleTime(sampleTimeFromRecord(record));
      if (sampleTime) this.lastSampleTime = sampleTime;
      this.totalRecordCount += 1;
      if (!isFallback && this.connectWatchdog !== null) {
        window.clearTimeout(this.connectWatchdog);
        this.connectWatchdog = null;
      }
      this.recordCallback(record);
    });

    adapter.onStatus((state) => {
      if (this.closedByClient) return;
      const adjustedState: DataSourceState = {
        ...state,
        recordCount: Math.max(state.recordCount || 0, this.totalRecordCount),
        lastRecordAt: state.lastRecordAt || (this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null),
      };

      if (!isFallback && !this.fallbackActivated) {
        const shouldFallback = state.status === 'error' || (state.status === 'paused' && this.totalRecordCount === 0);
        if (shouldFallback) {
          this.switchToPreview(state.message || '检测流不可用');
          return;
        }
      }

      this.emitStatus(adjustedState);
    });
  }

  private armWatchdog() {
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
    }
    this.connectWatchdog = window.setTimeout(() => {
      this.connectWatchdog = null;
      if (this.closedByClient || this.fallbackActivated || this.totalRecordCount > 0) return;
      this.switchToPreview('检测流长时间未返回事件');
    }, this.connectTimeoutMs);
  }

  private switchToPreview(reason: string) {
    if (this.closedByClient || this.fallbackActivated || !this.activeWell || !this.seedData) return;
    this.fallbackActivated = true;
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
    this.activeAdapter?.disconnect();
    this.emitStatus({
      mode: 'realtime',
      adapterName: 'V7 实时检测流',
      status: 'connecting',
      endpoint: this.endpoint,
      message: `${reason}，正在切换预览回放`,
      lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
      recordCount: this.totalRecordCount,
    });
    const previewStartTime = normalizeSampleTime(this.lastSampleTime || this.startTime || this.activeWell.discoveryTime || this.activeWell.startTime || '');
    const previewAdapter = new PreviewPollingDataSourceAdapter(
      this.endpoint,
      previewStartTime,
      this.rateMs,
      PREVIEW_BATCH_LIMIT,
      PREVIEW_IDLE_POLL_MS,
      reason,
    );
    this.activeAdapter = previewAdapter;
    this.bindAdapter(previewAdapter, true);
    previewAdapter.connect(this.activeWell, this.seedData);
  }

  private emitStatus(state: DataSourceState) {
    if (this.closedByClient && state.status === 'error') return;
    this.statusCallback(state);
  }
}

class DisabledDataSourceAdapter implements DataSourceAdapter {
  private statusCallback: (state: DataSourceState) => void = () => {};

  connect() {
    this.emitStatus({
      mode: 'realtime',
      adapterName: '真实数据接口',
      status: 'error',
      endpoint: null,
      message: '真实接口未配置，请先设置实时地址',
      lastRecordAt: null,
      recordCount: 0,
    });
  }

  disconnect() {}

  onRecord() {}

  onStatus(callback: (state: DataSourceState) => void) {
    this.statusCallback = callback;
  }

  private emitStatus(state: DataSourceState) {
    this.statusCallback(state);
  }
}

function getCycleInfo(totalSeconds: number): CycleInfo {
  const cycleIndex = Math.floor(totalSeconds / TOTAL_CYCLE_SECONDS) + 1;
  const secondInCycle = totalSeconds % TOTAL_CYCLE_SECONDS;
  let cursor = 0;
  let state: CycleState = 0;
  let elapsedInState = 0;
  let totalStateSeconds = CYCLE_DURATIONS[0];

  for (let index = 0; index < CYCLE_DURATIONS.length; index += 1) {
    const duration = CYCLE_DURATIONS[index];
    if (secondInCycle < cursor + duration) {
      state = index as CycleState;
      elapsedInState = secondInCycle - cursor;
      totalStateSeconds = duration;
      break;
    }
    cursor += duration;
  }

  const meta = CYCLE_STATES[state];
  const { timeStr } = formatNow();
  return {
    ...meta,
    cycleIndex,
    elapsedInState,
    totalStateSeconds,
    progress: clamp((elapsedInState / totalStateSeconds) * 100, 0, 100),
    tStopPump: state >= 3 ? timeStr : null,
    tStartPump: state >= 4 ? timeStr : null,
    tStable: state >= 5 ? timeStr : null,
  };
}

export function WellControlProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [wells, setWells] = useState<WellInfo[]>(WELLS);
  const { user } = useAuth();
  const hasAccessToken = Boolean(getAccessToken());
  const [selectedWellId, setSelectedWellId] = useState(() => {
    if (typeof window === 'undefined') return WELLS[0].wellId;
    return window.localStorage.getItem(STORAGE_SELECTED_WELL) || WELLS[0].wellId;
  });
  const [monitoredWellIds, setMonitoredWellIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_MONITORED_WELLS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  });
  const [realtimeTabWellIds, setRealtimeTabWellIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_REALTIME_TABS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  });
  const [manualStoppedWellIds, setManualStoppedWellIds] = useState<string[]>(getInitialManualStoppedWellIds);
  const [startOptions, setStartOptions] = useState<RealtimeStartOption[]>([]);
  const [selectedStartFrame, setSelectedStartFrame] = useState(0);
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [currentSampleTime, setCurrentSampleTime] = useState(() => createInitialSelectedViewState(selectedWellId).currentSampleTime);
  const [timeBounds, setTimeBounds] = useState<RealtimeTimeBounds>({
    firstTime: '',
    lastTime: '',
    discoveryTime: '',
    discoveryFrame: 0,
    discoveryRelMin: null,
  });
  const [realtimeEndpoint, setRealtimeEndpoint] = useState(getInitialRealtimeEndpoint);
  const [rawDataSourceState, setRawDataSourceState] = useState<DataSourceState>(() => createInitialDataSourceState(getInitialRealtimeEndpoint()));
  const [wellRuntimeStates, setWellRuntimeStates] = useState<Record<string, WellRuntimeState>>(getInitialWellRuntimeStates);
  const [realtimeWellsLoaded, setRealtimeWellsLoaded] = useState(false);
  const wellSnapshotsRef = useRef<Record<string, WellMonitoringSnapshot>>(getInitialWellSnapshots());
  const wellInfo = wells.find((well) => well.wellId === selectedWellId) || wells[0] || WELLS[0];
  const selectedWellRuntime = wellRuntimeStates[wellInfo?.wellId];
  const [currentData, setCurrentData] = useState<MonitoringData>(() => createInitialSelectedViewState(selectedWellId).currentData);
  const currentDataRef = useRef<MonitoringData>(currentData);
  const [flowHistory, setFlowHistory] = useState<FlowDataPoint[]>(() => createInitialSelectedViewState(selectedWellId).flowHistory);
  const [pressureHistory, setPressureHistory] = useState<PressureDataPoint[]>(() => createInitialSelectedViewState(selectedWellId).pressureHistory);
  const [alerts, setAlerts] = useState<Alert[]>(getInitialAlerts);
  const [acknowledgedEvents, setAcknowledgedEvents] = useState<AcknowledgedEventMap>(getInitialAcknowledgedEvents);
  const [backendDetection, setBackendDetection] = useState<BackendDetectionState>(() => createInitialSelectedViewState(selectedWellId).backendDetection);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(() => createInitialSelectedViewState(selectedWellId).historyRecords);
  const [shutInActive, setShutInActive] = useState(() => createInitialSelectedViewState(selectedWellId).shutInActive);
  const [shutInStartedAt, setShutInStartedAt] = useState<string | null>(() => createInitialSelectedViewState(selectedWellId).shutInStartedAt);
  const alertIdCounter = useRef(Math.max(0, ...alerts.map((alert) => alert.id)) + 1);
  const historyIdCounter = useRef(1);
  const timeCounter = useRef(0);
  const adapterRef = useRef<DataSourceAdapter | null>(null);
  const backgroundAdaptersRef = useRef<Record<string, DataSourceAdapter>>({});
  const backgroundStreamTokensRef = useRef<Record<string, number>>({});
  const startRequestControllersRef = useRef<Record<string, AbortController>>({});
  const startRequestTokensRef = useRef<Record<string, number>>({});
  const autoRestoringWellIdsRef = useRef<Set<string>>(new Set());
  const autoRestoreFailureAtRef = useRef<Record<string, number>>({});
  const runtimePersistTimerRef = useRef<number | null>(null);
  const snapshotPersistTimerRef = useRef<number | null>(null);
  const wellRuntimeStatesRef = useRef(wellRuntimeStates);
  const backendEventIdsRef = useRef<Set<string>>(new Set());
  const backendEventKeysRef = useRef<Set<string>>(new Set());
  const activeEventIdRef = useRef<string | null>(null);
  const selectedWellIdRef = useRef(selectedWellId);
  const acknowledgedEventsRef = useRef<AcknowledgedEventMap>(acknowledgedEvents);
  const [cycleInfo, setCycleInfo] = useState<CycleInfo>(() => createInitialSelectedViewState(selectedWellId).cycleInfo);

  useEffect(() => {
    selectedWellIdRef.current = selectedWellId;
  }, [selectedWellId]);

  const dataSourceState = useMemo<DataSourceState>(() => {
    if (!wellInfo?.wellId) return rawDataSourceState;
    const runtime = selectedWellRuntime;
    const snapshot = wellSnapshotsRef.current[wellInfo.wellId];
    const isManuallyStopped = manualStoppedWellIds.includes(wellInfo.wellId);
    const hasActiveStream = Boolean(backgroundAdaptersRef.current[wellInfo.wellId] || (selectedWellIdRef.current === wellInfo.wellId && adapterRef.current));
    const visibleRecordCount = Math.max(flowHistory.length, historyRecords.length);
    const visibleLastRecordAt = currentSampleTime || flowHistory.at(-1)?.time || historyRecords.at(-1)?.time || null;
    const lastRecordAt = runtime?.lastRecordAt || visibleLastRecordAt || snapshot?.lastRecordAt || snapshot?.currentSampleTime || rawDataSourceState.lastRecordAt || null;
    const recordCount = Math.max(
      runtime?.recordCount ?? 0,
      visibleRecordCount,
      flowHistory.length,
      historyRecords.length,
      snapshot?.historyRecords.length ?? 0,
      rawDataSourceState.recordCount ?? 0,
    );
    const startedSampleTime = runtime?.startedSampleTime || snapshot?.startedSampleTime || '';
    const running = isRuntimeStreamActive(runtime) || hasActiveStream;
    const pausedWithResume = !running && runtime?.shouldAutoRestore !== false && hasWellResumeProgress(runtime, snapshot);
    const pausedWithHistory = !running && !pausedWithResume && (recordCount > 0 || Boolean(lastRecordAt) || Boolean(startedSampleTime));

    if (running) {
      const status = runtime?.status === 'connected'
        ? 'connected'
        : runtime?.status === 'connecting'
          ? 'connecting'
          : (recordCount > 0 || Boolean(lastRecordAt))
            ? 'connected'
            : 'connecting';
      return {
        mode: 'realtime',
        adapterName: rawDataSourceState.adapterName || 'MySQL 实时数据接口',
        status,
        endpoint: rawDataSourceState.endpoint || realtimeEndpoint || null,
        message: runtime?.message
          || (status === 'connected'
            ? `检测流推送中 · ${wellInfo.wellName} · ${recordCount} 帧`
            : `正在续接 ${wellInfo.wellName} 检测流`),
        lastRecordAt,
        recordCount,
      };
    }

    if (isManuallyStopped) {
      return {
        mode: 'realtime',
        adapterName: rawDataSourceState.adapterName || 'MySQL 实时数据接口',
        status: 'paused',
        endpoint: rawDataSourceState.endpoint || realtimeEndpoint || null,
        message: runtime?.message || '监测已停止',
        lastRecordAt,
        recordCount,
      };
    }

    if (pausedWithResume) {
      return {
        mode: 'realtime',
        adapterName: rawDataSourceState.adapterName || 'MySQL 实时数据接口',
        status: 'paused',
        endpoint: rawDataSourceState.endpoint || realtimeEndpoint || null,
        message: runtime?.message || '已恢复上次监测起点，点击继续监测',
        lastRecordAt,
        recordCount,
      };
    }

    if (pausedWithHistory) {
      return {
        mode: 'realtime',
        adapterName: rawDataSourceState.adapterName || 'MySQL 实时数据接口',
        status: 'paused',
        endpoint: rawDataSourceState.endpoint || realtimeEndpoint || null,
        message: runtime?.message || '已保留历史监测点，可按需继续监测',
        lastRecordAt,
        recordCount,
      };
    }

    return rawDataSourceState;
  }, [currentSampleTime, flowHistory, historyRecords, manualStoppedWellIds, rawDataSourceState, realtimeEndpoint, selectedWellRuntime, wellInfo?.wellId]);

  useEffect(() => {
    wellRuntimeStatesRef.current = wellRuntimeStates;
  }, [wellRuntimeStates]);

  useEffect(() => {
    acknowledgedEventsRef.current = acknowledgedEvents;
  }, [acknowledgedEvents]);

  const persistWellSnapshots = useCallback((source: Record<string, WellMonitoringSnapshot> = wellSnapshotsRef.current) => {
    const keepIds = new Set<string>([selectedWellIdRef.current, ...monitoredWellIds, ...realtimeTabWellIds]);
    Object.entries(wellRuntimeStatesRef.current).forEach(([wellId, runtime]) => {
      if (
        runtime?.shouldAutoRestore !== false && (
          runtime?.isRunning ||
          runtime?.status === 'connected' ||
          runtime?.status === 'connecting' ||
          Boolean(runtime?.lastRecordAt) ||
          Boolean(runtime?.startedSampleTime)
        )
      ) keepIds.add(wellId);
    });
    const serialized: Record<string, WellMonitoringSnapshot> = {};
    keepIds.forEach((wellId) => {
      const snapshot = source[wellId];
      if (!snapshot) return;
      if (
        !snapshot.currentSampleTime &&
        !snapshot.lastRecordAt &&
        !snapshot.startedSampleTime &&
        snapshot.flowHistory.length === 0 &&
        snapshot.pressureHistory.length === 0 &&
        snapshot.historyRecords.length === 0
      ) return;
      serialized[wellId] = serializeWellMonitoringSnapshot(snapshot);
    });
    writeStoredJson(STORAGE_WELL_SNAPSHOTS, serialized);
  }, [monitoredWellIds, realtimeTabWellIds]);

  const flushRuntimeStates = useCallback((states?: Record<string, WellRuntimeState>) => {
    writeStoredJson(STORAGE_WELL_RUNTIME_STATES, states ?? wellRuntimeStatesRef.current);
  }, []);

  const flushWellSnapshots = useCallback(() => {
    persistWellSnapshots(wellSnapshotsRef.current);
  }, [persistWellSnapshots]);

  const schedulePersistRuntimeStates = useCallback((states?: Record<string, WellRuntimeState>) => {
    if (typeof window === 'undefined') return;
    if (runtimePersistTimerRef.current !== null) window.clearTimeout(runtimePersistTimerRef.current);
    runtimePersistTimerRef.current = window.setTimeout(() => {
      flushRuntimeStates(states);
      runtimePersistTimerRef.current = null;
    }, RUNTIME_PERSIST_DEBOUNCE_MS);
  }, [flushRuntimeStates]);

  const schedulePersistWellSnapshots = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (snapshotPersistTimerRef.current !== null) window.clearTimeout(snapshotPersistTimerRef.current);
    snapshotPersistTimerRef.current = window.setTimeout(() => {
      flushWellSnapshots();
      snapshotPersistTimerRef.current = null;
    }, SNAPSHOT_PERSIST_DEBOUNCE_MS);
  }, [flushWellSnapshots]);

  const flushAllPersistence = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (runtimePersistTimerRef.current !== null) {
        window.clearTimeout(runtimePersistTimerRef.current);
        runtimePersistTimerRef.current = null;
      }
      if (snapshotPersistTimerRef.current !== null) {
        window.clearTimeout(snapshotPersistTimerRef.current);
        snapshotPersistTimerRef.current = null;
      }
    }
    flushRuntimeStates();
    flushWellSnapshots();
  }, [flushRuntimeStates, flushWellSnapshots]);

  const selectedWellIdsFromUser = useMemo(() => (
    Array.isArray(user?.selectedWellIds) ? user.selectedWellIds.map((item) => String(item).trim()).filter(Boolean) : []
  ), [user?.selectedWellIds]);

  const suppressedAutoRestoreWellIds = useMemo(() => (
    new Set<string>(manualStoppedWellIds)
  ), [manualStoppedWellIds]);

  const runningWellIdsFromUser = useMemo(() => (
    (Array.isArray(user?.runningWellIds) ? user.runningWellIds.map((item) => String(item).trim()).filter(Boolean) : []).filter((wellId) => !suppressedAutoRestoreWellIds.has(wellId))
  ), [suppressedAutoRestoreWellIds, user?.runningWellIds]);

  const locallyRunningWellIds = useMemo(() => (
    Object.entries(wellRuntimeStates)
      .filter(([wellId]) => !suppressedAutoRestoreWellIds.has(wellId))
      .filter(([, runtime]) => runtime?.shouldAutoRestore !== false && (
        runtime?.isRunning ||
        runtime?.status === 'connected' ||
        hasRuntimeResumeProgress(runtime)
      ))
      .map(([wellId]) => wellId)
  ), [suppressedAutoRestoreWellIds, wellRuntimeStates]);

  const snapshotRecoverableWellIds = useMemo(() => (
    Object.entries(wellSnapshotsRef.current)
      .filter(([wellId, snapshot]) => {
        if (suppressedAutoRestoreWellIds.has(wellId)) return false;
        const runtime = wellRuntimeStates[wellId];
        if (!snapshot || runtime?.shouldAutoRestore === false) return false;
        return hasSnapshotResumeProgress(snapshot);
      })
      .map(([wellId]) => wellId)
  ), [suppressedAutoRestoreWellIds, wellRuntimeStates]);

  const restorableWellIds = useMemo(() => (
    Array.from(new Set([...runningWellIdsFromUser, ...locallyRunningWellIds, ...snapshotRecoverableWellIds]))
  ), [locallyRunningWellIds, runningWellIdsFromUser, snapshotRecoverableWellIds]);

  const getWellSnapshot = useCallback((well: WellInfo) => {
    const existing = wellSnapshotsRef.current[well.wellId];
    if (existing) return existing;
    const created = createWellMonitoringSnapshot(well);
    wellSnapshotsRef.current[well.wellId] = created;
    return created;
  }, []);

  const getResumeSampleTime = useCallback((well: WellInfo, runtime?: WellRuntimeState) => {
    const snapshot = getWellSnapshot(well);
    return runtime?.lastRecordAt || snapshot.lastRecordAt || snapshot.currentSampleTime || runtime?.startedSampleTime || snapshot.startedSampleTime || well.discoveryTime || well.startTime || '';
  }, [getWellSnapshot]);

  const setWellSnapshot = useCallback((wellId: string, patch: Partial<WellMonitoringSnapshot>) => {
    const nextWell = wells.find((well) => well.wellId === wellId) || wellInfo;
    const previous = wellSnapshotsRef.current[wellId] || createWellMonitoringSnapshot(nextWell);
    wellSnapshotsRef.current[wellId] = { ...previous, ...patch };
    schedulePersistWellSnapshots();
  }, [schedulePersistWellSnapshots, wellInfo, wells]);

  const hydrateWellView = useCallback((well: WellInfo) => {
    const snapshot = getWellSnapshot(well);
    historyIdCounter.current = Math.max(historyIdCounter.current, (snapshot.historyRecords.at(-1)?.id || 0) + 1);
    currentDataRef.current = snapshot.currentData;
    setCurrentData(snapshot.currentData);
    setCurrentSampleTime(snapshot.currentSampleTime);
    setFlowHistory(snapshot.flowHistory);
    setPressureHistory(snapshot.pressureHistory);
    setBackendDetection(snapshot.backendDetection);
    setHistoryRecords(snapshot.historyRecords);
    setCycleInfo(snapshot.cycleInfo);
    setShutInActive(snapshot.shutInActive);
    setShutInStartedAt(snapshot.shutInStartedAt);
  }, [getWellSnapshot]);

  useEffect(() => {
    if (!wellInfo?.wellId) return;
    hydrateWellView(wellInfo);
  }, [hydrateWellView, wellInfo?.wellId]);

  const selectedWellView: SelectedWellViewState = (() => {
    const snapshot = wellInfo?.wellId ? wellSnapshotsRef.current[wellInfo.wellId] : undefined;
    const visibleHasSeries = flowHistory.length > 0 || pressureHistory.length > 0 || historyRecords.length > 0;
    const visibleHasProgress = visibleHasSeries || Boolean(currentSampleTime);
    const snapshotHasProgress = hasSnapshotResumeProgress(snapshot);
    const fromSnapshotFallback = !visibleHasProgress && snapshotHasProgress;
    return {
      currentData: fromSnapshotFallback ? (snapshot?.currentData || currentData) : currentData,
      currentSampleTime: currentSampleTime || snapshot?.currentSampleTime || snapshot?.lastRecordAt || '',
      flowHistory: flowHistory.length > 0 ? flowHistory : (snapshot?.flowHistory || []),
      pressureHistory: pressureHistory.length > 0 ? pressureHistory : (snapshot?.pressureHistory || []),
      backendDetection: visibleHasProgress ? backendDetection : (snapshot?.backendDetection || backendDetection),
      historyRecords: historyRecords.length > 0 ? historyRecords : (snapshot?.historyRecords || []),
      cycleInfo: visibleHasProgress ? cycleInfo : (snapshot?.cycleInfo || cycleInfo),
      shutInActive: fromSnapshotFallback ? (snapshot?.shutInActive ?? shutInActive) : shutInActive,
      shutInStartedAt: shutInStartedAt || snapshot?.shutInStartedAt || null,
      latestWellDepth: selectedWellRuntime?.latestWellDepth ?? snapshot?.latestWellDepth ?? currentData.wellDepth,
      latestBitDepth: selectedWellRuntime?.latestBitDepth ?? snapshot?.latestBitDepth ?? currentData.bitDepth,
      latestFormation: selectedWellRuntime?.latestFormation ?? snapshot?.latestFormation ?? currentData.formation,
      fromSnapshotFallback,
    };
  })();
  const selectedWellManuallyStopped = selectedWellId ? suppressedAutoRestoreWellIds.has(selectedWellId) : false;
  const isWellManuallyStopped = useCallback((wellId: string) => suppressedAutoRestoreWellIds.has(wellId), [suppressedAutoRestoreWellIds]);

  const alertStatus = backendLevelToStatus(backendDetection.publicLevel);
  const baselineInfo = useMemo<BaselineInfo>(() => {
    const totalCycles = Math.max(historyRecords.length, backendDetection.baselineCount);
    const acceptedCycleCount = backendDetection.baselineCount;
    const frozenCycles = Math.max(0, historyRecords.filter((record) => record.backendLevel >= 4).length);
    const coverageBase = backendDetection.baselineValid
      ? 100
      : (acceptedCycleCount / Math.max(thresholds.coldStartCycleCount, 1)) * 100;
    const qualityPenalty = totalCycles > 0 ? (frozenCycles / Math.max(totalCycles, 1)) * 100 : 0;
    const isColdStart = backendDetection.baselineWarmup || !backendDetection.baselineValid;
    return {
      totalCycles,
      qualifiedCycles: acceptedCycleCount,
      frozenCycles,
      acceptedCycleCount,
      isColdStart,
      coldStartRemaining: Math.max(0, thresholds.coldStartCycleCount - acceptedCycleCount),
      qualityScore: clamp(coverageBase - qualityPenalty * 0.6, 0, 100),
      templateCoverage: clamp(coverageBase, 0, 100),
      lastResetReason: backendDetection.baselineInvalidReason || (isColdStart ? '等待后端基线状态稳定' : null),
      lastResetTime: backendDetection.baselineEndTime || null,
    };
  }, [backendDetection, historyRecords, thresholds.coldStartCycleCount]);

  const updateWellRuntime = useCallback((wellId: string, patch: Partial<WellRuntimeState>) => {
    setWellRuntimeStates((prev) => {
      const now = new Date().toISOString();
      return {
        ...prev,
        [wellId]: {
          wellId,
          status: 'paused',
          isRunning: false,
          recordCount: 0,
          lastRecordAt: null,
          backendLevel: 0,
          latestWellDepth: undefined,
          latestBitDepth: undefined,
          latestFormation: undefined,
          monitoringStartedAt: null,
          startedSampleTime: null,
          message: '待启动',
          ...prev[wellId],
          ...patch,
          updatedAt: now,
          shouldAutoRestore: patch.shouldAutoRestore ?? prev[wellId]?.shouldAutoRestore,
        },
      };
    });
  }, []);

  const clearWellAlertState = useCallback((wellId: string) => {
    const prefix = `${wellId}:`;
    setAlerts((prev) => prev.filter((alert) => alert.wellId !== wellId));
    setAcknowledgedEvents((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(prefix)) delete next[key];
      });
      acknowledgedEventsRef.current = next;
      return next;
    });
    Array.from(backendEventIdsRef.current).forEach((key) => {
      if (key.startsWith(prefix)) backendEventIdsRef.current.delete(key);
    });
    Array.from(backendEventKeysRef.current).forEach((key) => {
      if (key.startsWith(prefix)) backendEventKeysRef.current.delete(key);
    });
  }, []);

  const appendAlertsFromRecord = useCallback((well: WellInfo, record: RealTimeRecord, data: MonitoringData) => {
    const backendLogs = normalizeBackendLogEntries(record);
    if (backendLogs.length === 0) return;
    setAlerts((previous) => {
      let nextAlerts = previous;
      const additions: Alert[] = [];
      backendLogs.forEach((entry) => {
        if (!entry.eventId || !(entry.startTime || entry.timestamp)) return;
        const eventKey = `${well.wellId}:${backendEventKey(entry)}`;
        const eventInstanceId = `${well.wellId}:${entry.eventId}`;
        const eventTime = formatRecordTime(entry.timestamp || record.timestamp);
        const existingIndex = nextAlerts.findIndex((alert) => alert.backendEventId === eventKey);
        if (existingIndex >= 0) {
          nextAlerts = nextAlerts.map((alert, index) => index === existingIndex ? {
            ...alert,
            level: entry.publicLevel >= 4 ? 'critical' as const : entry.publicLevel >= 2 ? 'warning' as const : 'info' as const,
            message: entry.reason || alert.message,
            time: eventTime.timeStr,
            date: eventTime.dateStr,
            lastTime: eventTime.timeStr,
            lastDate: eventTime.dateStr,
            count: entry.sampleCount || (alert.count || 1) + 1,
            backendLevel: entry.publicLevel,
            peakBackendLevel: Math.max(alert.peakBackendLevel ?? alert.backendLevel, entry.publicLevel) as BackendLevel,
            formalEvalLevel: entry.formalEvalLevel,
            peakFormalEvalLevel: Math.max(alert.peakFormalEvalLevel ?? alert.formalEvalLevel, entry.formalEvalLevel) as BackendLevel,
            activeSignals: entry.activeSignals,
            eventState: entry.eventState,
            pumpState: entry.pumpState,
          } : alert);
          return;
        }
        if (entry.publicLevel < 2) return;
        if (backendEventIdsRef.current.has(eventInstanceId) || backendEventKeysRef.current.has(eventKey)) return;
        backendEventIdsRef.current.add(eventInstanceId);
        backendEventKeysRef.current.add(eventKey);
        additions.push({
          id: alertIdCounter.current++,
          wellId: well.wellId,
          wellName: well.wellName,
          wellBlock: well.blockName || well.block,
          wellDepth: data.wellDepth ?? well.depth,
          bitDepth: data.bitDepth,
          formation: data.formation || well.targetLayer || undefined,
          time: eventTime.timeStr,
          date: eventTime.dateStr,
          lastTime: eventTime.timeStr,
          lastDate: eventTime.dateStr,
          level: entry.publicLevel >= 4 ? 'critical' as const : 'warning' as const,
          message: entry.reason,
          acknowledged: acknowledgedEventsRef.current[eventKey] === true,
          code: entry.eventId,
          backendEventId: eventKey,
          backendLevel: entry.publicLevel,
          peakBackendLevel: entry.publicLevel,
          formalEvalLevel: entry.formalEvalLevel,
          peakFormalEvalLevel: entry.formalEvalLevel,
          activeSignals: entry.activeSignals,
          eventState: entry.eventState,
          pumpState: entry.pumpState,
          count: entry.sampleCount || 1,
        });
      });
      return additions.length > 0 ? [...additions.reverse(), ...nextAlerts].slice(0, 120) : nextAlerts;
    });
  }, []);

  const syncWellSnapshotFromSample = useCallback((
    well: WellInfo,
    nextData: MonitoringData,
    sampleTime: string,
    backendDetectionState: BackendDetectionState,
    cycleState: CycleInfo,
    flowHistoryItems: FlowDataPoint[],
    pressureHistoryItems: PressureDataPoint[],
    historyItems: HistoryRecord[],
    shutInState?: { active: boolean; startedAt: string | null },
  ) => {
    const previous = wellSnapshotsRef.current[well.wellId] || createWellMonitoringSnapshot(well);
    const runtimeBeforeSync = wellRuntimeStatesRef.current[well.wellId];
    const runtimeStartedSampleTime = wellRuntimeStatesRef.current[well.wellId]?.startedSampleTime;
    wellSnapshotsRef.current[well.wellId] = {
      ...previous,
      currentData: nextData,
      currentSampleTime: sampleTime,
      flowHistory: flowHistoryItems,
      pressureHistory: pressureHistoryItems,
      backendDetection: backendDetectionState,
      historyRecords: historyItems,
      cycleInfo: cycleState,
      shutInActive: shutInState?.active ?? false,
      shutInStartedAt: shutInState?.startedAt ?? null,
      lastRecordAt: sampleTime || previous.lastRecordAt || null,
      monitoringStartedAt: resolveMonitoringStartedAt(
        runtimeBeforeSync,
        previous,
        runtimeStartedSampleTime || previous.startedSampleTime || sampleTime || null,
        sampleTime || previous.lastRecordAt || previous.currentSampleTime || null,
      ),
      startedSampleTime: previous.startedSampleTime || runtimeStartedSampleTime || previous.currentSampleTime || sampleTime || null,
      latestWellDepth: nextData.wellDepth,
      latestBitDepth: nextData.bitDepth,
      latestFormation: nextData.formation,
    };
    schedulePersistWellSnapshots();
    if (well.wellId === selectedWellIdRef.current) {
      currentDataRef.current = nextData;
      setCurrentData(nextData);
      setCurrentSampleTime(sampleTime);
      setFlowHistory(flowHistoryItems);
      setPressureHistory(pressureHistoryItems);
      setBackendDetection(backendDetectionState);
      setHistoryRecords(historyItems);
      setCycleInfo(cycleState);
      setShutInActive(shutInState?.active ?? false);
      setShutInStartedAt(shutInState?.startedAt ?? null);
    }
  }, [schedulePersistWellSnapshots]);

  const resetWellSnapshot = useCallback((well: WellInfo) => {
    wellSnapshotsRef.current[well.wellId] = createWellMonitoringSnapshot(well);
    schedulePersistWellSnapshots();
  }, [schedulePersistWellSnapshots]);

  const stopBackgroundMonitoring = useCallback((wellId: string) => {
    flushAllPersistence();
    backgroundStreamTokensRef.current[wellId] = (backgroundStreamTokensRef.current[wellId] || 0) + 1;
    const adapter = backgroundAdaptersRef.current[wellId];
    if (!adapter) return;
    adapter.disconnect();
    delete backgroundAdaptersRef.current[wellId];
  }, [flushAllPersistence]);

  const startBackgroundMonitoring = useCallback((well: WellInfo, startTime: string, preserveSnapshot = false) => {
    stopBackgroundMonitoring(well.wellId);
    const initialSnapshot = preserveSnapshot ? getWellSnapshot(well) : createWellMonitoringSnapshot(well);
    if (!preserveSnapshot) {
      resetWellSnapshot(well);
    }
    let lastData = initialSnapshot.currentData;
    let flowItems = dedupeMonitoringPoints(sortMonitoringPoints([...initialSnapshot.flowHistory]));
    let pressureItems = dedupeMonitoringPoints(sortMonitoringPoints([...initialSnapshot.pressureHistory]));
    let historyItems = dedupeHistoryRecords([...initialSnapshot.historyRecords]);
    let cycleState = initialSnapshot.cycleInfo;
    let sampleTime = initialSnapshot.currentSampleTime;
    let backendState = initialSnapshot.backendDetection;
    let shutInState = {
      active: initialSnapshot.shutInActive,
      startedAt: initialSnapshot.shutInStartedAt,
    };
    let recordCount = Math.max(0, initialSnapshot.historyRecords.length);
    const streamToken = (backgroundStreamTokensRef.current[well.wellId] || 0) + 1;
    const adapter = new ResilientRealtimeDataSourceAdapter(realtimeEndpoint, startTime, 1200);
    backgroundStreamTokensRef.current[well.wellId] = streamToken;
    const isActiveStream = () => backgroundStreamTokensRef.current[well.wellId] === streamToken && backgroundAdaptersRef.current[well.wellId] === adapter;
    backgroundAdaptersRef.current[well.wellId] = adapter;
    adapter.onStatus((state) => {
      if (!isActiveStream()) return;
      const previousRuntime = wellRuntimeStatesRef.current[well.wellId];
      const snapshotCount = wellSnapshotsRef.current[well.wellId]?.historyRecords.length ?? 0;
      const nextRecordCount = Math.max(previousRuntime?.recordCount ?? 0, snapshotCount, state.recordCount || 0);
      updateWellRuntime(well.wellId, {
        status: state.status,
        isRunning: state.status === 'connected' || state.status === 'connecting',
        shouldAutoRestore: state.status === 'connected' || state.status === 'connecting' ? true : undefined,
        recordCount: nextRecordCount > 0 ? nextRecordCount : undefined,
        lastRecordAt: state.lastRecordAt || previousRuntime?.lastRecordAt,
        message: formatRuntimeFrameMessage(state.message, nextRecordCount),
      });
      if (state.status === 'paused' || state.status === 'error') {
        delete backgroundAdaptersRef.current[well.wellId];
      }
    });
    adapter.onRecord((record) => {
      if (!isActiveStream()) return;
      recordCount += 1;
      lastData = normalizeRealTimeRecord(record, lastData);
      const recordTime = formatRecordTime(record.sampleTime || record.sample_time as string | number | undefined || record.timestamp);
      const timestampMs = recordMillis(record.sampleTime || record.sample_time as string | number | undefined || record.timestamp);
      const nextDetection = normalizeBackendDetection(record);
      const canPaintEvent = isMonitorableEventRecord(record, lastData);
      const recordCycleState = parseCycleState(record.cycleState ?? record.operation_state_std);
      cycleState = recordCycleState === null ? getCycleInfo(recordCount) : {
        ...getCycleInfo(recordCount),
        ...CYCLE_STATES[recordCycleState],
        state: recordCycleState,
      };
      const sampleTimeText = String(record.sampleTime || record.sample_time || record.timestamp || '');
      if (sampleTimeText) sampleTime = sampleTimeText.replace('T', ' ');
      const activeEventId = nextDetection.publicLevel >= 2 && canPaintEvent ? (nextDetection.eventId || null) : null;
      backendState = nextDetection;
      flowItems = keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints([
        ...flowItems,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.publicLevel,
          eventId: activeEventId,
          flowIn: lastData.flowIn,
          flowOut: lastData.flowOut,
          bitDepth: lastData.bitDepth,
          pitGain: lastData.pitGain,
          pitVolume: lastData.pitVolume,
          returnResponse: lastData.returnResponse,
          spm: lastData.spm,
          totalGas: lastData.totalGas,
          hookLoad: lastData.hookLoad,
        },
      ])));
      pressureItems = keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints([
        ...pressureItems,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.publicLevel,
          eventId: activeEventId,
          casingPressure: lastData.casingPressure,
          drillPipePressure: lastData.drillPipePressure,
          spp: lastData.spp,
          sppPredicted: lastData.sppPredicted,
        },
      ])));
      historyItems = dedupeHistoryRecords([
        ...historyItems.slice(-239),
        {
          id: historyItems.at(-1)?.id ? historyItems.at(-1)!.id + 1 : 1,
          time: recordTime.timeStr,
          date: recordTime.dateStr,
          pitGain: lastData.pitGain,
          pitVolume: lastData.pitVolume,
          returnResponse: lastData.returnResponse,
          flowIn: lastData.flowIn,
          flowOut: lastData.flowOut,
          casingPressure: lastData.casingPressure,
          drillPipePressure: lastData.drillPipePressure,
          spp: lastData.spp,
          sppPredicted: lastData.sppPredicted,
          spm: lastData.spm,
          totalGas: lastData.totalGas,
          hookLoad: lastData.hookLoad,
          mudWeight: lastData.mudWeight,
          rop: lastData.rop,
          bitDepth: lastData.bitDepth,
          pumpState: nextDetection.pumpState,
          cycleState: cycleState.state,
          backendLevel: nextDetection.publicLevel,
          baselineValid: nextDetection.baselineValid,
          baselineWarmup: nextDetection.baselineWarmup,
          monitoringReady: nextDetection.monitoringReady,
          baselineCount: nextDetection.baselineCount,
          status: backendLevelToStatus(nextDetection.publicLevel),
        },
      ]);
      updateWellRuntime(well.wellId, {
        status: 'connected',
        isRunning: true,
        shouldAutoRestore: true,
        backendLevel: nextDetection.publicLevel,
        latestWellDepth: lastData.wellDepth,
        latestBitDepth: lastData.bitDepth,
        latestFormation: lastData.formation,
        recordCount,
        lastRecordAt: sampleTime || `${recordTime.dateStr} ${recordTime.timeStr}`,
        message: `检测流推送中 · ${well.wellName} · ${recordCount} 帧`,
      });
      syncWellSnapshotFromSample(well, lastData, sampleTime, backendState, cycleState, flowItems, pressureItems, historyItems, shutInState);
      appendAlertsFromRecord(well, record, lastData);
    });
    adapter.connect(well, lastData);
  }, [appendAlertsFromRecord, getWellSnapshot, realtimeEndpoint, resetWellSnapshot, stopBackgroundMonitoring, syncWellSnapshotFromSample, updateWellRuntime]);

  useEffect(() => () => {
    Object.values(backgroundAdaptersRef.current).forEach((adapter) => adapter.disconnect());
    backgroundAdaptersRef.current = {};
    Object.values(startRequestControllersRef.current).forEach((controller) => controller.abort());
    startRequestControllersRef.current = {};
  }, []);

  useEffect(() => {
    const validIds = new Set(wells.map((well) => well.wellId));
    setMonitoredWellIds((current) => current.filter((wellId) => validIds.has(wellId)));
    setRealtimeTabWellIds((current) => current.filter((wellId) => validIds.has(wellId)));
    setWellRuntimeStates((current) => Object.fromEntries(
      Object.entries(current).filter(([wellId]) => validIds.has(wellId)),
    ));
    setAlerts((current) => current.filter((alert) => !alert.wellId || validIds.has(alert.wellId)));
    setAcknowledgedEvents((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([eventKey]) => {
        const splitIndex = eventKey.indexOf(':');
        return splitIndex > 0 && validIds.has(eventKey.slice(0, splitIndex));
      })) as AcknowledgedEventMap;
      acknowledgedEventsRef.current = next;
      return next;
    });
  }, [wells]);

  useEffect(() => {
    if (!user) return;
    const selected = selectedWellIdsFromUser;
    const running = runningWellIdsFromUser;
    running.forEach((wellId) => {
      const runtime = wellRuntimeStatesRef.current[wellId];
      const snapshot = wellSnapshotsRef.current[wellId];
      const hasResumeProgress = hasWellResumeProgress(runtime, snapshot);
      updateWellRuntime(wellId, {
        status: hasResumeProgress ? 'connecting' : (runtime?.status === 'connected' ? 'connected' : 'paused'),
        isRunning: false,
        shouldAutoRestore: true,
        message: hasResumeProgress
          ? '后端会话运行中，正在恢复检测流'
          : '后端会话运行中，准备接入检测流',
      });
    });
    if (selected.length > 0) {
      setMonitoredWellIds((current) => {
        const next = Array.from(new Set([...running, ...selected, ...current]));
        saveWellListSelection(STORAGE_MONITORED_WELLS, next);
        return next;
      });
      setRealtimeTabWellIds((current) => {
        const next = Array.from(new Set([...selected, ...running, ...current]));
        saveWellListSelection(STORAGE_REALTIME_TABS, next);
        return next;
      });
      setSelectedWellId((current) => {
        const selectable = Array.from(new Set([...selected, ...running]));
        const next = selectable.includes(current)
          ? current
          : selected[0] || running[0] || current;
        saveWellSelection(STORAGE_SELECTED_WELL, next);
        return next;
      });
      return;
    }
    if (running.length > 0) {
      setMonitoredWellIds((current) => {
        const next = Array.from(new Set([...running, ...current]));
        saveWellListSelection(STORAGE_MONITORED_WELLS, next);
        return next;
      });
      setRealtimeTabWellIds((current) => {
        const next = Array.from(new Set([...running, ...current]));
        saveWellListSelection(STORAGE_REALTIME_TABS, next);
        return next;
      });
    }
  }, [runningWellIdsFromUser, selectedWellIdsFromUser, updateWellRuntime, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_SELECTED_WELL, selectedWellId);
  }, [selectedWellId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_MONITORED_WELLS, JSON.stringify(monitoredWellIds));
  }, [monitoredWellIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_REALTIME_TABS, JSON.stringify(realtimeTabWellIds));
  }, [realtimeTabWellIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_MANUAL_STOPPED_WELLS, JSON.stringify(manualStoppedWellIds));
  }, [manualStoppedWellIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_REALTIME_ENDPOINT, realtimeEndpoint);
  }, [hasAccessToken, realtimeEndpoint]);

  useEffect(() => {
    schedulePersistRuntimeStates(wellRuntimeStates);
  }, [schedulePersistRuntimeStates, wellRuntimeStates]);

  useEffect(() => {
    writeStoredJson(STORAGE_ACKNOWLEDGED_EVENTS, acknowledgedEvents);
  }, [acknowledgedEvents]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushAllPersistence();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushAllPersistence();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushAllPersistence();
    };
  }, [flushAllPersistence]);

  useEffect(() => {
    writeStoredJson(STORAGE_ALERT_EVENTS, alerts.slice(0, 120));
  }, [alerts]);

  useEffect(() => {
    if (!hasAccessToken) {
      setRealtimeWellsLoaded(false);
      setRawDataSourceState((prev) => ({
        ...prev,
        status: 'paused',
        message: '登录后读取实时井列表',
      }));
      return;
    }
    const controller = new AbortController();
    setRealtimeWellsLoaded(false);
    setRawDataSourceState((prev) => ({
      ...prev,
      status: 'connecting',
      message: '正在读取实时井列表',
    }));
    authenticatedFetch(buildRealtimeApiUrl(realtimeEndpoint, '/wells'), { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: { wells?: unknown[] }) => {
        if (controller.signal.aborted) return;
        const nextWells = (payload.wells || []).map(normalizeRealtimeWell).filter(Boolean) as WellInfo[];
        setRealtimeWellsLoaded(true);
        if (!nextWells.length) return;
        setWells(nextWells);
        setSelectedWellId((current) => {
          const nextSelected = nextWells.some((well) => well.wellId === current) ? current : nextWells[0].wellId;
          saveWellSelection(STORAGE_SELECTED_WELL, nextSelected);
          return nextSelected;
        });
        setRawDataSourceState((prev) => ({
          ...prev,
          status: 'connecting',
          message: `已读取 ${nextWells.length} 口实时井，等待选择起始时间`,
        }));
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || error.name === 'AbortError') return;
        setRealtimeWellsLoaded(true);
        setRawDataSourceState((prev) => ({
          ...prev,
          status: 'error',
          message: `井列表读取失败：${error.message}`,
        }));
      });
    return () => {
      controller.abort();
    };
  }, [hasAccessToken, realtimeEndpoint]);

  useEffect(() => {
    if (!hasAccessToken) return;
    if (!realtimeWellsLoaded || !wellInfo?.wellId) return;
    const controller = new AbortController();
    const preservedStartTime = selectedWellRuntime?.startedSampleTime ? toDatetimeLocalValue(selectedWellRuntime.startedSampleTime) : '';
    const preserveRunning = Boolean(
      preservedStartTime &&
      selectedWellRuntime?.shouldAutoRestore !== false &&
      (
        selectedWellRuntime?.isRunning ||
        selectedWellRuntime?.status === 'connected' ||
        selectedWellRuntime?.status === 'connecting' ||
        selectedWellRuntime?.lastRecordAt
      ),
    );
    if (!preserveRunning) setIsRunning(false);
    setStartOptions([]);
    setSelectedStartFrame(0);
    setSelectedStartTime(preservedStartTime);
    setTimeBounds({ firstTime: '', lastTime: '', discoveryTime: '', discoveryFrame: 0, discoveryRelMin: null });
    setRawDataSourceState(createInitialDataSourceState(realtimeEndpoint, preservedStartTime));
    authenticatedFetch(buildRealtimeApiUrl(realtimeEndpoint, `/wells/${encodeURIComponent(wellInfo.wellId)}/times?maxOptions=30`), { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const options = buildStartOptionsFromTimeIndex(data);
        const discoveryFrame = finite(data.discovery_frame ?? data.discoveryFrame ?? data.discovery?.frame, 0);
        const firstTime = data.first_time || data.firstTime || data.start_time || data.startTime || options[0]?.timestamp || '';
        const lastTime = data.last_time || data.lastTime || data.end_time || data.endTime || options.at(-1)?.timestamp || '';
        const discoveryTime = data.discovery_time || data.discoveryTime || data.discovery?.timestamp || firstTime;
        setStartOptions(options);
        setTimeBounds({
          firstTime,
          lastTime,
          discoveryTime,
          discoveryFrame,
          discoveryRelMin: data.discovery_rel_min ?? data.discoveryRelMin ?? data.discovery?.rel_min ?? data.discovery?.relMin ?? null,
        });
        if (preservedStartTime) {
          const preservedText = fromDatetimeLocalValue(preservedStartTime);
          const preservedOption = options.find((option) => option.timestamp >= preservedText);
          setSelectedStartFrame(preservedOption?.frame ?? discoveryFrame);
          setSelectedStartTime(preservedStartTime);
          return;
        }
        const preferred = options.find((option) => option.label.startsWith('现场发现')) || options[0];
        if (preferred) {
          setSelectedStartFrame(preferred.frame);
          setSelectedStartTime(toDatetimeLocalValue(preferred.timestamp));
        } else if (discoveryTime) {
          setSelectedStartFrame(discoveryFrame);
          setSelectedStartTime(toDatetimeLocalValue(discoveryTime));
        }
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || error.name === 'AbortError') return;
        setRawDataSourceState((prev) => ({
          ...prev,
          status: 'error',
          message: `时间索引读取失败：${error.message}`,
        }));
      });
    return () => {
      controller.abort();
    };
  }, [hasAccessToken, realtimeEndpoint, realtimeWellsLoaded, selectedWellRuntime?.isRunning, selectedWellRuntime?.startedSampleTime, updateWellRuntime, wellInfo?.wellId]);

  useEffect(() => {
    adapterRef.current?.disconnect();
    if (backgroundAdaptersRef.current[wellInfo.wellId]) return;
    if (!isRunning) {
      setRawDataSourceState((prev) => ({
        ...prev,
        adapterName: realtimeEndpoint ? prev.adapterName || 'MySQL 实时数据接口' : '真实数据接口',
        endpoint: prev.endpoint || realtimeEndpoint || null,
        status: realtimeEndpoint ? 'paused' : 'error',
        message: realtimeEndpoint
          ? selectedStartTime
            ? '已选择开始时间，点击开始监测'
            : '等待选择开始时间并启动监测'
          : '未配置真实数据接口，等待接入',
      }));
      return;
    }

    const seed = makeInitialData(wellInfo);
    const adapter: DataSourceAdapter = realtimeEndpoint
      ? new ResilientRealtimeDataSourceAdapter(realtimeEndpoint, fromDatetimeLocalValue(selectedStartTime), 1200)
      : new DisabledDataSourceAdapter();
    adapterRef.current = adapter;
    adapter.onStatus((state) => {
      const previousRuntime = wellRuntimeStatesRef.current[wellInfo.wellId];
      const snapshotCount = wellSnapshotsRef.current[wellInfo.wellId]?.historyRecords.length ?? 0;
      const nextRecordCount = Math.max(previousRuntime?.recordCount ?? 0, snapshotCount, state.recordCount || 0);
      setRawDataSourceState(state);
      updateWellRuntime(wellInfo.wellId, {
        status: state.status,
        isRunning: state.status === 'connected' || state.status === 'connecting',
        shouldAutoRestore: state.status === 'connected' || state.status === 'connecting' ? true : undefined,
        recordCount: nextRecordCount > 0 ? nextRecordCount : undefined,
        lastRecordAt: state.lastRecordAt || previousRuntime?.lastRecordAt,
        message: formatRuntimeFrameMessage(state.message, nextRecordCount),
      });
    });
    adapter.onRecord((record) => {
      const previousSnapshot = getWellSnapshot(wellInfo);
      const recordTime = formatRecordTime(record.sampleTime || record.sample_time as string | number | undefined || record.timestamp);
      const timestampMs = recordMillis(record.sampleTime || record.sample_time as string | number | undefined || record.timestamp);
      timeCounter.current = Number(record.cycleSeconds) > 0 ? Number(record.cycleSeconds) : timeCounter.current + 1;
      const recordCycleState = parseCycleState(record.cycleState ?? record.operation_state_std);
      const nextCycleInfo = recordCycleState === null ? getCycleInfo(timeCounter.current) : {
        ...getCycleInfo(timeCounter.current),
        ...CYCLE_STATES[recordCycleState],
        state: recordCycleState,
      };

      setCycleInfo(nextCycleInfo);
      const nextData = normalizeRealTimeRecord(record, currentDataRef.current);
      currentDataRef.current = nextData;
      setCurrentData(nextData);
      const sampleTimeText = String(record.sampleTime || record.sample_time || record.timestamp || '');
      if (sampleTimeText) setCurrentSampleTime(sampleTimeText.replace('T', ' '));
      const nextDetection = normalizeBackendDetection(record);
      const canPaintEvent = isMonitorableEventRecord(record, nextData);
      if (nextDetection.eventId && canPaintEvent) {
        activeEventIdRef.current = nextDetection.eventId;
      } else if (nextDetection.publicLevel < 2 || !canPaintEvent) {
        activeEventIdRef.current = null;
      }
      const activeEventId = nextDetection.publicLevel >= 2 && canPaintEvent ? activeEventIdRef.current : null;
      setBackendDetection(nextDetection);
      const nextFlowHistory = dedupeMonitoringPoints(sortMonitoringPoints(keepMonitoringWindow([
        ...previousSnapshot.flowHistory,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.publicLevel,
          eventId: activeEventId,
          flowIn: nextData.flowIn,
          flowOut: nextData.flowOut,
          bitDepth: nextData.bitDepth,
          pitGain: nextData.pitGain,
          pitVolume: nextData.pitVolume,
          returnResponse: nextData.returnResponse,
          spm: nextData.spm,
          totalGas: nextData.totalGas,
          hookLoad: nextData.hookLoad,
        },
      ])));
      const nextPressureHistory = dedupeMonitoringPoints(sortMonitoringPoints(keepMonitoringWindow([
        ...previousSnapshot.pressureHistory,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.publicLevel,
          eventId: activeEventId,
          casingPressure: nextData.casingPressure,
          drillPipePressure: nextData.drillPipePressure,
          spp: nextData.spp,
          sppPredicted: nextData.sppPredicted,
        },
      ])));
      const nextHistoryRecords = dedupeHistoryRecords([
        ...previousSnapshot.historyRecords.slice(-239),
        {
          id: historyIdCounter.current++,
          time: recordTime.timeStr,
          date: recordTime.dateStr,
          pitGain: nextData.pitGain,
          pitVolume: nextData.pitVolume,
          returnResponse: nextData.returnResponse,
          flowIn: nextData.flowIn,
          flowOut: nextData.flowOut,
          casingPressure: nextData.casingPressure,
          drillPipePressure: nextData.drillPipePressure,
          spp: nextData.spp,
          sppPredicted: nextData.sppPredicted,
          spm: nextData.spm,
          totalGas: nextData.totalGas,
          hookLoad: nextData.hookLoad,
          mudWeight: nextData.mudWeight,
          rop: nextData.rop,
          bitDepth: nextData.bitDepth,
          pumpState: nextDetection.pumpState,
          cycleState: nextCycleInfo.state,
          backendLevel: nextDetection.publicLevel,
          baselineValid: nextDetection.baselineValid,
          baselineWarmup: nextDetection.baselineWarmup,
          monitoringReady: nextDetection.monitoringReady,
          baselineCount: nextDetection.baselineCount,
          status: backendLevelToStatus(nextDetection.publicLevel),
        },
      ]);
      updateWellRuntime(wellInfo.wellId, {
        backendLevel: nextDetection.publicLevel,
        status: 'connected',
        isRunning: true,
        shouldAutoRestore: true,
        latestWellDepth: nextData.wellDepth,
        latestBitDepth: nextData.bitDepth,
        latestFormation: nextData.formation,
        recordCount: historyIdCounter.current,
        lastRecordAt: sampleTimeText ? sampleTimeText.replace('T', ' ') : `${recordTime.dateStr} ${recordTime.timeStr}`,
        message: `检测流推送中 · ${historyIdCounter.current} 帧`,
      });
      appendAlertsFromRecord(wellInfo, record, nextData);
      setFlowHistory(nextFlowHistory);
      setPressureHistory(nextPressureHistory);
      setHistoryRecords(nextHistoryRecords);
      syncWellSnapshotFromSample(
        wellInfo,
        nextData,
        sampleTimeText ? sampleTimeText.replace('T', ' ') : recordTime.timeStr,
        nextDetection,
        nextCycleInfo,
        nextFlowHistory,
        nextPressureHistory,
        nextHistoryRecords,
        { active: shutInActive, startedAt: shutInStartedAt },
      );
    });
    adapter.connect(wellInfo, seed);

    return () => {
      adapter.disconnect();
    };
  }, [appendAlertsFromRecord, getWellSnapshot, isRunning, realtimeEndpoint, selectedStartTime, wellInfo]);

  const resetForWell = (well: WellInfo, startTime = selectedStartTime, clearEvents = false) => {
    const nextInitial = makeInitialData(well);
    wellSnapshotsRef.current[well.wellId] = {
      currentData: nextInitial,
      currentSampleTime: '',
      lastRecordAt: null,
      startedSampleTime: startTime ? fromDatetimeLocalValue(startTime) : null,
      flowHistory: [],
      pressureHistory: [],
      backendDetection: INITIAL_BACKEND_DETECTION,
      historyRecords: [],
      cycleInfo: getCycleInfo(0),
      shutInActive: false,
      shutInStartedAt: null,
      latestWellDepth: nextInitial.wellDepth,
      latestBitDepth: nextInitial.bitDepth,
      latestFormation: nextInitial.formation,
    };
    schedulePersistWellSnapshots();
    currentDataRef.current = nextInitial;
    setCurrentData(nextInitial);
    setFlowHistory([]);
    setPressureHistory([]);
    setCurrentSampleTime('');
    setBackendDetection(INITIAL_BACKEND_DETECTION);
    setHistoryRecords([]);
    setShutInActive(false);
    setShutInStartedAt(null);
    setCycleInfo(getCycleInfo(0));
    timeCounter.current = 0;
    historyIdCounter.current = 1;
    activeEventIdRef.current = null;
    if (clearEvents) {
      clearWellAlertState(well.wellId);
    }
    setIsRunning(false);
    setRawDataSourceState(createInitialDataSourceState(realtimeEndpoint, startTime));
  };

  const handleReset = () => {
    resetForWell(wellInfo, selectedStartTime, true);
  };

  const selectWell = (wellId: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const runtime = wellRuntimeStates[wellId];
    const hasBackgroundStream = Boolean(backgroundAdaptersRef.current[wellId]);
    selectedWellIdRef.current = wellId;
    saveWellSelection(STORAGE_SELECTED_WELL, wellId);
    if (user) {
      void saveSelectedWells(Array.from(new Set([wellId, ...monitoredWellIds])));
    }
    setSelectedWellId(wellId);
    hydrateWellView(nextWell);
    if (runtime?.startedSampleTime) {
      const nextStartTime = toDatetimeLocalValue(runtime.startedSampleTime);
      setSelectedStartTime(nextStartTime);
      setSelectedStartFrame(0);
    }
    const hasResumeProgress = hasWellResumeProgress(runtime, wellSnapshotsRef.current[wellId]);
    if (
      runtime?.shouldAutoRestore !== false
      && (
        hasBackgroundStream
        || (hasResumeProgress && (runtime?.isRunning || runtime?.status === 'connected' || runtime?.status === 'connecting'))
      )
    ) {
      setIsRunning(true);
      updateWellRuntime(wellId, {
        status: runtime?.status === 'paused' ? 'connecting' : (runtime?.status || 'connecting'),
        isRunning: true,
        shouldAutoRestore: true,
        message: runtime.message || '正在切换监测井',
      });
      if (!hasBackgroundStream) {
        startBackgroundMonitoring(nextWell, getResumeSampleTime(nextWell, runtime), true);
      }
      return;
    }
    setIsRunning(false);
  };

  const addMonitoredWell = useCallback((wellId: string) => {
    if (!wells.some((well) => well.wellId === wellId)) return;
    setMonitoredWellIds((prev) => {
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_MONITORED_WELLS, next);
      if (user) void saveSelectedWells(next);
      return next;
    });
  }, [user, wells]);

  const removeMonitoredWell = (wellId: string) => {
    stopBackgroundMonitoring(wellId);
    setManualStoppedWellIds((current) => current.includes(wellId) ? current : [...current, wellId]);
    setMonitoredWellIds((prev) => {
      const next = prev.filter((item) => item !== wellId);
      saveWellListSelection(STORAGE_MONITORED_WELLS, next);
      return next;
    });
    setRealtimeTabWellIds((prev) => {
      const next = prev.filter((item) => item !== wellId);
      saveWellListSelection(STORAGE_REALTIME_TABS, next);
      return next;
    });
    if (wellId === selectedWellId) setIsRunning(false);
    updateWellRuntime(wellId, { status: 'paused', isRunning: false, shouldAutoRestore: false, message: '待启动' });
  };

  const toggleMonitoredWell = (wellId: string) => {
    setMonitoredWellIds((prev) => {
      const next = prev.includes(wellId)
        ? prev.filter((item) => item !== wellId)
        : wells.some((well) => well.wellId === wellId)
          ? [...prev, wellId]
          : prev;
      saveWellListSelection(STORAGE_MONITORED_WELLS, next);
      if (user) void saveSelectedWells(next);
      return next;
    });
  };

  const openRealtimeWell = (wellId: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const runtime = wellRuntimeStates[wellId];
    const nextStartTime = runtime?.startedSampleTime ? toDatetimeLocalValue(runtime.startedSampleTime) : '';
    addMonitoredWell(wellId);
    setRealtimeTabWellIds((prev) => {
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_REALTIME_TABS, next);
      return next;
    });
    hydrateWellView(nextWell);
    selectedWellIdRef.current = wellId;
    if (nextStartTime) {
      setSelectedWellId(wellId);
      setSelectedStartTime(nextStartTime);
      if (runtime?.shouldAutoRestore !== false && (runtime?.isRunning || runtime?.status === 'connected' || runtime?.status === 'connecting' || backgroundAdaptersRef.current[wellId])) {
        const hasResumeProgress = hasWellResumeProgress(runtime, wellSnapshotsRef.current[wellId]);
        if (hasResumeProgress || backgroundAdaptersRef.current[wellId]) {
          updateWellRuntime(wellId, {
            status: runtime?.status === 'paused' ? 'connecting' : (runtime?.status || 'connecting'),
            isRunning: true,
            shouldAutoRestore: true,
            message: runtime?.message || '正在进入实时监测',
          });
          setIsRunning(true);
        } else {
          updateWellRuntime(wellId, {
            status: 'paused',
            isRunning: false,
            message: '已恢复上次监测起点，点击继续监测',
          });
          setIsRunning(false);
        }
      } else {
        updateWellRuntime(wellId, {
          status: 'paused',
          isRunning: false,
          message: '已恢复上次监测起点，点击继续监测',
        });
        setIsRunning(false);
      }
      if (
        runtime?.shouldAutoRestore !== false
        && hasWellResumeProgress(runtime, wellSnapshotsRef.current[wellId])
        && (runtime?.isRunning || runtime?.status === 'connected' || runtime?.status === 'connecting')
        && !backgroundAdaptersRef.current[wellId]
      ) {
        startBackgroundMonitoring(nextWell, getResumeSampleTime(nextWell, runtime), true);
      }
      return;
    }
    setSelectedWellId(wellId);
    startWellMonitoring(wellId);
  };

  const startWellMonitoring = useCallback((wellId: string, options?: { resumeFrom?: string; preserveSnapshot?: boolean; restoreOnly?: boolean }) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const wasManuallyStopped = manualStoppedWellIds.includes(wellId);
    setManualStoppedWellIds((current) => current.includes(wellId) ? current.filter((item) => item !== wellId) : current);
    const runtimeBeforeStart = wellRuntimeStatesRef.current[wellId];
    const snapshotBeforeStart = wellSnapshotsRef.current[wellId] || createWellMonitoringSnapshot(nextWell);
    const resumeFrom = options?.resumeFrom
      || runtimeBeforeStart?.lastRecordAt
      || snapshotBeforeStart.lastRecordAt
      || snapshotBeforeStart.currentSampleTime
      || runtimeBeforeStart?.startedSampleTime
      || snapshotBeforeStart.startedSampleTime
      || '';
    const shouldPreserveSnapshot = Boolean(options?.preserveSnapshot || options?.restoreOnly || resumeFrom);
    const nextMonitoringStartedAt = !wasManuallyStopped && shouldPreserveSnapshot
      ? (resolveMonitoringStartedAt(
        runtimeBeforeStart,
        snapshotBeforeStart,
        runtimeBeforeStart?.startedSampleTime || snapshotBeforeStart.startedSampleTime || resumeFrom || null,
        runtimeBeforeStart?.lastRecordAt || snapshotBeforeStart.lastRecordAt || snapshotBeforeStart.currentSampleTime || resumeFrom || null,
      ) || new Date().toISOString())
      : new Date().toISOString();
    addMonitoredWell(wellId);
    setRealtimeTabWellIds((prev) => {
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_REALTIME_TABS, next);
      return next;
    });
    if (wellRuntimeStatesRef.current[wellId]?.isRunning || backgroundAdaptersRef.current[wellId]) {
      autoRestoringWellIdsRef.current.delete(wellId);
      return;
    }

    if (options?.restoreOnly && resumeFrom) {
      const nextStartTime = toDatetimeLocalValue(resumeFrom);
      updateWellRuntime(wellId, {
        status: 'connecting',
        isRunning: true,
        shouldAutoRestore: true,
        monitoringStartedAt: nextMonitoringStartedAt,
        startedSampleTime: runtimeBeforeStart?.startedSampleTime || snapshotBeforeStart.startedSampleTime || resumeFrom,
        ...(shouldPreserveSnapshot ? {} : { recordCount: 0, backendLevel: 0 as BackendLevel, lastRecordAt: null }),
        message: `正在恢复检测流 · 起始 ${formatRecordTime(resumeFrom).timeStr}`,
      });
      if (wellId === selectedWellIdRef.current) {
        setSelectedStartFrame(0);
        setSelectedStartTime(nextStartTime);
        hydrateWellView(nextWell);
        setIsRunning(true);
      }
      startBackgroundMonitoring(nextWell, resumeFrom, shouldPreserveSnapshot);
      autoRestoringWellIdsRef.current.delete(wellId);
      delete autoRestoreFailureAtRef.current[wellId];
      return;
    }

    startRequestControllersRef.current[wellId]?.abort();
    const controller = new AbortController();
    const requestToken = (startRequestTokensRef.current[wellId] || 0) + 1;
    startRequestControllersRef.current[wellId] = controller;
    startRequestTokensRef.current[wellId] = requestToken;
    const isActiveStartRequest = () => startRequestTokensRef.current[wellId] === requestToken && !controller.signal.aborted;
    updateWellRuntime(wellId, {
      status: 'connecting',
      isRunning: true,
      shouldAutoRestore: true,
      monitoringStartedAt: nextMonitoringStartedAt,
      startedSampleTime: runtimeBeforeStart?.startedSampleTime || snapshotBeforeStart.startedSampleTime || null,
      message: '正在读取时间索引',
    });
    authenticatedFetch(buildRealtimeApiUrl(realtimeEndpoint, `/wells/${encodeURIComponent(wellId)}/times?maxOptions=30`), { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!isActiveStartRequest()) return;
        const options = buildStartOptionsFromTimeIndex(data);
        const discoveryTime = String(data.discovery_time || data.discoveryTime || data.discovery?.timestamp || options[0]?.timestamp || nextWell.discoveryTime || nextWell.startTime || '');
        const discoveryFrame = finite(data.discovery_frame ?? data.discoveryFrame ?? data.discovery?.frame, 0);
        const autoStartTimestamp = shiftTimestamp(discoveryTime, -60 * 60 * 1000);
        const autoStartOption = autoStartTimestamp ? options.find((option) => option.timestamp >= autoStartTimestamp) : undefined;
        const nextStartTime = resumeFrom || autoStartOption?.timestamp || autoStartTimestamp || discoveryTime;
        if (!nextStartTime) throw new Error('未读取到可用开始时间');
        updateWellRuntime(wellId, {
          status: 'connecting',
          isRunning: true,
          shouldAutoRestore: true,
          startedSampleTime: runtimeBeforeStart?.startedSampleTime || snapshotBeforeStart.startedSampleTime || nextStartTime,
          ...(shouldPreserveSnapshot ? {} : { recordCount: 0, backendLevel: 0 as BackendLevel, lastRecordAt: null }),
          message: `正在建立检测流 · 起始 ${formatRecordTime(nextStartTime).timeStr}`,
        });
        if (wellId === selectedWellIdRef.current) {
          setSelectedStartFrame(autoStartOption?.frame ?? discoveryFrame);
          setSelectedStartTime(toDatetimeLocalValue(nextStartTime));
          hydrateWellView(nextWell);
          setIsRunning(true);
        }
        startBackgroundMonitoring(nextWell, nextStartTime, shouldPreserveSnapshot);
        autoRestoringWellIdsRef.current.delete(wellId);
        delete autoRestoreFailureAtRef.current[wellId];
        if (startRequestControllersRef.current[wellId] === controller) {
          delete startRequestControllersRef.current[wellId];
        }
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || error.name === 'AbortError' || !isActiveStartRequest()) return;
        autoRestoringWellIdsRef.current.delete(wellId);
        autoRestoreFailureAtRef.current[wellId] = Date.now();
        updateWellRuntime(wellId, {
          status: 'error',
          isRunning: false,
          shouldAutoRestore: options?.restoreOnly ? true : undefined,
          message: `启动失败：${error.message}`,
        });
        if (startRequestControllersRef.current[wellId] === controller) {
          delete startRequestControllersRef.current[wellId];
        }
      });
  }, [addMonitoredWell, getResumeSampleTime, hydrateWellView, manualStoppedWellIds, realtimeEndpoint, startBackgroundMonitoring, updateWellRuntime, wells]);

  useEffect(() => {
    if (!hasAccessToken || !realtimeWellsLoaded) return;
    restorableWellIds.forEach((wellId) => {
      if (!wells.some((well) => well.wellId === wellId)) return;
      if (backgroundAdaptersRef.current[wellId]) return;
      if (autoRestoringWellIdsRef.current.has(wellId)) return;
      if (Date.now() - (autoRestoreFailureAtRef.current[wellId] || 0) < 30000) return;
      const runtime = wellRuntimeStates[wellId];
      if (runtime?.shouldAutoRestore === false) return;
      if (runtime?.isRunning && runtime.status === 'connected') return;
      autoRestoringWellIdsRef.current.add(wellId);
      const well = wells.find((item) => item.wellId === wellId);
      const resumeFrom = well ? getResumeSampleTime(well, runtime) : runtime?.lastRecordAt || runtime?.startedSampleTime || '';
      startWellMonitoring(wellId, { resumeFrom, preserveSnapshot: true, restoreOnly: true });
    });
  }, [getResumeSampleTime, hasAccessToken, realtimeWellsLoaded, restorableWellIds, startWellMonitoring, wellRuntimeStates, wells]);

  const pauseWellMonitoring = (wellId: string) => {
    updateWellRuntime(wellId, {
      message: '实时监测已锁定；如需结束请停止当前井监测',
    });
  };

  const stopWellMonitoring = (wellId: string) => {
    flushAllPersistence();
    startRequestControllersRef.current[wellId]?.abort();
    delete startRequestControllersRef.current[wellId];
    startRequestTokensRef.current[wellId] = (startRequestTokensRef.current[wellId] || 0) + 1;
    autoRestoringWellIdsRef.current.delete(wellId);
    setManualStoppedWellIds((current) => current.includes(wellId) ? current : [...current, wellId]);
    if (typeof window !== 'undefined') {
      const currentStopped = getInitialManualStoppedWellIds();
      if (!currentStopped.includes(wellId)) {
        window.localStorage.setItem(STORAGE_MANUAL_STOPPED_WELLS, JSON.stringify([...currentStopped, wellId]));
      }
    }
    stopBackgroundMonitoring(wellId);
    if (wellId === selectedWellIdRef.current) {
      adapterRef.current?.disconnect();
      adapterRef.current = null;
    }
    updateWellRuntime(wellId, {
      status: 'paused',
      isRunning: false,
      shouldAutoRestore: false,
      message: '监测已停止',
      monitoringStartedAt: null,
    });
    if (wellId === selectedWellIdRef.current) {
      setIsRunning(false);
    }
    authenticatedFetch(buildRealtimeApiUrl('', `/api/monitoring/sessions/${encodeURIComponent(wellId)}/stop`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).catch(() => {
      // stop is best-effort for now
    });
  };

  const resumeWellMonitoring = (wellId: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    const runtime = wellRuntimeStates[wellId];
    const snapshot = wellSnapshotsRef.current[wellId];
    const wasManuallyStopped = manualStoppedWellIds.includes(wellId);
    const startTime = runtime?.startedSampleTime || snapshot?.startedSampleTime;
    setManualStoppedWellIds((current) => current.includes(wellId) ? current.filter((item) => item !== wellId) : current);
    if (!nextWell || !startTime) {
      startWellMonitoring(wellId);
      return;
    }
    addMonitoredWell(wellId);
    setRealtimeTabWellIds((prev) => {
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_REALTIME_TABS, next);
      return next;
    });
    updateWellRuntime(wellId, {
      status: 'connecting',
      isRunning: true,
      shouldAutoRestore: true,
      monitoringStartedAt: wasManuallyStopped
        ? new Date().toISOString()
        : (resolveMonitoringStartedAt(
          runtime,
          snapshot,
          startTime,
          getResumeSampleTime(nextWell, runtime),
        ) || new Date().toISOString()),
      message: '正在恢复检测流',
    });
    startBackgroundMonitoring(nextWell, getResumeSampleTime(nextWell, runtime), true);
  };

  const selectStartFrame = (frame: number) => {
    const option = startOptions.find((item) => item.frame === frame);
    setSelectedStartFrame(frame);
    const nextStartTime = option?.timestamp ? toDatetimeLocalValue(option.timestamp) : '';
    setSelectedStartTime(nextStartTime);
    resetForWell(wellInfo, nextStartTime);
  };

  const updateSelectedStartTime = (value: string) => {
    setSelectedStartTime(value);
    if (!value) {
      setSelectedStartFrame(0);
      resetForWell(wellInfo, '');
      return;
    }
    const timeText = fromDatetimeLocalValue(value);
    const option = startOptions.find((item) => item.timestamp >= timeText);
    if (option) setSelectedStartFrame(option.frame);
    resetForWell(wellInfo, value);
  };

  const acknowledgeAlert = (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    const target = alerts.find((alert) => alert.id === id);
    if (target?.backendEventId) {
      setAcknowledgedEvents((prev) => {
        const next = { ...prev, [target.backendEventId]: true };
        acknowledgedEventsRef.current = next;
        return next;
      });
    }
  };

  const acknowledgeAll = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    setAcknowledgedEvents((prev) => {
      const next = { ...prev };
      alerts.forEach((alert) => {
        if (alert.backendEventId) next[alert.backendEventId] = true;
      });
      acknowledgedEventsRef.current = next;
      return next;
    });
  };

  const startShutInProcedure = () => {
    if (shutInActive) return;
    const { timeStr } = formatNow();
    setShutInActive(true);
    setShutInStartedAt(timeStr);
  };

  const updateThresholds = (t: ThresholdSettings) => setThresholds(t);

  const updateRealtimeEndpoint = (endpoint: string) => {
    const safe = normalizeRealtimeEndpoint(endpoint);
    setRealtimeEndpoint(safe);
    setRawDataSourceState(createInitialDataSourceState(safe, selectedStartTime));
  };

  return (
    <WellControlContext.Provider
      value={{
        isRunning,
        currentData,
        flowHistory,
        pressureHistory,
        alerts,
        historyRecords,
        thresholds,
        alertStatus,
        backendDetection,
        cycleInfo,
        baselineInfo,
        wells,
        wellRuntimeStates,
        monitoredWellIds,
        realtimeTabWellIds,
        wellInfo,
        selectedWellId,
        algorithmInterface: ALGORITHM_INTERFACE,
        dataSourceState,
        realtimeEndpoint,
        startOptions,
        selectedStartFrame,
        selectedStartTime,
        currentSampleTime,
        timeBounds,
        shutInActive,
        shutInStartedAt,
        selectedWellView,
        selectedWellManuallyStopped,
        isWellManuallyStopped,
        buildRealtimeApiUrl: (path) => buildRealtimeApiUrl(realtimeEndpoint, path),
        setIsRunning,
        handleReset,
        acknowledgeAlert,
        acknowledgeAll,
        selectWell,
        toggleMonitoredWell,
        addMonitoredWell,
        removeMonitoredWell,
        openRealtimeWell,
        startWellMonitoring,
        stopWellMonitoring,
        pauseWellMonitoring,
        resumeWellMonitoring,
        selectStartFrame,
        updateSelectedStartTime,
        startShutInProcedure,
        updateThresholds,
        updateRealtimeEndpoint,
      }}
    >
      {children}
    </WellControlContext.Provider>
  );
}
