import { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { normalizePreprocessingSnapshot, type PreprocessingSnapshot } from '../lib/preprocessingContract';
import { normalizeReferenceExperimentSnapshot, type ReferenceExperimentSnapshot } from '../lib/referenceExperimentContract';
import { normalizePumpGateDiagnostics, type PumpGateDiagnosticsSnapshot } from '../lib/pumpGateContract';
import { normalizePrecursorEligibility, type PrecursorEligibilitySnapshot } from '../lib/precursorEligibilityContract';
import { normalizeOperationContextV2, type OperationContextV2Snapshot } from '../lib/operationContextV2Contract';
import { appendAccessToken, authenticatedFetch, getAccessToken } from '../api/authToken';
import { saveSelectedWells } from '../api/authApi';
import { resetRealtimeBaseline } from '../api/realtimeBaselineApi';
import { fallbackQueueCandidateFromFrame, mergeQueueAlertSnapshot } from '../lib/alertQueueProjection';
import { markEventExplanationRevision } from '../lib/eventExplanationCache';
import { operatorEventPresentation } from '../lib/operatorEventPresentation';
import { withMonitoringModeQuery } from '../lib/realtimeStreamUrl';
import {
  formatSourceDate,
  formatSourceDateTime,
  formatSourceTime,
  parseSourceDate,
  parseSourceDateMs,
  toSourceDateTimeOffset,
} from '../lib/sourceTime';
import { useAuth } from './AuthContext';

export type AlertStatus = 'normal' | 'warning' | 'critical';
export type BackendLevel = 0 | 1 | 2 | 3 | 4;
export type CycleState = 0 | 1 | 2 | 3 | 4 | 5;
export type OperationCycleState = 'Disturbance' | 'StableDrilling' | 'StableCirculation' | 'PumpStopped' | 'PumpRestarting' | 'Monitoring' | 'Unknown';
export type HypothesisCycleState = 'None' | 'WatchingPostStop' | 'AwaitingRestartShortHold' | 'StaticDriftReview' | 'LongStopGuard' | 'Restarting' | 'ObservingStablePumping' | 'Resolved' | 'Unknown';
export type MonitoringMode = 'realtime' | 'historyReplay';
export type ReplaySpeed = 1 | 2 | 5 | 10;
export type DataSourceMode = MonitoringMode;
export type DataSourceConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'catchingUp' | 'unauthorized' | 'paused' | 'disconnected' | 'error';

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
  lastRealtimeSampleTime?: string;
}

export interface MonitoringData {
  pitGain: number | null;
  pitVolume: number | null;
  flowIn: number | null;
  flowOut: number | null;
  outletUnit?: string;
  outletSemantic?: string;
  casingPressure: number | null;
  drillPipePressure: number | null;
  spp: number | null;
  sppPredicted: number | null;
  spm1: number | null;
  spm2: number | null;
  spm3: number | null;
  totalSpm: number | null;
  totalSpmComplete: boolean;
  mudWeight: number | null;
  mudTemp: number | null;
  rop: number | null;
  hookLoad: number | null;
  wob: number | null;
  totalGas: number | null;
  torque: number | null;
  wellDepth?: number | null;
  bitDepth: number | null;
  rpm: number | null;
  confidenceLevel: number;
  pumpState: string;
  condition: string;
  operationCategory?: string;
  operationDetail?: string;
  operationRecognitionAvailable?: boolean;
  operationRecognitionSource?: string;
  formation?: string;
  casingShoeDepth?: number;
  drillPipeOD?: number;
  bhaOD?: number;
  bitOD?: number;
  casingID?: number;
  openHoleDiameter?: number;
  ecd?: number;
  porePressureEquivalent?: number;
  fractureGradientEquivalent?: number;
  inclination?: number;
  highSideDirection?: number;
}

export interface CycleInfo {
  state: CycleState;
  operationState: OperationCycleState;
  hypothesisState: HypothesisCycleState;
  source: 'backend' | 'unknown';
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
  referenceMinimumSamples: number;
  readyChannelCount: number;
  referenceChannelCount: number;
}

export interface BaselineChannelSnapshot {
  channel: string;
  label: string;
  state: string;
  ready: boolean;
  frozen: boolean;
  supportingSampleCount: number;
  candidateSampleCount: number;
  activeSampleCount: number;
  currentSiValue: number | null;
  expectedSiValue: number | null;
  lowerBoundSiValue: number | null;
  upperBoundSiValue: number | null;
  modelKind: string;
  applicability: string;
  operationContextKey: string;
}

export interface BaselineSnapshot {
  status: string;
  ready: boolean;
  warmup: boolean;
  minimumReferenceSamples: number;
  minimumReferenceExposureSeconds: number;
  readyChannelCount: number;
  channelCount: number;
  frozenChannelCount: number;
  source: string;
  selection: string;
  lastUpdatedAt: string;
  channels: BaselineChannelSnapshot[];
}

export type { PreprocessingSignalSnapshot, PreprocessingSnapshot } from '../lib/preprocessingContract';
export type { ReferenceBankDiagnostic, ReferenceChannelComparison, ReferenceExperimentSnapshot } from '../lib/referenceExperimentContract';
export type { PumpConfigurationDiagnostics, StablePumpingGateDiagnostics, PumpGateDiagnosticsSnapshot } from '../lib/pumpGateContract';
export type { HydraulicEligibilityDiagnostics, PressureEligibilityDiagnostics, MechanicalChannelEligibilityDiagnostics, MechanicalEligibilityDiagnostics, PrecursorEligibilitySnapshot } from '../lib/precursorEligibilityContract';

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
  warningId?: number;
  lifecycleStatus?: string;
  ackStatus?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  acknowledgementCount?: number;
  wellId?: string;
  wellName?: string;
  sessionCode?: string;
  wellBlock?: string;
  wellDepth?: number | null;
  bitDepth?: number | null;
  formation?: string;
  time: string;
  date: string;
  lastTime?: string;
  lastDate?: string;
  level: 'info' | 'warning' | 'critical';
  /** Parameter-specific operator title, for example “L2：总池体积持续增加”. */
  title?: string;
  /** Measured physical facts supplied by the backend. */
  description?: string;
  primaryParameter?: string;
  message: string;
  acknowledged: boolean;
  code?: string;
  backendEventId: string;
  currentBackendLevel?: BackendLevel;
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
  /** Canonical L0-L4 advisory level from the backend HMI contract ("L0".."L4"). */
  advisoryLevel: BackendLevel;
  publicLevel: BackendLevel;
  formalEvalLevel: BackendLevel;
  eventTitle: string;
  physicalDescription: string;
  primaryParameter: string;
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
  baselineSnapshot: BaselineSnapshot;
  preprocessing: PreprocessingSnapshot | null;
  referenceExperiment: ReferenceExperimentSnapshot | null;
  pumpGate: PumpGateDiagnosticsSnapshot | null;
  precursorEligibility: PrecursorEligibilitySnapshot | null;
  operationContextV2: OperationContextV2Snapshot | null;
}

export interface EventSpan {
  eventId: string;
  candidateId: number;
  startTime: string;
  endTime: string | null;
  sampleCount?: number;
  currentLevel: BackendLevel;
  highestLevel: BackendLevel;
  lifecycleStatus: 'active' | 'recovering' | 'ended' | string;
  resolution?: string;
}

export interface LifecycleNode {
  eventId: string;
  candidateId: number;
  timestamp: string;
  eventName: string;
  reason: string;
  publicLevel: BackendLevel;
}

export interface EventProjectionState {
  status: 'loading' | 'connected' | 'fallback' | 'error';
  message: string;
  lastUpdatedAt: string | null;
}

export interface FlowDataPoint {
  time: string;
  timestampMs?: number;
  backendLevel?: BackendLevel;
  eventId?: string | null;
  eventTitle?: string;
  eventDescription?: string;
  abnormalParameters?: string[];
  flowIn: number | null;
  flowOut: number | null;
  pitGain?: number | null;
  pitVolume?: number | null;
  wellDepth?: number | null;
  bitDepth?: number | null;
  spm1?: number | null;
  spm2?: number | null;
  spm3?: number | null;
  totalSpm?: number | null;
  totalSpmComplete?: boolean;
  rop?: number | null;
  totalGas?: number | null;
  hookLoad?: number | null;
  wob?: number | null;
  rpm?: number | null;
  torque?: number | null;
}

export interface PressureDataPoint {
  time: string;
  timestampMs?: number;
  backendLevel?: BackendLevel;
  eventId?: string | null;
  eventTitle?: string;
  eventDescription?: string;
  abnormalParameters?: string[];
  casingPressure: number | null;
  drillPipePressure: number | null;
  spp?: number | null;
  sppPredicted?: number | null;
}

export interface HistoryRecord {
  id: number;
  time: string;
  date: string;
  pitGain: number | null;
  pitVolume: number | null;
  flowIn: number | null;
  flowOut: number | null;
  casingPressure: number | null;
  drillPipePressure: number | null;
  spp: number | null;
  sppPredicted: number | null;
  totalSpm: number | null;
  totalSpmComplete: boolean;
  totalGas: number | null;
  hookLoad: number | null;
  mudWeight: number | null;
  rop: number | null;
  bitDepth: number | null;
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
  pitGainWarning: number;
  pitGainCritical: number;
  casingPressureWarning: number;
  mudWeightWarning: number;
  sppResidualWarning: number;
  sppResidualCritical: number;
}

export const DEFAULT_REALTIME_ENDPOINT = '/api/realtime';
const STORAGE_PREFIX = 'wcs-overflow-2026';
const STORAGE_SELECTED_WELL = `${STORAGE_PREFIX}:selected-well-id`;
const STORAGE_MONITORED_WELLS = `${STORAGE_PREFIX}:monitored-well-ids`;
const STORAGE_REALTIME_TABS = `${STORAGE_PREFIX}:realtime-tab-well-ids`;
const STORAGE_REALTIME_ENDPOINT = `${STORAGE_PREFIX}:realtime-endpoint`;
const STORAGE_MONITORING_WINDOW_MINUTES = `${STORAGE_PREFIX}:monitoring-window-minutes`;
const STORAGE_WELL_RUNTIME_STATES = `${STORAGE_PREFIX}:well-runtime-states`;
const SNAPSHOT_DB_NAME = `${STORAGE_PREFIX}:cache`;
const SNAPSHOT_STORE_NAME = 'wellSnapshots';
const EVENT_PROJECTION_STORE_NAME = 'eventProjections';
const STORAGE_MANUAL_STOPPED_WELLS = `${STORAGE_PREFIX}:manual-stopped-well-ids`;
const STORAGE_ERROR_EVENT = 'wcs-storage-error';

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
  operation?: Record<string, unknown>;
  Operation?: Record<string, unknown>;
}

export interface DataSourceState {
  mode: DataSourceMode;
  streamSequence?: number;
  sourceRowNo?: number;
  lifecycleRevision?: number;
  streamGap?: boolean;
  adapterName: string;
  status: DataSourceConnectionStatus;
  endpoint: string | null;
  message: string;
  lastRecordAt: string | null;
  recordCount: number;
  sessionCode?: string;
  runtimeId?: string;
}

export interface WellRuntimeState {
  wellId: string;
  monitoringMode: MonitoringMode;
  status: DataSourceConnectionStatus;
  isRunning: boolean;
  sessionCode?: string;
  runtimeId?: string;
  backendRuntimeStatus?: 'Running' | 'Recovering' | 'Completed' | 'Stopping' | 'Stopped' | 'Faulted';
  connectionStatus?: DataSourceConnectionStatus;
  isBackendRunning?: boolean;
  isSubscriberConnected?: boolean;
  isUiActive?: boolean;
  lastSeenSourceRowNo?: number;
  backendCurrentSourceRowNo?: number;
  lastSeenSampleTime?: string | null;
  backendCurrentSampleTime?: string | null;
  reconnectAttempt?: number;
  missedFrameCount?: number;
  subscriberDisconnectReason?: string;
  runtimeStopReason?: string;
  shouldAutoRestore?: boolean;
  recordCount: number;
  lastRecordAt: string | null;
  backendLevel: BackendLevel;
  latestWellDepth?: number | null;
  latestBitDepth?: number | null;
  latestFormation?: string;
  monitoringStartedAt: string | null;
  startedSampleTime: string | null;
  selectedReplayStartTime?: string | null;
  replaySpeed: ReplaySpeed;
  pausedSampleTime?: string | null;
  message: string;
  updatedAt: string;
}

interface WellMonitoringSnapshot {
  sessionCode: string | null;
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
  latestWellDepth?: number | null;
  latestBitDepth?: number | null;
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
  latestWellDepth?: number | null;
  latestBitDepth?: number | null;
  latestFormation?: string;
  fromSnapshotFallback: boolean;
}

type AcknowledgedEventMap = Record<string, true>;

interface DataSourceAdapter {
  connect: (well: WellInfo, seed: MonitoringData) => void;
  disconnect: () => void;
  onRecord: (callback: (record: RealTimeRecord) => void) => void;
  onStatus: (callback: (state: DataSourceState) => void) => void;
  setReplaySpeed?: (speed: ReplaySpeed, resumeFrom?: string | null, sourceRowNo?: number) => void;
  getReplayCursor?: () => { sampleTime?: string | null; sourceRowNo?: number };
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
  return parseSourceDateMs(value);
}

function sampleTimeFromRecord(record?: Partial<RealTimeRecord> | null) {
  if (!record || typeof record !== 'object') return '';
  const row = record as Record<string, unknown>;
  return String(row.sampleTime ?? row.SampleTime ?? row.sample_time ?? row.timestamp ?? row.Timestamp ?? '').trim();
}

function sourceRowNoFromRecord(record?: Partial<RealTimeRecord> | null) {
  if (!record || typeof record !== 'object') return undefined;
  const value = finite(
    readValue(record as Record<string, unknown>, ['source_row_no', 'sourceRowNo']),
    Number.NaN,
  );
  return Number.isFinite(value) ? value : undefined;
}

function normalizeSampleTime(value?: string | null) {
  return value ? value.replace('T', ' ').trim() : '';
}

function toApiDateTimeOffset(value?: string | null) {
  return toSourceDateTimeOffset(value);
}

function nextPreviewCursorFrom(sampleTime?: string | null) {
  // Kept as a compatibility helper for callers that only have a timestamp.
  // A source-row cursor must be supplied separately; advancing the timestamp
  // by one second would skip valid rows sharing the same source second.
  return normalizeSampleTime(sampleTime);
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
  monitoringWindowMinutes: MonitoringWindowMinutes;
  alertStatus: AlertStatus;
  backendDetection: BackendDetectionState;
  cycleInfo: CycleInfo;
  eventSpans: EventSpan[];
  lifecycleNodes: LifecycleNode[];
  eventProjectionState: EventProjectionState;
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
  acknowledgeAlert: (id: number) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  selectWell: (wellId: string) => void;
  toggleMonitoredWell: (wellId: string) => void;
  addMonitoredWell: (wellId: string) => void;
  removeMonitoredWell: (wellId: string) => void;
  openRealtimeWell: (wellId: string) => void;
  startWellMonitoring: (wellId: string) => void;
  restartWellMonitoring: (wellId: string) => void;
  restartHistoryReplay: (wellId: string) => void;
  stopWellMonitoring: (wellId: string) => void;
  pauseWellMonitoring: (wellId: string) => void;
  resumeWellMonitoring: (wellId: string) => void;
  updateWellMonitoringMode: (wellId: string, mode: MonitoringMode) => void;
  updateWellReplayStartTime: (wellId: string, value: string) => void;
  updateWellReplaySpeed: (wellId: string, speed: ReplaySpeed) => void;
  selectStartFrame: (frame: number) => void;
  updateSelectedStartTime: (value: string) => void;
  startShutInProcedure: () => void;
  updateThresholds: (t: ThresholdSettings) => void;
  updateMonitoringWindowMinutes: (minutes: MonitoringWindowMinutes) => void;
  updateRealtimeEndpoint: (endpoint: string) => void;
}

const WellControlContext = createContext<WellControlContextType | null>(null);
export const MONITORING_WINDOW_OPTIONS = [30, 60, 90] as const;
export type MonitoringWindowMinutes = typeof MONITORING_WINDOW_OPTIONS[number];
export const DEFAULT_MONITORING_WINDOW_MINUTES: MonitoringWindowMinutes = 60;
let configuredMonitoringWindowMinutes: MonitoringWindowMinutes = DEFAULT_MONITORING_WINDOW_MINUTES;
function normalizeMonitoringWindowMinutes(value: unknown): MonitoringWindowMinutes {
  const numeric = Number(value);
  return (MONITORING_WINDOW_OPTIONS.find((option) => option === numeric) || DEFAULT_MONITORING_WINDOW_MINUTES) as MonitoringWindowMinutes;
}
function getInitialMonitoringWindowMinutes(): MonitoringWindowMinutes {
  if (typeof window === 'undefined') return DEFAULT_MONITORING_WINDOW_MINUTES;
  return normalizeMonitoringWindowMinutes(window.localStorage.getItem(STORAGE_MONITORING_WINDOW_MINUTES));
}
function monitoringWindowMs() { return configuredMonitoringWindowMinutes * 60 * 1000; }
// Backend stream rate is clamped to >=200ms, so the largest selectable
// 90-minute window is at most ~27,000 frames. Keep a bounded cap above that
// value to protect the browser from malformed/high-frequency streams while
// still honoring the configured 30/60/90-minute time window.
const MAX_MONITORING_POINTS = 30000;
const MAX_STORED_SNAPSHOT_POINTS = 1800;
const MAX_STORED_HISTORY_RECORDS = 2200;
// A live well can legitimately have no newly committed samples for several minutes.
// Keep the browser transport open for five minutes before reconnecting; the backend Runtime keeps running either way.
const STREAM_CONNECT_TIMEOUT_MS = 5 * 60 * 1000;
// A live SSE connection can remain TCP-open while the backend worker or an
// intermediary has stopped forwarding frames. Reconnect after a bounded
// period of frame silence so the UI does not stay frozen indefinitely after
// it has already received the first sample.
const STREAM_INACTIVITY_TIMEOUT_MS = 90 * 1000;
// A broken SSE path normally fails immediately and reconnects several times
// before a user would think to refresh.  Keep the primary transport first,
// then use the database-backed preview reader when it is demonstrably not
// recovering.  A successful frame clears this short failure window.
const SSE_RECONNECT_FALLBACK_WINDOW_MS = 30 * 1000;
const SSE_RECONNECT_FALLBACK_THRESHOLD = 3;
const PREVIEW_BATCH_LIMIT = 240;
const PREVIEW_IDLE_POLL_MS = 4000;
const SNAPSHOT_PERSIST_DEBOUNCE_MS = 20_000;
const RUNTIME_PERSIST_DEBOUNCE_MS = 3_000;

export function useWellControl() {
  const ctx = useContext(WellControlContext);
  if (!ctx) throw new Error('useWellControl must be used inside WellControlProvider');
  return ctx;
}

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  pitGainWarning: 1.2,
  pitGainCritical: 3,
  casingPressureWarning: 3.8,
  mudWeightWarning: 1.15,
  sppResidualWarning: 0.42,
  sppResidualCritical: 1.15,
};

const EMPTY_WELL_INFO: WellInfo = {
  wellId: '',
  wellName: '等待数据库井列表',
  block: 'MySQL',
  depth: 0,
  crew: '',
  dataSource: 'realtime',
  baselineVersion: 'realtime-v7',
};

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

const CYCLE_STATES: Array<Omit<CycleInfo, 'cycleIndex' | 'elapsedInState' | 'totalStateSeconds' | 'progress' | 'tStopPump' | 'tStartPump' | 'tStable' | 'hypothesisState' | 'source'>> = [
  {
    state: 0,
    operationState: 'Disturbance',
    stateLabel: '井筒扰动观察',
    shortLabel: '观察',
    description: '关注抽汲诱发的井筒体积扰动',
  },
  {
    state: 1,
    operationState: 'StableDrilling',
    stateLabel: '钻进稳定',
    shortLabel: '稳态',
    description: '稳定段进入基线候选池',
  },
  {
    state: 2,
    operationState: 'StableCirculation',
    stateLabel: '循环稳定',
    shortLabel: '循环',
    description: '泵仍运行，建立停泵前压力参照',
  },
  {
    state: 3,
    operationState: 'PumpStopped',
    stateLabel: '停泵监测',
    shortLabel: '停泵',
    description: '持续跟踪停泵出口流量与总池体积变化',
  },
  {
    state: 4,
    operationState: 'PumpRestarting',
    stateLabel: '开泵恢复',
    shortLabel: '开泵',
    description: '重新建立开泵后的水力参照',
  },
  {
    state: 5,
    operationState: 'Monitoring',
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
  const parsed = parseSourceDate(value);
  if (!parsed) return formatNow();
  return { timeStr: formatSourceTime(parsed), dateStr: formatSourceDate(parsed) };
}

function formatRecordDateTime(value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  return formatSourceDateTime(value);
}

function recordMillis(value?: string | number) {
  if (value === undefined || value === null || value === '') return Date.now();
  const parsed = parseSourceDateMs(value);
  return parsed === null ? Date.now() : parsed;
}

function keepMonitoringWindow<T extends { timestampMs?: number }>(items: T[], windowMs = monitoringWindowMs()) {
  const bounded = items.length > MAX_MONITORING_POINTS ? items.slice(-MAX_MONITORING_POINTS) : items;
  const latest = bounded.at(-1)?.timestampMs;
  if (!Number.isFinite(latest)) return bounded;
  const cutoff = Number(latest) - windowMs;
  const byTime = bounded.filter((item) => !Number.isFinite(item.timestampMs) || Number(item.timestampMs) >= cutoff);
  return byTime.length > MAX_MONITORING_POINTS ? byTime.slice(-MAX_MONITORING_POINTS) : byTime;
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

function trimMonitoringBufferInPlace<T extends { timestampMs?: number }>(items: T[], windowMs = monitoringWindowMs()) {
  if (items.length === 0) return items;
  const latestTimestamp = Number(items.at(-1)?.timestampMs ?? 0);
  const cutoff = Number.isFinite(latestTimestamp) ? latestTimestamp - windowMs : Number.NEGATIVE_INFINITY;
  let removeCount = 0;
  while (removeCount < items.length) {
    const timestamp = Number(items[removeCount]?.timestampMs ?? Number.NaN);
    if (!Number.isFinite(timestamp) || timestamp >= cutoff) break;
    removeCount += 1;
  }
  const overflow = Math.max(0, items.length - removeCount - MAX_MONITORING_POINTS);
  if (removeCount + overflow > 0) items.splice(0, removeCount + overflow);
  return items;
}

function appendMonitoringPoint<T extends { timestampMs?: number; time?: string }>(items: T[], point: T) {
  const last = items.at(-1);
  const pointKey = `${Number(point.timestampMs ?? 0)}|${String(point.time ?? '')}`;
  const lastKey = last ? `${Number(last.timestampMs ?? 0)}|${String(last.time ?? '')}` : '';
  if (pointKey === lastKey) return items;
  if (!last || Number(point.timestampMs ?? 0) >= Number(last.timestampMs ?? 0)) {
    items.push(point);
    return trimMonitoringBufferInPlace(items);
  }
  const normalized = keepMonitoringWindow(dedupeMonitoringPoints(sortMonitoringPoints([...items, point])));
  items.splice(0, items.length, ...normalized);
  return items;
}

function appendHistoryRecord(items: HistoryRecord[], point: HistoryRecord) {
  const last = items.at(-1);
  const key = `${point.date}|${point.time}|${point.bitDepth}|${point.backendLevel}`;
  const lastKey = last ? `${last.date}|${last.time}|${last.bitDepth}|${last.backendLevel}` : '';
  if (key === lastKey) return items;
  items.push(point);
  items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  if (items.length > 240) items.splice(0, items.length - 240);
  return items;
}

function dedupeHistoryRecords(items: HistoryRecord[]) {
  if (items.length <= 1) return items;
  items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
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
  const raw = readValue(record as Record<string, unknown>, keys);
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(record: RealTimeRecord, keys: string[]): number | null {
  const raw = readValue(record as Record<string, unknown>, keys);
  if (raw === undefined || raw === null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function finite(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalFinite(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function readPositiveNumber(record: RealTimeRecord, keys: string[], fallback?: number) {
  const value = readNumber(record, keys, Number.NaN);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  const entries = Object.entries(record);
  for (const key of keys) {
    const normalizedKey = key.toLowerCase();
    const matched = entries.find(([recordKey, value]) => (
      recordKey.toLowerCase() === normalizedKey
      && value !== undefined
      && value !== null
      && value !== ''
    ));
    if (matched) return matched[1];
  }
  return undefined;
}

function readObject(record: Record<string, unknown>, keys: string[]) {
  const value = readValue(record, keys);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readString(record: Record<string, unknown>, keys: string[], fallback = '') {
  const value = readValue(record, keys);
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || fallback;
}

function operationCategoryLabel(value: string) {
  const normalized = value.trim().replace(/[\s_-]/g, '').toLowerCase();
  const labels: Record<string, string> = {
    drilling: '钻进',
    circulation: '循环',
    staticobservation: '静观',
    trippingout: '起钻',
    trippingin: '下钻',
    pumpstarting: '开泵',
    pumpstopping: '停泵',
  };
  return labels[normalized] || '';
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
  const millis = parseSourceDateMs(value);
  return millis !== null && Number.isFinite(millis) ? millis : Number.NaN;
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
  } catch (error) {
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, message: error instanceof Error ? error.message : '写入失败' } }));
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
  } catch (error) {
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, message: error instanceof Error ? error.message : '写入失败' } }));
  }
  return value;
}

function dispatchStorageError(key: string, error: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, message: error instanceof Error ? error.message : '写入失败' } }));
}

function openSnapshotDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'));
      return;
    }
    const request = indexedDB.open(SNAPSHOT_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) database.createObjectStore(SNAPSHOT_STORE_NAME);
      if (!database.objectStoreNames.contains(EVENT_PROJECTION_STORE_NAME)) database.createObjectStore(EVENT_PROJECTION_STORE_NAME);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onblocked = () => reject(new Error('IndexedDB 升级被其他页面阻塞，请关闭旧页面后重试'));
    request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'));
  });
}

async function readWellSnapshotsFromIndexedDb(): Promise<Record<string, WellMonitoringSnapshot>> {
  try {
    const database = await openSnapshotDatabase();
    const rows = await new Promise<Array<[IDBValidKey, unknown]>>((resolve, reject) => {
      const transaction = database.transaction(SNAPSHOT_STORE_NAME, 'readonly');
      const store = transaction.objectStore(SNAPSHOT_STORE_NAME);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      transaction.oncomplete = () => resolve(keysRequest.result.map((key, index) => [key, valuesRequest.result[index]]));
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 读取失败'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 读取已中止'));
    });
    database.close();
    const snapshots: Record<string, WellMonitoringSnapshot> = {};
    rows.forEach(([key, value]) => {
      const snapshot = sanitizeWellMonitoringSnapshot(value);
      if (snapshot) snapshots[String(key)] = snapshot;
    });
    return snapshots;
  } catch (error) {
    dispatchStorageError(SNAPSHOT_STORE_NAME, error);
    return {};
  }
}

async function writeWellSnapshotsToIndexedDb(snapshots: Record<string, WellMonitoringSnapshot>) {
  try {
    const database = await openSnapshotDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SNAPSHOT_STORE_NAME);
      store.clear();
      Object.entries(snapshots).forEach(([wellId, snapshot]) => store.put(snapshot, wellId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 写入失败'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 写入已中止'));
    });
    database.close();
  } catch (error) {
    dispatchStorageError(SNAPSHOT_STORE_NAME, error);
  }
}

interface CachedEventProjection {
  eventSpans: EventSpan[];
  lifecycleNodes: LifecycleNode[];
  updatedAt: string;
  cacheKey?: string;
}

async function readEventProjectionFromIndexedDb(wellId: string, expectedCacheKey?: string): Promise<CachedEventProjection | null> {
  try {
    const database = await openSnapshotDatabase();
    const value = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(EVENT_PROJECTION_STORE_NAME, 'readonly');
      const request = transaction.objectStore(EVENT_PROJECTION_STORE_NAME).get(wellId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('事件投影缓存读取失败'));
    });
    database.close();
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const cacheKey = row.cacheKey ? String(row.cacheKey) : '';
    if (expectedCacheKey && cacheKey !== expectedCacheKey) return null;
    const eventSpans = Array.isArray(row.eventSpans) ? row.eventSpans.map(normalizeEventSpan).filter(Boolean) as EventSpan[] : [];
    const lifecycleNodes = Array.isArray(row.lifecycleNodes) ? row.lifecycleNodes.map(normalizeLifecycleNode).filter(Boolean) as LifecycleNode[] : [];
    if (eventSpans.length === 0 && lifecycleNodes.length === 0) return null;
    return { eventSpans, lifecycleNodes, updatedAt: String(row.updatedAt || '') || new Date().toISOString(), cacheKey };
  } catch (error) {
    dispatchStorageError(EVENT_PROJECTION_STORE_NAME, error);
    return null;
  }
}

async function writeEventProjectionToIndexedDb(wellId: string, projection: CachedEventProjection) {
  try {
    const database = await openSnapshotDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(EVENT_PROJECTION_STORE_NAME, 'readwrite');
      transaction.objectStore(EVENT_PROJECTION_STORE_NAME).put(projection, wellId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('事件投影缓存写入失败'));
      transaction.onabort = () => reject(transaction.error || new Error('事件投影缓存写入已中止'));
    });
    database.close();
  } catch (error) {
    dispatchStorageError(EVENT_PROJECTION_STORE_NAME, error);
  }
}

async function deleteEventProjectionFromIndexedDb(wellId: string) {
  try {
    const database = await openSnapshotDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(EVENT_PROJECTION_STORE_NAME, 'readwrite');
      transaction.objectStore(EVENT_PROJECTION_STORE_NAME).delete(wellId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('事件投影缓存删除失败'));
      transaction.onabort = () => reject(transaction.error || new Error('事件投影缓存删除已中止'));
    });
    database.close();
  } catch (error) {
    dispatchStorageError(EVENT_PROJECTION_STORE_NAME, error);
  }
}

function saveWellSelection(key: string, value: string) {
  persistStringValueState(key, value);
}

function saveWellListSelection(key: string, value: string[]) {
  persistStringListState(key, value);
}

function sameStringList(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function normalizeMonitoringMode(value: unknown): MonitoringMode {
  return value === 'historyReplay' ? 'historyReplay' : 'realtime';
}

export const REPLAY_SPEED_OPTIONS: readonly ReplaySpeed[] = [1, 2, 5, 10];
const REPLAY_BASE_INTERVAL_MS = 1200;
// The field sender publishes one sample every five seconds. Realtime mode
// follows that cadence; it never advances a cursor when there is no new row.
const REALTIME_FRAME_INTERVAL_MS = 5000;

function normalizeReplaySpeed(value: unknown): ReplaySpeed {
  const speed = Number(value);
  return speed === 2 || speed === 5 || speed === 10 ? speed : 1;
}

function replayIntervalMs(speed: ReplaySpeed) {
  return Math.max(100, Math.round(REPLAY_BASE_INTERVAL_MS / speed));
}

function wellLatestSampleTime(well?: WellInfo | null) {
  // sampleEndTime is the source wall-clock value used by the stream query.
  // Prefer it over the transport status timestamp, which may be serialized
  // with a UTC offset by the API.
  return normalizeSampleTime(well?.sampleEndTime || well?.lastRealtimeSampleTime || well?.endTime || well?.discoveryTime || well?.startTime || '');
}

function wellEarliestSampleTime(well?: WellInfo | null) {
  return normalizeSampleTime(well?.sampleStartTime || well?.startTime || well?.discoveryTime || '');
}

function clampReplayStartTime(value: string, well?: WellInfo | null) {
  const normalized = normalizeSampleTime(value);
  const first = wellEarliestSampleTime(well);
  const last = wellLatestSampleTime(well);
  const valueMs = parseDateLikeMs(normalized);
  const firstMs = parseDateLikeMs(first);
  const lastMs = parseDateLikeMs(last);
  if (!normalized) return first || last || '';
  if (first && valueMs !== null && firstMs !== null && valueMs < firstMs) return first;
  if (last && valueMs !== null && lastMs !== null && valueMs > lastMs) return last;
  return normalized;
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
  return {
    wellId,
    monitoringMode: normalizeMonitoringMode(row.monitoringMode),
    sessionCode: row.sessionCode ? String(row.sessionCode) : undefined,
    runtimeId: row.runtimeId ? String(row.runtimeId) : undefined,
    status: wasActive ? 'connecting' : (['paused', 'disconnected', 'error'].includes(rawStatus) ? rawStatus as DataSourceConnectionStatus : 'paused'),
    isRunning: false,
    backendRuntimeStatus: ['Running', 'Recovering', 'Completed', 'Stopping', 'Stopped', 'Faulted'].includes(String(row.backendRuntimeStatus))
      ? String(row.backendRuntimeStatus) as WellRuntimeState['backendRuntimeStatus']
      : undefined,
    connectionStatus: ['connected', 'connecting', 'reconnecting', 'catchingUp', 'paused', 'error', 'disconnected'].includes(String(row.connectionStatus))
      ? String(row.connectionStatus) as DataSourceConnectionStatus
      : undefined,
    isBackendRunning: typeof row.isBackendRunning === 'boolean' ? row.isBackendRunning : undefined,
    isSubscriberConnected: typeof row.isSubscriberConnected === 'boolean' ? row.isSubscriberConnected : undefined,
    lastSeenSourceRowNo: Number.isFinite(Number(row.lastSeenSourceRowNo)) ? Number(row.lastSeenSourceRowNo) : undefined,
    backendCurrentSourceRowNo: Number.isFinite(Number(row.backendCurrentSourceRowNo)) ? Number(row.backendCurrentSourceRowNo) : undefined,
    lastSeenSampleTime: row.lastSeenSampleTime ? String(row.lastSeenSampleTime) : null,
    backendCurrentSampleTime: row.backendCurrentSampleTime ? String(row.backendCurrentSampleTime) : null,
    reconnectAttempt: Math.max(0, finite(row.reconnectAttempt, 0)),
    missedFrameCount: Math.max(0, finite(row.missedFrameCount, 0)),
    subscriberDisconnectReason: row.subscriberDisconnectReason ? String(row.subscriberDisconnectReason) : undefined,
    runtimeStopReason: row.runtimeStopReason ? String(row.runtimeStopReason) : undefined,
    shouldAutoRestore: explicitAutoRestore === true ? wasActive : explicitAutoRestore ?? wasActive,
    recordCount: Math.max(0, finite(row.recordCount, 0)),
    lastRecordAt: row.lastRecordAt ? String(row.lastRecordAt) : null,
    backendLevel: normalizeBackendLevel(row.backendLevel),
    latestWellDepth: Number.isFinite(Number(row.latestWellDepth)) ? Number(row.latestWellDepth) : undefined,
    latestBitDepth: Number.isFinite(Number(row.latestBitDepth)) ? Number(row.latestBitDepth) : undefined,
    latestFormation: row.latestFormation ? String(row.latestFormation) : undefined,
    monitoringStartedAt: row.monitoringStartedAt ? String(row.monitoringStartedAt) : null,
    startedSampleTime: row.startedSampleTime ? String(row.startedSampleTime) : null,
    selectedReplayStartTime: row.selectedReplayStartTime ? String(row.selectedReplayStartTime) : null,
    replaySpeed: normalizeReplaySpeed(row.replaySpeed),
    pausedSampleTime: row.pausedSampleTime ? String(row.pausedSampleTime) : null,
    message: wasActive
      ? '正在恢复上次监测流'
      : String(row.message || '待启动'),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

function getInitialWellRuntimeStates() {
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_WELL_RUNTIME_STATES, {});
  const snapshots: Record<string, WellMonitoringSnapshot> = {};
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
      latestWellDepth: runtime.latestWellDepth ?? snapshot?.latestWellDepth ?? snapshot?.currentData.wellDepth ?? undefined,
      latestBitDepth: runtime.latestBitDepth ?? snapshot?.latestBitDepth ?? snapshot?.currentData.bitDepth ?? undefined,
      latestFormation: runtime.latestFormation ?? snapshot?.latestFormation ?? snapshot?.currentData.formation,
      shouldAutoRestore: runtime.shouldAutoRestore ?? isRuntimeStreamActive(runtime),
      selectedReplayStartTime: runtime.selectedReplayStartTime || snapshot?.startedSampleTime || snapshot?.currentSampleTime || null,
      replaySpeed: runtime.replaySpeed,
      pausedSampleTime: runtime.pausedSampleTime || null,
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
      monitoringMode: 'historyReplay',
      status: 'paused',
      isRunning: false,
      shouldAutoRestore: false,
      recordCount: snapshot.historyRecords.length,
      lastRecordAt: snapshot.lastRecordAt || snapshot.currentSampleTime || null,
      backendLevel: snapshot.backendDetection.advisoryLevel,
      latestWellDepth: snapshot.latestWellDepth ?? snapshot.currentData.wellDepth ?? undefined,
      latestBitDepth: snapshot.latestBitDepth ?? snapshot.currentData.bitDepth ?? undefined,
      latestFormation: snapshot.latestFormation ?? snapshot.currentData.formation,
      monitoringStartedAt: resolveMonitoringStartedAt(null, snapshot),
      startedSampleTime: snapshot.startedSampleTime || snapshot.currentSampleTime || null,
      selectedReplayStartTime: snapshot.startedSampleTime || snapshot.currentSampleTime || null,
      replaySpeed: 1,
      pausedSampleTime: null,
      message: '已保留本地历史，可按需继续回放',
      updatedAt: new Date().toISOString(),
    };
  });
  return sanitized;
}


function sanitizeStoredMonitoringData(value: unknown): MonitoringData {
  const fallback = makeInitialData(EMPTY_WELL_INFO);
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Record<string, unknown>;
  return {
    ...fallback,
    ...row as Partial<MonitoringData>,
    pitGain: optionalFinite(row.pitGain) ?? null,
    pitVolume: optionalFinite(row.pitVolume) ?? null,
    flowIn: optionalFinite(row.flowIn) ?? null,
    flowOut: optionalFinite(row.flowOut) ?? null,
    casingPressure: optionalFinite(row.casingPressure) ?? null,
    drillPipePressure: optionalFinite(row.drillPipePressure) ?? null,
    spp: optionalFinite(row.spp) ?? null,
    sppPredicted: optionalFinite(row.sppPredicted) ?? null,
    spm1: optionalFinite(row.spm1) ?? null,
    spm2: optionalFinite(row.spm2) ?? null,
    spm3: optionalFinite(row.spm3) ?? null,
    totalSpm: optionalFinite(row.totalSpm) ?? null,
    totalSpmComplete: Boolean(row.totalSpmComplete),
    mudWeight: optionalFinite(row.mudWeight) ?? null,
    mudTemp: optionalFinite(row.mudTemp) ?? null,
    rop: optionalFinite(row.rop) ?? null,
    hookLoad: optionalFinite(row.hookLoad) ?? null,
    wob: optionalFinite(row.wob) ?? null,
    totalGas: optionalFinite(row.totalGas) ?? null,
    torque: optionalFinite(row.torque) ?? null,
    wellDepth: optionalFinite(row.wellDepth) ?? null,
    bitDepth: optionalFinite(row.bitDepth) ?? null,
    rpm: optionalFinite(row.rpm) ?? null,
    confidenceLevel: finite(row.confidenceLevel, fallback.confidenceLevel),
    pumpState: row.pumpState ? String(row.pumpState) : fallback.pumpState,
    condition: row.condition ? String(row.condition) : fallback.condition,
    formation: row.formation ? String(row.formation) : fallback.formation,
    casingShoeDepth: optionalFinite(row.casingShoeDepth),
    drillPipeOD: optionalFinite(row.drillPipeOD),
    bhaOD: optionalFinite(row.bhaOD),
    bitOD: optionalFinite(row.bitOD),
    casingID: optionalFinite(row.casingID),
    openHoleDiameter: optionalFinite(row.openHoleDiameter),
    ecd: optionalFinite(row.ecd),
    porePressureEquivalent: optionalFinite(row.porePressureEquivalent),
    fractureGradientEquivalent: optionalFinite(row.fractureGradientEquivalent),
    inclination: optionalFinite(row.inclination),
    highSideDirection: optionalFinite(row.highSideDirection),
  };
}

function normalizeBaselineSnapshot(value: unknown): BaselineSnapshot {
  if (!value || typeof value !== 'object') return INITIAL_BASELINE_SNAPSHOT;
  const row = value as Record<string, unknown>;
  const minimumReferenceSamples = Math.max(1, Math.round(finite(readValue(row, ['minimumReferenceSamples', 'minimum_reference_samples']), 60)));
  const minimumReferenceExposureSeconds = Math.max(0, finite(readValue(row, ['minimumReferenceExposureSeconds', 'minimum_reference_exposure_seconds']), 0));
  const rawChannels = readValue(row, ['channels']) ?? [];
  const channels = Array.isArray(rawChannels)
    ? rawChannels.map((item) => {
      if (!item || typeof item !== 'object') return null;
      const channel = item as Record<string, unknown>;
      return {
        channel: String(readValue(channel, ['channel']) || ''),
        label: String(readValue(channel, ['label']) || readValue(channel, ['channel']) || ''),
        state: String(readValue(channel, ['state']) || 'Unavailable'),
        ready: readBoolean(readValue(channel, ['ready']), false),
        frozen: readBoolean(readValue(channel, ['frozen']), false),
        supportingSampleCount: Math.max(0, Math.round(finite(readValue(channel, ['supportingSampleCount', 'supporting_sample_count']), 0))),
         candidateSampleCount: Math.max(0, Math.round(finite(readValue(channel, ['candidateSampleCount', 'candidate_sample_count']), 0))),
         activeSampleCount: Math.max(0, Math.round(finite(readValue(channel, ['activeSampleCount', 'active_sample_count']), 0))),
         currentSiValue: optionalFinite(readValue(channel, ['currentSiValue', 'current_si_value'])) ?? null,
         expectedSiValue: optionalFinite(readValue(channel, ['expectedSiValue', 'expected_si_value'])) ?? null,
        lowerBoundSiValue: optionalFinite(readValue(channel, ['lowerBoundSiValue', 'lower_bound_si_value'])) ?? null,
        upperBoundSiValue: optionalFinite(readValue(channel, ['upperBoundSiValue', 'upper_bound_si_value'])) ?? null,
        modelKind: String(readValue(channel, ['modelKind', 'model_kind']) || ''),
        applicability: String(readValue(channel, ['applicability']) || ''),
        operationContextKey: String(readValue(channel, ['operationContextKey', 'operation_context_key']) || ''),
      } satisfies BaselineChannelSnapshot;
    }).filter((item): item is BaselineChannelSnapshot => Boolean(item?.channel))
    : [];
  const ready = readBoolean(readValue(row, ['ready']), false);
  return {
    status: String(readValue(row, ['status']) || (ready ? 'Ready' : 'Warmup')),
    ready,
    warmup: readBoolean(readValue(row, ['warmup']), !ready),
    minimumReferenceSamples,
    minimumReferenceExposureSeconds,
    readyChannelCount: Math.max(0, Math.round(finite(readValue(row, ['readyChannelCount', 'ready_channel_count']), channels.filter((item) => item.ready).length))),
    channelCount: Math.max(0, Math.round(finite(readValue(row, ['channelCount', 'channel_count']), channels.length))),
    frozenChannelCount: Math.max(0, Math.round(finite(readValue(row, ['frozenChannelCount', 'frozen_channel_count']), channels.filter((item) => item.frozen).length))),
    source: String(readValue(row, ['source']) || INITIAL_BASELINE_SNAPSHOT.source),
    selection: String(readValue(row, ['selection']) || INITIAL_BASELINE_SNAPSHOT.selection),
    lastUpdatedAt: String(readValue(row, ['lastUpdatedAt', 'last_updated_at']) || ''),
    channels,
  };
}

function buildBaselineSnapshotFromReferences(value: unknown): BaselineSnapshot {
  if (!Array.isArray(value) || value.length === 0) return INITIAL_BASELINE_SNAPSHOT;
  const labels: Record<string, string> = {
    standpipe_pressure: '立压',
    outlet_flow: '出口流量',
    outlet_density: '出口密度',
    total_pit_volume: '总池体积',
    casing_pressure: '套压',
    total_gas: '全烃',
  };
  const channels = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const reference = item as Record<string, unknown>;
    const channel = String(readValue(reference, ['channel']) || '').trim();
    if (!channel) return [];
    const modelKind = String(readValue(reference, ['modelKind', 'model_kind']) || 'conditional-reference');
    const ready = readBoolean(readValue(reference, ['ready']), false);
    const supportingSampleCount = Math.max(0, Math.round(finite(readValue(reference, ['supportingSampleCount', 'supporting_sample_count']), 0)));
    const state = ready
      ? 'Active'
      : modelKind === 'local-window'
        ? 'LocalWindow'
        : modelKind === 'local-anchor'
          ? 'LocalAnchor'
          : supportingSampleCount > 0 ? 'Candidate' : 'Unavailable';
    return [{
      channel,
      label: labels[channel] || channel,
      state,
      ready,
      frozen: false,
      supportingSampleCount,
      candidateSampleCount: 0,
      activeSampleCount: ready ? supportingSampleCount : 0,
      currentSiValue: optionalFinite(readValue(reference, ['currentSiValue', 'current_si_value'])) ?? null,
      expectedSiValue: optionalFinite(readValue(reference, ['expectedSiValue', 'expected_si_value'])) ?? null,
      lowerBoundSiValue: optionalFinite(readValue(reference, ['lowerBoundSiValue', 'lower_bound_si_value'])) ?? null,
      upperBoundSiValue: optionalFinite(readValue(reference, ['upperBoundSiValue', 'upper_bound_si_value'])) ?? null,
      modelKind,
      applicability: String(readValue(reference, ['applicability']) || ''),
      operationContextKey: String(readValue(reference, ['operationContextKey', 'operation_context_key']) || ''),
    } satisfies BaselineChannelSnapshot];
  });
  const readyChannelCount = channels.filter((channel) => channel.ready).length;
  const hasCoreReference = channels.some((channel) => channel.channel === 'standpipe_pressure' && channel.ready)
    && channels.some((channel) => channel.channel === 'outlet_flow' && channel.ready);
  return {
    status: hasCoreReference ? 'Ready' : 'Warmup',
    ready: hasCoreReference,
    warmup: !hasCoreReference,
    minimumReferenceSamples: 60,
    minimumReferenceExposureSeconds: 0,
    readyChannelCount,
    channelCount: channels.length,
    frozenChannelCount: 0,
    source: 'conditional-reference-bank',
    selection: '工况核心参考 + 机械扩展参考',
    lastUpdatedAt: '',
    channels,
  };
}

function sanitizeStoredBackendDetection(value: unknown): BackendDetectionState {
  if (!value || typeof value !== 'object') return INITIAL_BACKEND_DETECTION;
  const row = value as Partial<BackendDetectionState> & Record<string, unknown>;
  return {
    ...INITIAL_BACKEND_DETECTION,
    ...row,
    advisoryLevel: normalizeBackendLevel(row.advisoryLevel ?? row.publicLevel),
    publicLevel: normalizeBackendLevel(row.publicLevel),
    formalEvalLevel: normalizeBackendLevel(row.formalEvalLevel),
    eventTitle: String(row.eventTitle || INITIAL_BACKEND_DETECTION.eventTitle),
    physicalDescription: String(row.physicalDescription || row.reason || INITIAL_BACKEND_DETECTION.physicalDescription),
    primaryParameter: String(row.primaryParameter || INITIAL_BACKEND_DETECTION.primaryParameter),
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
    baselineSnapshot: normalizeBaselineSnapshot(row.baselineSnapshot || row.baseline),
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
    operationState: parseOperationCycleState(row.operationState, state),
    hypothesisState: parseHypothesisCycleState(row.hypothesisState),
    source: row.source === 'backend' ? 'backend' : 'unknown',
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
    sessionCode: row.sessionCode ? String(row.sessionCode) : null,
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

function getInitialWellSnapshots(): Record<string, WellMonitoringSnapshot> {
  return {};
}

function isAcknowledgedStatus(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['acknowledged', 'confirmed', 'accepted', 'closed'].includes(normalized);
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
    warningId: Number.isFinite(Number(row.warningId)) ? Number(row.warningId) : undefined,
    lifecycleStatus: row.lifecycleStatus ? String(row.lifecycleStatus) : undefined,
    ackStatus: row.ackStatus ? String(row.ackStatus) : undefined,
    acknowledgedBy: row.acknowledgedBy ? String(row.acknowledgedBy) : undefined,
    acknowledgedAt: row.acknowledgedAt ? String(row.acknowledgedAt) : undefined,
    acknowledgementCount: Math.max(0, Math.round(finite(row.acknowledgementCount, 0))),
    wellId: row.wellId ? String(row.wellId) : undefined,
    wellName: row.wellName ? String(row.wellName) : undefined,
    sessionCode: row.sessionCode ? String(row.sessionCode) : undefined,
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
    currentBackendLevel: normalizeBackendLevel(row.currentBackendLevel ?? backendLevel),
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
  last_source_row_no?: number;
  lastSourceRowNo?: number;
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

function createInitialDataSourceState(endpoint: string, selectedStartTime = '', mode: MonitoringMode = 'realtime'): DataSourceState {
  return {
    mode,
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
      || runtime.status === 'reconnecting'
      || runtime.status === 'catchingUp'
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
  const fallbackWell = EMPTY_WELL_INFO;
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
    pitGain: null,
    pitVolume: null,
    flowIn: null,
    flowOut: null,
    casingPressure: null,
    drillPipePressure: null,
    spp: null,
    sppPredicted: null,
    spm1: null,
    spm2: null,
    spm3: null,
    totalSpm: null,
    totalSpmComplete: false,
    mudWeight: null,
    mudTemp: null,
    rop: null,
    hookLoad: null,
    wob: null,
    totalGas: null,
    torque: null,
    wellDepth: null,
    bitDepth: null,
    rpm: null,
    confidenceLevel: 0,
    pumpState: 'Normal',
    condition: '等待接入',
    operationCategory: '',
    operationDetail: '',
    operationRecognitionAvailable: false,
    operationRecognitionSource: '',
    formation: well.targetLayer || '',
  };
}

function createWellMonitoringSnapshot(well: WellInfo, sessionCode: string | null = null): WellMonitoringSnapshot {
  const initialData = makeInitialData(well);
  return {
    sessionCode,
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
    latestWellDepth: initialData.wellDepth ?? undefined,
    latestBitDepth: initialData.bitDepth ?? undefined,
    latestFormation: initialData.formation,
  };
}

function normalizeRealTimeRecord(record: RealTimeRecord, previous: MonitoringData): MonitoringData {
  const operation = readObject(record, ['operation', 'Operation']);
  const flowIn = readNullableNumber(record, ['flowIn', 'inletSmooth', 'inletRaw', 'InletSmooth', 'InletRaw', 'inlet_smooth', 'inlet_raw', 'inlet_flow_raw', 'inletFlow', 'inlet_flow', 'pump_flow_in']);
  const flowOut = readNullableNumber(record, ['flowOut', 'outletSmooth', 'outletRaw', 'OutletSmooth', 'OutletRaw', 'outlet_smooth', 'outlet_raw', 'outlet_flow_raw', 'outletFlow', 'outlet_flow', 'return_flow']);
  const spp = readNullableNumber(record, ['spp', 'standpipe_pressure_mpa', 'spp_mpa', 'standpipePressureMpa']);
  const sppPredicted = readNullableNumber(record, ['sppPredicted', 'spp_predicted_mpa', 'spp_model_mpa', 'predicted_spp_mpa']);
  const pitVolume = readNullableNumber(record, ['pitVolume', 'poolSmooth', 'poolRaw', 'PoolSmooth', 'PoolRaw', 'pool_smooth', 'pool_raw', 'total_pit_volume_m3', 'pit_volume', 'totalPitVolumeM3']);
  const pitGain = readNullableNumber(record, ['pitGain', 'pitGainM3', 'PitGainM3', 'pool_delta_abs', 'gain_loss_raw', 'pit_gain_m3']);
  const casingPressure = readNullableNumber(
    record,
    ['casingPressure', 'cp', 'casing_pressure_mpa', 'casingPressureMpa', 'logging_casing_pressure_mpa', 'measured_casing_pressure_mpa'],
  );
  const operationCategory = readString(operation || {}, ['category', 'Category'], previous.operationCategory || '');
  const operationLabel = readString(operation || {}, ['categoryLabel', 'CategoryLabel'], '');
  const operationDetail = readString(operation || {}, ['detail', 'Detail'], previous.operationDetail || '');
  const conditionFromOperation = operationLabel || operationCategoryLabel(operationCategory);
  const directCondition = readString(record, ['condition', 'operationCondition', 'operation_condition'], '');
  const condition = conditionFromOperation || directCondition || previous.condition || '等待接入';
  const boundaryCategory = operationCategoryLabel(operationCategory);
  const operationPumpState = readString(operation || {}, ['pumpState', 'PumpState'], '');
  const directPumpState = readString(record, ['pumpState', 'pump_state', 'PumpState'], '');
  const pumpState = boundaryCategory === '停泵' || boundaryCategory === '开泵'
    ? boundaryCategory
    : directPumpState || operationPumpState || previous.pumpState || 'Unknown';

  return {
    pitGain,
    pitVolume,
    flowIn,
    flowOut,
    outletUnit: readString(record, ['outletUnit', 'outlet_unit', 'OutletUnit'], previous.outletUnit || ''),
    outletSemantic: readString(record, ['outletSemantic', 'outlet_semantic', 'OutletSemantic'], previous.outletSemantic || ''),
    casingPressure,
    drillPipePressure: readNullableNumber(record, ['drillPipePressure', 'standpipe_pressure_mpa', 'spp_mpa']),
    spp,
    sppPredicted,
    spm1: readNullableNumber(record, ['spm1', 'Spm1', 'pump_spm_1']),
    spm2: readNullableNumber(record, ['spm2', 'Spm2', 'pump_spm_2']),
    spm3: readNullableNumber(record, ['spm3', 'Spm3', 'pump_spm_3']),
    totalSpm: readNullableNumber(record, ['totalSpm', 'TotalSpm', 'spm', 'pump_spm_total']),
    totalSpmComplete: readBoolean(
      readValue(record as Record<string, unknown>, ['totalSpmComplete', 'TotalSpmComplete']),
      false,
    ),
    mudWeight: readNullableNumber(record, ['mudWeight', 'inlet_density_g_cm3', 'mud_weight']),
    mudTemp: readNullableNumber(record, ['mudTemp', 'inlet_temperature_c', 'outlet_temperature_c']),
    rop: readNullableNumber(record, ['rop', 'Rop', 'rop_m_per_min', 'rate_of_penetration']),
    hookLoad: readNullableNumber(record, ['hookLoad', 'hookLoadKn', 'hook_load_kn']),
    wob: readNullableNumber(record, ['wob', 'wobKn', 'wob_kn', 'weightOnBit', 'weight_on_bit_kn', 'WOBX']),
    totalGas: readNullableNumber(record, ['totalGas', 'gas', 'total_gas_pct', 'gas_pct']),
    torque: readNullableNumber(record, ['torque', 'torque_knm']),
    wellDepth: readNullableNumber(record, ['wellDepth', 'well_depth', 'well_depth_m', 'holeDepth', 'hole_depth', 'hole_depth_m', 'measuredDepth', 'measured_depth', 'measured_depth_m', 'currentDepth', 'current_depth', 'depth', '井深']),
    bitDepth: readNullableNumber(record, ['bitDepth', 'bit_depth', 'bit_depth_m', 'bitPosition', 'bit_position', 'bit_position_m', '钻头位置']),
    rpm: readNullableNumber(record, ['rpm', 'rotaryRpm', 'rotary_rpm', 'rotary_speed_rpm']),
    confidenceLevel: readNumber(record, ['confidenceLevel', 'formal_eval_level', 'public_level', 'confidence_level'], previous.confidenceLevel),
    pumpState,
    condition,
    operationCategory,
    operationDetail,
    operationRecognitionAvailable: readBoolean(
      readValue(operation || {}, ['recognitionAvailable', 'RecognitionAvailable']),
      previous.operationRecognitionAvailable || false,
    ),
    operationRecognitionSource: readString(
      operation || {},
      ['recognitionSource', 'RecognitionSource'],
      previous.operationRecognitionSource || '',
    ),
    formation: readString(record, ['formation', 'formation_name', 'layer', 'layer_name', 'stratum', 'stratum_name', 'horizon', 'horizon_name', 'lithology', 'block_name', '层位'], previous.formation || ''),
    casingShoeDepth: readPositiveNumber(record, ['casingShoeDepth', 'casing_shoe_depth_m', 'technical_casing_shoe_depth_m', 'last_casing_shoe_depth_m'], previous.casingShoeDepth),
    drillPipeOD: readPositiveNumber(record, ['drillPipeOD', 'drill_pipe_od_mm', 'drill_pipe_outer_diameter_mm'], previous.drillPipeOD),
    bhaOD: readPositiveNumber(record, ['bhaOD', 'bha_od_mm', 'bha_outer_diameter_mm'], previous.bhaOD),
    bitOD: readPositiveNumber(record, ['bitOD', 'bit_od_mm', 'bit_size_mm'], previous.bitOD),
    casingID: readPositiveNumber(record, ['casingID', 'casing_id_mm', 'casing_inner_diameter_mm'], previous.casingID),
    openHoleDiameter: readPositiveNumber(record, ['openHoleDiameter', 'open_hole_diameter_mm', 'hole_diameter_mm'], previous.openHoleDiameter),
    ecd: readPositiveNumber(record, ['ecd', 'ecd_g_cm3', 'equivalent_circulating_density'], previous.ecd),
    porePressureEquivalent: readPositiveNumber(record, ['porePressureEquivalent', 'pore_pressure_equivalent', 'pore_pressure_equivalent_g_cm3'], previous.porePressureEquivalent),
    fractureGradientEquivalent: readPositiveNumber(record, ['fractureGradientEquivalent', 'fracture_gradient_equivalent', 'fracture_gradient_equivalent_g_cm3'], previous.fractureGradientEquivalent),
    inclination: readNumber(record, ['inclination', 'inclination_deg', 'hole_inclination_deg'], previous.inclination ?? 0),
    highSideDirection: readNumber(record, ['highSideDirection', 'high_side_direction_deg', 'toolface_deg'], previous.highSideDirection ?? 0),
  };
}

function parseCycleState(value: unknown): CycleState | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 0 && rounded <= 5 ? rounded as CycleState : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parseCycleState(parsed);
    const byName: Record<string, CycleState> = {
      disturbance: 0,
      stabledrilling: 1,
      stablecirculation: 2,
      pumpstopped: 3,
      pumprestarting: 4,
      monitoring: 5,
    };
    return byName[normalized.replace(/[\s_-]/g, '').toLowerCase()] ?? null;
  }
  return null;
}

function parseOperationCycleState(value: unknown, fallbackState: CycleState | null): OperationCycleState {
  const state = parseCycleState(value) ?? fallbackState;
  return state === null ? 'Unknown' : CYCLE_STATES[state].operationState;
}

function parseHypothesisCycleState(value: unknown): HypothesisCycleState {
  const normalized = String(value || '').replace(/[\s_-]/g, '').toLowerCase();
  const values: Record<string, HypothesisCycleState> = {
    none: 'None',
    watchingpoststop: 'WatchingPostStop',
    awaitingrestartshorthold: 'AwaitingRestartShortHold',
    staticdriftreview: 'StaticDriftReview',
    longstopguard: 'LongStopGuard',
    restarting: 'Restarting',
    observingstablepumping: 'ObservingStablePumping',
    resolved: 'Resolved',
  };
  return values[normalized] ?? 'Unknown';
}

function cycleInfoFromRecord(record: RealTimeRecord, previous: CycleInfo): CycleInfo {
  const source = record as Record<string, unknown>;
  const rawOperation = readValue(source, ['operation_cycle_state', 'operationCycleState', 'operation_state_std', 'cycle_state', 'cycleState']);
  const state = parseCycleState(rawOperation);
  const rawHypothesis = readValue(source, ['hypothesis_cycle_state', 'hypothesisCycleState', 'cycle_candidate_state', 'cycleCandidateState']);
  if (state === null && rawHypothesis === undefined) return { ...previous, source: 'unknown' };
  const elapsed = Math.max(0, finite(readValue(source, ['cycle_seconds', 'cycleSeconds', 'elapsed_in_state', 'elapsedInState']), 0));
  const total = Math.max(elapsed, finite(readValue(source, ['total_state_seconds', 'totalStateSeconds']), elapsed || 1));
  return {
    ...(state !== null ? { ...previous, ...CYCLE_STATES[state], state } : previous),
    operationState: parseOperationCycleState(rawOperation, state),
    hypothesisState: parseHypothesisCycleState(rawHypothesis),
    source: 'backend',
    cycleIndex: Math.max(0, Math.round(finite(readValue(source, ['cycle_index', 'cycleIndex']), previous.cycleIndex))),
    elapsedInState: elapsed,
    totalStateSeconds: total,
    progress: total > 0 ? clamp((elapsed / total) * 100, 0, 100) : 0,
    tStopPump: String(readValue(source, ['t_stop_pump', 'tStopPump']) || previous.tStopPump || '') || null,
    tStartPump: String(readValue(source, ['t_start_pump', 'tStartPump']) || previous.tStartPump || '') || null,
    tStable: String(readValue(source, ['t_stable', 'tStable']) || previous.tStable || '') || null,
  };
}

function buildRealtimeApiUrl(endpoint: string, path: string) {
  const base = endpoint.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${base}${suffix}`, window.location.origin).toString();
}

const HISTORY_REPLAY_MAX_FRAMES = 2_000;
const MAX_BUFFERED_REPLAY_FRAMES = 600;
const MAX_TRACKED_BACKEND_EVENTS = 4_096;

const INITIAL_BASELINE_SNAPSHOT: BaselineSnapshot = {
  status: 'Unavailable',
  ready: false,
  warmup: true,
  minimumReferenceSamples: 60,
  minimumReferenceExposureSeconds: 0,
  readyChannelCount: 0,
  channelCount: 0,
  frozenChannelCount: 0,
  source: 'conditional-reference-bank',
  selection: '工况核心参考 + 机械扩展参考',
  lastUpdatedAt: '',
  channels: [],
};

function buildRealtimeStreamUrl(endpoint: string, wellId: string, startTime: string, rateMs: number, sessionCode?: string, lastSampleTime?: string | null, lastSourceRowNo?: number, lastEventId?: string, mode: DataSourceMode = 'realtime') {
  let url = new URL(buildRealtimeApiUrl(endpoint, `/wells/${encodeURIComponent(wellId)}/stream`));
  url.searchParams.set('rateMs', String(rateMs));
  if (mode === 'historyReplay') url.searchParams.set('limit', String(HISTORY_REPLAY_MAX_FRAMES));
  if (startTime) url.searchParams.set('startTime', startTime);
  if (sessionCode) url.searchParams.set('sessionCode', sessionCode);
  if (lastSampleTime) url.searchParams.set('afterSampleTime', lastSampleTime);
  if (Number.isFinite(lastSourceRowNo)) url.searchParams.set('afterSourceRowNo', String(lastSourceRowNo));
  if (lastEventId) url.searchParams.set('lastEventId', lastEventId);
  // Always declare the mode. Realtime must not depend on an API default: an
  // omitted value can otherwise be interpreted as a finite replay by older
  // servers, leaving the live UI at the current database tail.
  url = withMonitoringModeQuery(url, mode);
  return url.toString();
}

const INITIAL_BACKEND_DETECTION: BackendDetectionState = {
  advisoryLevel: 0,
  publicLevel: 0,
  formalEvalLevel: 0,
  eventTitle: 'L0：当前未发现需提示的参数异常',
  physicalDescription: '当前未发现需要提示的参数异常。',
  primaryParameter: '',
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
  baselineSnapshot: INITIAL_BASELINE_SNAPSHOT,
  preprocessing: null,
  referenceExperiment: null,
  pumpGate: null,
  precursorEligibility: null,
  operationContextV2: null,
};

function normalizeEventSpan(value: unknown): EventSpan | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const eventId = String(readValue(row, ['event_id', 'eventId']) || '').trim();
  const startTime = String(readValue(row, ['start_time', 'startTime']) || '').trim();
  if (!eventId || !startTime) return null;
  const endValue = readValue(row, ['end_time', 'endTime']);
  return {
    eventId,
    candidateId: Math.max(0, Math.round(finite(readValue(row, ['candidate_id', 'candidateId']), 0))),
    startTime,
    endTime: endValue ? String(endValue) : null,
    currentLevel: normalizeBackendLevel(readValue(row, ['current_level', 'currentLevel', 'public_level', 'publicLevel'])),
    highestLevel: normalizeBackendLevel(readValue(row, ['highest_level', 'highestLevel', 'peak_level', 'peakLevel'])),
    sampleCount: Math.max(0, Math.round(finite(readValue(row, ['sample_count', 'sampleCount']), 0))),
    lifecycleStatus: String(readValue(row, ['lifecycle_status', 'lifecycleStatus', 'status']) || 'active'),
    resolution: String(readValue(row, ['resolution', 'cycle_resolution', 'cycleResolution']) || '') || undefined,
  };
}

function normalizeLifecycleNode(value: unknown): LifecycleNode | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const eventId = String(readValue(row, ['event_id', 'eventId']) || '').trim();
  const timestamp = String(readValue(row, ['timestamp', 'event_time', 'eventTime']) || '').trim();
  if (!eventId || !timestamp) return null;
  return {
    eventId,
    candidateId: Math.max(0, Math.round(finite(readValue(row, ['candidate_id', 'candidateId']), 0))),
    timestamp,
    eventName: String(readValue(row, ['event_name', 'eventName', 'name']) || 'Lifecycle'),
    reason: displayAlarmText(readValue(row, ['reason']) || ''),
    publicLevel: normalizeBackendLevel(readValue(row, ['public_level', 'publicLevel', 'level'])),
  };
}

function unwrapCollection(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(row[key])) return row[key] as unknown[];
  return [];
}

function normalizeBackendLevel(value: unknown): BackendLevel {
  // The canonical backend HMI field is the advisory level and arrives as an
  // "L0".."L4" string; accept both string and numeric forms everywhere.
  if (typeof value === 'string') {
    const match = value.trim().match(/^L([0-4])$/i);
    if (match) return Number(match[1]) as BackendLevel;
  }
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
    .split(/[,、;；]/g)
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
  sessionCode?: string;
  candidateId?: number;
  warningId?: number;
  lifecycleStatus?: string;
  ackStatus?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  acknowledgementCount?: number;
  advisoryLevel: BackendLevel;
  publicLevel: BackendLevel;
  formalEvalLevel: BackendLevel;
  title: string;
  description: string;
  primaryParameter: string;
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
    const advisoryLevel = normalizeBackendLevel(
      readValue(row, ['advisory_level', 'advisoryLevel', 'level'])
        ?? readValue(row, ['public_level', 'publicLevel', 'formal_eval_level', 'formalEvalLevel']),
    );
    const publicLevel = normalizeBackendLevel(
      readValue(row, ['public_level', 'publicLevel', 'level', 'formal_eval_level', 'formalEvalLevel']),
    );
    const timestamp = String(readValue(row, ['timestamp']) ?? record.timestamp ?? record.sampleTime ?? record.sample_time ?? '');
    const candidateIdValue = Number(readValue(row, ['lifecycle_candidate_id', 'lifecycleCandidateId', 'candidate_id', 'candidateId']));
    const candidateId = Number.isFinite(candidateIdValue) && candidateIdValue > 0 ? Math.round(candidateIdValue) : undefined;
    const sessionCode = String(readValue(row, ['session_code', 'sessionCode']) ?? readValue(record as Record<string, unknown>, ['session_code', 'sessionCode']) ?? '').trim() || undefined;
    const rawEventId = String(readValue(row, ['event_id', 'eventId']) ?? '').trim();
    // Event identity is a backend fact. Do not reconstruct it from candidate
    // or timestamp fields: live, replay and review must share one canonical id.
    const eventId = rawEventId;
    if (!eventId) return [];
    const eventState = String(readValue(row, ['event_state', 'eventState', 'lifecycle_status', 'lifecycleStatus']) || 'unknown');
    const normalizedEventState = eventState.trim().toLowerCase();
    const shouldKeep = advisoryLevel >= 2 || ['watch', 'open', 'hold', 'recovery', 'recovering', 'resolved', 'closedunresolved', 'closed_unresolved', 'normal'].includes(normalizedEventState);
    if (!shouldKeep) return [];
    const presentation = operatorEventPresentation(row, advisoryLevel);
    return [{
      eventId,
      sessionCode,
      candidateId,
      warningId: Number.isFinite(Number(readValue(row, ['warning_id', 'warningId', 'id']))) ? Number(readValue(row, ['warning_id', 'warningId', 'id'])) : undefined,
      lifecycleStatus: String(readValue(row, ['lifecycle_status', 'lifecycleStatus']) || eventState),
      ackStatus: String(readValue(row, ['ack_status', 'ackStatus']) || ''),
      acknowledgedBy: String(readValue(row, ['acknowledged_by', 'acknowledgedBy']) || '') || undefined,
      acknowledgedAt: String(readValue(row, ['acknowledged_at', 'acknowledgedAt']) || '') || undefined,
      acknowledgementCount: Math.max(0, Math.round(finite(readValue(row, ['acknowledgement_count', 'acknowledgementCount']), 0))),
      advisoryLevel,
      publicLevel,
      formalEvalLevel: normalizeBackendLevel(readValue(row, ['formal_eval_level', 'formalEvalLevel']) ?? publicLevel),
      title: presentation.title,
      description: presentation.description,
      primaryParameter: presentation.primaryParameter,
      reason: presentation.description,
      activeSignals: presentation.abnormalParameters,
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
  return entry.eventId;
}

function fallbackQueueLogEntryFromFrame(record: RealTimeRecord): BackendLogEntry | null {
  const source = record as Record<string, unknown>;
  const advisoryLevel = normalizeBackendLevel(
    readValue(source, ['advisory_level', 'advisoryLevel', 'level', 'public_level', 'publicLevel', 'formal_eval_level', 'formalEvalLevel']),
  );
  const publicLevel = normalizeBackendLevel(
    readValue(source, ['public_level', 'publicLevel', 'formal_eval_level', 'formalEvalLevel', 'confidence_level', 'confidenceLevel']),
  );
  const candidateIdValue = Number(readValue(source, ['lifecycle_candidate_id', 'lifecycleCandidateId', 'candidate_id', 'candidateId']));
  const candidateId = Number.isFinite(candidateIdValue) && candidateIdValue > 0 ? Math.round(candidateIdValue) : undefined;
  const sessionCode = String(readValue(source, ['session_code', 'sessionCode']) || '').trim() || undefined;
  const rawEventId = String(readValue(source, ['event_id', 'eventId']) || '').trim();
  // A frame without the server-issued event id is not an event projection.
  const eventId = rawEventId;
  if (!eventId) return null;
  const timestamp = String(readValue(source, ['timestamp', 'sampleTime', 'sample_time']) || '');
    const presentation = operatorEventPresentation(source, advisoryLevel);
  const candidate = fallbackQueueCandidateFromFrame({
    eventId,
    candidateId,
    publicLevel: advisoryLevel,
    advisoryLevel,
    formalEvalLevel: normalizeBackendLevel(readValue(source, ['formal_eval_level', 'formalEvalLevel']) ?? publicLevel),
    reason: presentation.description,
    activeSignals: presentation.abnormalParameters,
    eventState: String(readValue(source, ['event_state', 'eventState', 'lifecycle_status', 'lifecycleStatus']) || 'unknown'),
    pumpState: String(readValue(source, ['pump_state', 'pumpState']) || 'Unknown'),
    timestamp,
    startTime: String(readValue(source, ['start_time', 'startTime']) || '') || undefined,
    endTime: String(readValue(source, ['end_time', 'endTime']) || '') || undefined,
    sampleCount: finite(readValue(source, ['sample_count', 'sampleCount']), 0) || undefined,
  });
  if (!candidate) return null;
  return {
    ...candidate,
    sessionCode,
    advisoryLevel: normalizeBackendLevel(candidate.advisoryLevel ?? candidate.publicLevel),
    publicLevel: normalizeBackendLevel(candidate.publicLevel),
    formalEvalLevel: normalizeBackendLevel(candidate.formalEvalLevel),
    title: presentation.title,
    description: presentation.description,
    primaryParameter: presentation.primaryParameter,
  };
}

function queueLogEntriesFromRecord(record: RealTimeRecord) {
  const entries = normalizeBackendLogEntries(record);
  const fallback = fallbackQueueLogEntryFromFrame(record);
  if (!fallback) return entries;
  const fallbackKey = backendEventKey(fallback);
  return entries.some((entry) => backendEventKey(entry) === fallbackKey && entry.advisoryLevel >= 2)
    ? entries
    : [...entries, fallback];
}

function normalizeBackendDetection(record: RealTimeRecord): BackendDetectionState {
  const source = record as Record<string, unknown>;
  const logs = normalizeBackendLogEntries(record);
  const latestLog = logs.at(-1);
  // advisoryLevel is the backend's canonical HMI value (see RealtimeDtos:
  // "Canonical L0--L4 level for HMI and API consumers"). It is read FIRST;
  // publicLevel and formalEvalLevel remain as audit/context fields only.
  const advisoryLevel = normalizeBackendLevel(
      readValue(source, ['advisory_level', 'advisoryLevel'])
      ?? readValue((readValue(source, ['warning', 'Warning']) as Record<string, unknown> | undefined) ?? {}, ['advisory_level', 'advisoryLevel'])
      ?? latestLog?.advisoryLevel,
  );
  const publicLevel = normalizeBackendLevel(
    readValue(source, ['public_level', 'publicLevel', 'formal_eval_level', 'formalEvalLevel', 'confidence_level', 'confidenceLevel'])
      ?? latestLog?.publicLevel,
  );
  // AdvisoryLevel is the backend's sole HMI authority. Public/formal levels
  // are retained for audit details only and must never raise the live badge,
  // lane colour, sound, or event queue after a backend downgrade/hold.
  const effectiveLevel = advisoryLevel;
  const formalEvalLevel = normalizeBackendLevel(
    readValue(source, ['formal_eval_level', 'formalEvalLevel']) ?? latestLog?.formalEvalLevel ?? publicLevel,
  );
  const timestamp = String(readValue(source, ['timestamp', 'sampleTime', 'sample_time']) || latestLog?.timestamp || '');
  const activeSignals = parseActiveSignals(readValue(source, ['active_signals', 'activeSignals']));
  const baselines = (readValue(source, ['baselines']) as Record<string, unknown> | undefined) ?? undefined;
  const rawBaseline = readValue(source, ['baseline', 'baselineSnapshot']) ?? baselines;
  const referenceSnapshot = buildBaselineSnapshotFromReferences(readValue(source, ['references']));
  const normalizedBaseline = normalizeBaselineSnapshot(rawBaseline);
  const baselineSnapshot = normalizedBaseline.channels.length > 0 || referenceSnapshot.channels.length === 0
    ? normalizedBaseline
    : referenceSnapshot;
  const frameEventIdValue = readValue(source, ['event_id', 'eventId']);
  const frameEventId = frameEventIdValue === undefined || frameEventIdValue === null || String(frameEventIdValue).trim() === ''
    ? null
    : String(frameEventIdValue);
  const baselineCount = finite(
    readValue(source, ['eval_baseline_count', 'evalBaselineCount'])
      ?? readValue(baselines ?? {}, ['count', 'Count'])
      ?? Math.max(...baselineSnapshot.channels.map((channel) => channel.supportingSampleCount), 0),
    Math.max(...baselineSnapshot.channels.map((channel) => channel.supportingSampleCount), 0),
  );
  const baselineWarmup = readBoolean(readValue(source, ['baseline_warmup', 'baselineWarmup']), baselineSnapshot.warmup);
  const monitoringReady = readBoolean(readValue(source, ['monitoring_ready', 'monitoringReady']), publicLevel >= 0);
  const baselineValid = readBoolean(readValue(source, ['baseline_valid', 'baselineValid']), baselineSnapshot.ready);
  const baselineInvalidReason = String(readValue(source, ['baseline_invalid_reason', 'baselineInvalidReason']) || '');
  const presentation = operatorEventPresentation(source, effectiveLevel);
  return {
    advisoryLevel,
    publicLevel,
    formalEvalLevel,
    eventTitle: presentation.title || latestLog?.title || '',
    physicalDescription: presentation.description || latestLog?.description || '',
    primaryParameter: presentation.primaryParameter || latestLog?.primaryParameter || '',
    reason: presentation.description || latestLog?.reason || '',
    activeSignals: presentation.abnormalParameters.length > 0 ? presentation.abnormalParameters : activeSignals.length > 0 ? activeSignals : latestLog?.activeSignals || [],
    eventState: String(
      readValue(source, ['event_state', 'eventState'])
        || latestLog?.eventState
        || (advisoryLevel >= 4 ? 'confirmed' : advisoryLevel >= 2 ? 'tracking' : advisoryLevel === 1 ? 'observing' : 'normal'),
    ),
    pumpState: String(
      readValue(source, ['pump_state', 'pumpState'])
        || readValue((readValue(source, ['operation', 'Operation']) as Record<string, unknown> | undefined) ?? {}, ['pump_state', 'pumpState'])
        || latestLog?.pumpState
        || 'Unknown',
    ),
    timestamp,
    eventId: latestLog?.eventId || frameEventId,
    baselineValid,
    baselineWarmup,
    monitoringReady,
    baselineCount,
    baselineSource: String(
      readValue(source, ['eval_baseline_source', 'evalBaselineSource'])
        || readValue(baselines ?? {}, ['source', 'Source'])
        || baselineSnapshot.source
        || '',
    ),
    baselineSelection: String(
      readValue(source, ['eval_baseline_selection', 'evalBaselineSelection'])
        || readValue(baselines ?? {}, ['selection', 'Selection'])
        || baselineSnapshot.selection
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
        || baselineSnapshot.lastUpdatedAt
        || '',
    ),
    baselineInvalidReason: baselineInvalidReason || (!baselineValid && !baselineWarmup ? '基线未建立或已失效' : ''),
    baselineSnapshot,
    preprocessing: normalizePreprocessingSnapshot(readValue(source, ['preprocessing'])),
    referenceExperiment: normalizeReferenceExperimentSnapshot(readValue(source, ['referenceExperiment', 'reference_experiment'])),
    pumpGate: normalizePumpGateDiagnostics(source),
    precursorEligibility: normalizePrecursorEligibility(source),
    operationContextV2: normalizeOperationContextV2(source),
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
    lastRealtimeSampleTime: String(row.lastRealtimeSampleTime || row.last_realtime_sample_time || ''),
  };
}

class SseDetectionDataSourceAdapter implements DataSourceAdapter {
  private controller: AbortController | null = null;
  private recordCallback: (record: RealTimeRecord) => void = () => {};
  private statusCallback: (state: DataSourceState) => void = () => {};
  private recordCount = 0;
  private lastSampleTime: string | null = null;
  private closedByClient = false;
  private completed = false;
  private terminalError = false;
  private replayQueue: RealTimeRecord[] = [];
  private replayTimer: number | null = null;

  constructor(private endpoint: string, private startTime: string, private rateMs = REALTIME_FRAME_INTERVAL_MS, private sessionCode?: string, initialSampleTime?: string | null, private lastSourceRowNo?: number, private lastEventId?: string, private mode: DataSourceMode = 'realtime') {
    this.lastSampleTime = normalizeSampleTime(initialSampleTime || '') || null;
  }

  connect(well: WellInfo, _seed?: MonitoringData) {
    this.disconnect();
    this.closedByClient = false;
    this.recordCount = 0;
    this.lastSampleTime = normalizeSampleTime(this.lastSampleTime || '') || null;
    this.completed = false;
    this.terminalError = false;
    this.replayQueue = [];
    if (this.replayTimer !== null) {
      window.clearTimeout(this.replayTimer);
      this.replayTimer = null;
    }
    const controller = new AbortController();
    this.controller = controller;
    const url = buildRealtimeStreamUrl(this.endpoint, well.wellId, this.startTime || well.discoveryTime || well.startTime || '', this.rateMs, this.sessionCode, this.lastSampleTime, this.lastSourceRowNo, this.lastEventId, this.mode);
    this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'connecting', endpoint: url, message: `正在建立 ${well.wellName} 检测流`, lastRecordAt: null, recordCount: 0 });
    void this.consume(url, well, controller);
  }

  private async consume(url: string, well: WellInfo, controller: AbortController) {
    try {
      const response = await authenticatedFetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/event-stream' } });
      if (!response.ok || !response.body) {
        if ([401, 403, 409].includes(response.status)) {
          this.terminalError = true;
          this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: response.status === 401 || response.status === 403 ? 'unauthorized' : 'error', endpoint: url, message: `检测流请求被后端拒绝（HTTP ${response.status}）`, lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null, recordCount: this.recordCount, sessionCode: this.sessionCode });
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'connected', endpoint: url, message: '检测流已接入，等待数据帧', lastRecordAt: null, recordCount: this.recordCount });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          this.handleBlock(block, well);
          boundary = buffer.indexOf('\n\n');
        }
      }
      if (!controller.signal.aborted && !this.completed && !this.terminalError) this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'reconnecting', endpoint: url, message: `检测流断开，正在重连 · ${this.recordCount} 帧`, lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null, recordCount: this.recordCount, sessionCode: this.sessionCode });
    } catch (error) {
      if (controller.signal.aborted || this.closedByClient) return;
      if (this.terminalError) return;
      this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'reconnecting', endpoint: url, message: `检测流连接中断，正在重连：${error instanceof Error ? error.message : '未知错误'}`, lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null, recordCount: this.recordCount, sessionCode: this.sessionCode });
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  private handleBlock(block: string, well: WellInfo) {
    let eventName = 'message';
    const dataLines: string[] = [];
    block.split('\n').forEach((line) => {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    });
    const dataText = dataLines.join('\n');
    if (!dataText) return;
    // One malformed frame must never kill the whole transport: parsing it
    // here keeps the reconnect cycle (and its cursor) intact and skips only
    // the bad block.
    let data: RealTimeRecord & Record<string, unknown>;
    try {
      data = JSON.parse(dataText) as RealTimeRecord & Record<string, unknown>;
    } catch (error) {
      this.emitStatus({
        mode: this.mode,
        adapterName: 'V7 实时检测流',
        status: 'connected',
        endpoint: this.endpoint,
        message: `跳过一帧无法解析的数据（${error instanceof Error ? error.message : '格式错误'}），连接保持`,
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
        sessionCode: this.sessionCode,
      });
      return;
    }
    if (eventName === 'event_explanation' || eventName === 'event.explanation') {
      markEventExplanationRevision(data);
      window.dispatchEvent(new CustomEvent('wcs:event-explanation', { detail: data }));
      return;
    }
    if (eventName === 'start' || eventName === 'resume' || eventName === 'session.started') {
      this.sessionCode = String(data.session_code || data.session_id || data.sessionCode || data.sessionId || this.sessionCode || '') || undefined;
      const afterSampleTime = normalizeSampleTime(String(data.after_sample_time || data.afterSampleTime || ''));
      if (afterSampleTime) this.lastSampleTime = afterSampleTime;
      this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'connected', endpoint: this.endpoint, message: '已附着后端检测 Session', lastRecordAt: this.lastSampleTime, recordCount: this.recordCount, sessionCode: this.sessionCode, runtimeId: String(data.runtime_id || data.runtimeId || '') || undefined });
      return;
    }
    if (eventName === 'session.status') {
      const status = String(data.status || '').toLowerCase();
      if (status === 'completed' || status === 'complete') {
        this.completed = true;
        if (this.replayQueue.length === 0) this.emitReplayCompleted();
      }
      return;
    }
    if (eventName === 'session.error') {
      // Backend rejected the attachment (e.g. no running monitoring session).
      // Surface it to the operator; the stream client keeps its cursor so a
      // later "start monitoring" + reconnect resumes cleanly.
      this.terminalError = true;
      this.emitStatus({
        mode: this.mode,
        adapterName: 'V7 实时检测流',
        status: 'error',
        endpoint: this.endpoint,
        message: String(data.error || data.message || '后端没有正在运行的监测会话，请先开始监测'),
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
        sessionCode: this.sessionCode,
      });
      return;
    }
    if (eventName === 'session.gap') {
      // The backend closes a bounded subscriber after overflow. Keep the
      // durable cursor and let the resilient wrapper establish a fresh SSE
      // subscription; never treat a gap as a completed monitoring session.
      this.emitStatus({
        mode: this.mode,
        adapterName: 'V7 实时检测流',
        status: 'reconnecting',
        endpoint: this.endpoint,
        message: `检测流发生缺口，正在从游标续接：${String(data.reason || 'subscriber_gap')}`,
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
        sessionCode: this.sessionCode,
        streamGap: true,
      });
      return;
    }
    if (eventName === 'catchup_frame') {
      this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'catchingUp', endpoint: this.endpoint, message: '正在补齐断线期间帧', lastRecordAt: this.lastSampleTime, recordCount: this.recordCount, sessionCode: this.sessionCode });
    }
    if (eventName === 'frame' || eventName === 'frame.updated' || eventName === 'catchup_frame' || eventName === 'message') {
      if (this.mode === 'historyReplay') {
        if (this.replayQueue.length >= MAX_BUFFERED_REPLAY_FRAMES) {
          // The backend still evaluates every frame.  The browser renderer is
          // allowed to coalesce only when it cannot keep up, otherwise a fast
          // replay would retain an unbounded client-side queue and freeze the UI.
          this.replayQueue.splice(0, this.replayQueue.length - MAX_BUFFERED_REPLAY_FRAMES + 1);
        }
        this.replayQueue.push(data);
        this.scheduleReplayDrain(well);
      } else {
        this.deliverFrame(data, well);
      }
      return;
    }
    if (eventName === 'candidate.transition') return;
    if (eventName === 'error') throw new Error(String(data.error || '后端检测流错误'));
    if (eventName === 'caught_up') this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'connected', endpoint: this.endpoint, message: '已追赶到后端最新点', lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null, recordCount: this.recordCount, sessionCode: this.sessionCode });
  }

  disconnect() {
    this.closedByClient = true;
    this.controller?.abort();
    this.controller = null;
    if (this.replayTimer !== null) {
      window.clearTimeout(this.replayTimer);
      this.replayTimer = null;
    }
    this.replayQueue = [];
  }
  onRecord(callback: (record: RealTimeRecord) => void) { this.recordCallback = callback; }
  onStatus(callback: (state: DataSourceState) => void) { this.statusCallback = callback; }
  setReplaySpeed(speed: ReplaySpeed) {
    if (this.mode !== 'historyReplay') return;
    this.rateMs = replayIntervalMs(speed);
  }

  getReplayCursor() {
    return { sampleTime: this.lastSampleTime, sourceRowNo: this.lastSourceRowNo };
  }

  private scheduleReplayDrain(well: WellInfo) {
    if (this.closedByClient || this.replayTimer !== null) return;
    const delay = this.recordCount === 0 || this.replayQueue.length > MAX_BUFFERED_REPLAY_FRAMES ? 0 : this.rateMs;
    this.replayTimer = window.setTimeout(() => {
      this.replayTimer = null;
      if (this.closedByClient) return;
      const next = this.replayQueue.shift();
      if (next) this.deliverFrame(next, well);
      if (this.replayQueue.length > 0) {
        this.scheduleReplayDrain(well);
      } else if (this.completed) {
        this.emitReplayCompleted();
      }
    }, delay);
  }

  private deliverFrame(data: RealTimeRecord, well: WellInfo) {
    const sampleTime = sampleTimeFromRecord(data);
    if (sampleTime) this.lastSampleTime = sampleTime;
    const sourceRowNo = finite(readValue(data as Record<string, unknown>, ['source_row_no', 'sourceRowNo']), NaN);
    if (Number.isFinite(sourceRowNo)) this.lastSourceRowNo = sourceRowNo;
    this.recordCount += 1;
    this.recordCallback(data);
    this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'connected', endpoint: this.endpoint, message: `检测流推送中 · ${well.wellName} · ${this.recordCount} 帧`, lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null, recordCount: this.recordCount, sessionCode: this.sessionCode });
  }

  private emitReplayCompleted() {
    this.emitStatus({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'connected', endpoint: this.endpoint, message: `历史回放完成 · ${this.recordCount} 帧`, lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null, recordCount: this.recordCount, sessionCode: this.sessionCode });
  }
  private emitStatus(state: DataSourceState) { if (!(this.closedByClient && state.status === 'error')) this.statusCallback(state); }
}
class PreviewPollingDataSourceAdapter implements DataSourceAdapter {
  private recordCallback: (record: RealTimeRecord) => void = () => {};
  private statusCallback: (state: DataSourceState) => void = () => {};
  private controller: AbortController | null = null;
  private fetchTimer: number | null = null;
  private replayTimer: number | null = null;
  private queue: RealTimeRecord[] = [];
  private recordCount = 0;
  private previewErrorAttempt = 0;
  private lastSampleTime: string | null = null;
  private lastSourceRowNo: number | undefined;
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
    private rateMs = REALTIME_FRAME_INTERVAL_MS,
    private batchLimit = PREVIEW_BATCH_LIMIT,
    private idlePollMs = PREVIEW_IDLE_POLL_MS,
    private fallbackReason = '',
    private mode: DataSourceMode = 'historyReplay',
    private initialSampleTime?: string | null,
    private initialSourceRowNo?: number,
  ) {}

  connect(well: WellInfo, _seed?: MonitoringData) {
    this.disconnect();
    this.closedByClient = false;
    this.recordCount = 0;
    this.previewErrorAttempt = 0;
    this.lastSampleTime = normalizeSampleTime(this.initialSampleTime || '') || null;
    this.lastSourceRowNo = Number.isFinite(this.initialSourceRowNo) ? this.initialSourceRowNo : undefined;
    this.started = false;
    this.queue = [];
    this.fetching = false;
    this.well = well;
    this.accessToken = getAccessToken();
    this.previewUrl = buildRealtimeApiUrl(this.endpoint, `/wells/${encodeURIComponent(well.wellId)}`);
    this.cursorStartTime = normalizeSampleTime(this.startTime || well.discoveryTime || well.startTime || '');
    this.emitStatus({
      mode: this.mode,
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

  setReplaySpeed(speed: ReplaySpeed) {
    if (this.mode !== 'historyReplay') return;
    this.rateMs = replayIntervalMs(speed);
  }

  getReplayCursor() {
    return { sampleTime: this.lastSampleTime, sourceRowNo: this.lastSourceRowNo };
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
    let url = new URL(this.previewUrl, window.location.origin);
    url.searchParams.set('limit', String(this.batchLimit));
    // Keep the fallback request on the same realtime contract as the SSE
    // attachment.  Without an explicit mode an older API may interpret this
    // as a finite history preview and stop at the registry tail.
    url = withMonitoringModeQuery(url, this.mode);
    if (this.cursorStartTime) url.searchParams.set('startTime', this.cursorStartTime);
    // The source cursor is a tuple.  Sending the exact timestamp together
    // with source_row_no lets the API return additional rows that share the
    // same second without the old +1-second skip.
    if (this.lastSampleTime) {
      url.searchParams.set('afterSampleTime', this.lastSampleTime);
      if (Number.isFinite(this.lastSourceRowNo)) url.searchParams.set('afterSourceRowNo', String(this.lastSourceRowNo));
    }
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
      this.previewErrorAttempt = 0;

      const frames = Array.isArray(data.frames) ? data.frames : [];
      const freshFrames = frames.filter((frame) => {
        const sampleTime = normalizeSampleTime(sampleTimeFromRecord(frame));
        if (!sampleTime) return true;
        const sampleMs = parseDateLikeMs(sampleTime);
        const cursorMs = parseDateLikeMs(this.lastSampleTime);
        if (!this.lastSampleTime || sampleMs === null || cursorMs === null) return true;
        if (sampleMs > cursorMs) return true;
        if (sampleMs < cursorMs) return false;
        const sourceRowNo = sourceRowNoFromRecord(frame);
        if (Number.isFinite(sourceRowNo) && Number.isFinite(this.lastSourceRowNo)) {
          return (sourceRowNo as number) > (this.lastSourceRowNo as number);
        }
        // When the API has no row ordinal, an equal-timestamp frame cannot be
        // distinguished from the boundary row. Keep it deduplicated; APIs
        // that expose source_row_no take the tuple path above.
        return Number.isFinite(sourceRowNo) && !Number.isFinite(this.lastSourceRowNo);
      });
      const engineStart = normalizeSampleTime(String(data.realtimeEngine?.startTime || this.cursorStartTime || this.startTime || ''));

      if (freshFrames.length === 0) {
        this.emitStatus({
          mode: this.mode,
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
          mode: this.mode,
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
        // Keep the exact boundary. `afterSourceRowNo` disambiguates rows in
        // the same source second; advancing by one second loses valid rows.
        this.cursorStartTime = lastQueuedTime;
      }
      this.drainQueue();
    } catch (error) {
      if (controller.signal.aborted || this.closedByClient) return;
      const message = error instanceof Error ? error.message : '未知错误';
      this.previewErrorAttempt = Math.min(this.previewErrorAttempt + 1, 5);
      const retryDelay = Math.min(
        30_000,
        Math.max(this.idlePollMs, this.idlePollMs * (2 ** (this.previewErrorAttempt - 1))),
      );
      this.emitStatus({
        mode: this.mode,
        adapterName: 'V7 预览回放',
        status: 'error',
        endpoint: this.previewUrl,
        message: `预览回放失败：${message}，${Math.ceil(retryDelay / 1000)} 秒后重试`,
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.recordCount,
      });
      // A fallback must survive a transient API restart.  Without a retry,
      // one ECONNRESET/5xx leaves the browser waiting forever until refresh.
      this.scheduleFetch(retryDelay);
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
      const sourceRowNo = sourceRowNoFromRecord(frame);
      if (Number.isFinite(sourceRowNo)) this.lastSourceRowNo = sourceRowNo;
      this.recordCount += 1;
      this.recordCallback(frame);
      this.emitStatus({
        mode: this.mode,
        adapterName: 'V7 预览回放',
        status: 'connected',
        endpoint: this.previewUrl,
        message: `预览回放中 · ${this.well?.wellName || ''} · ${this.recordCount} 帧`,
        lastRecordAt: sampleTime ? formatRecordDateTime(sampleTime) : null,
        recordCount: this.recordCount,
      });

      if (this.queue.length > 0) {
        // Realtime preview is a transport fallback, not a paced replay.  A
        // five-second frame interval across a 240-frame batch would leave the
        // browser more than twenty minutes behind the database tail.  History
        // replay retains its deliberate playback cadence; live fallback drains
        // the bounded batch immediately and polls the tail again afterward.
        const drainDelay = this.mode === 'historyReplay' ? this.rateMs : 0;
        this.replayTimer = window.setTimeout(emitNext, drainDelay);
      } else {
        this.scheduleFetch(this.idlePollMs);
      }
    };

    const initialDelay = this.recordCount === 0 || this.mode !== 'historyReplay' ? 0 : this.rateMs;
    this.replayTimer = window.setTimeout(emitNext, initialDelay);
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
  private inactivityWatchdog: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private recentSseReconnectAt: number[] = [];
  private lastStreamSequence: number | null = null;
  private lastSourceRowNo: number | undefined;
  private lastEventId = '';
  private lifecycleRevision: number | undefined;
  private sessionCode = '';
  private mode: DataSourceMode;

  constructor(
    private endpoint: string,
    private startTime: string,
    private rateMs = REALTIME_FRAME_INTERVAL_MS,
    private connectTimeoutMs = STREAM_CONNECT_TIMEOUT_MS,
    sessionCode = '',
    lastSampleTime?: string | null,
    lastSourceRowNo?: number,
    mode: DataSourceMode = 'realtime',
  ) {
    this.sessionCode = sessionCode;
    this.lastSampleTime = normalizeSampleTime(lastSampleTime || '') || null;
    this.lastSourceRowNo = lastSourceRowNo;
    this.mode = mode;
  }

  connect(well: WellInfo, seed: MonitoringData) {
    this.disconnect();
    this.closedByClient = false;
    this.activeWell = well;
    this.seedData = seed;
    this.totalRecordCount = 0;
    this.lastSampleTime = normalizeSampleTime(this.lastSampleTime || '') || null;
    this.fallbackActivated = false;
    this.reconnectAttempt = 0;
    this.recentSseReconnectAt = [];
    this.lastStreamSequence = null;
    // Keep the persisted session cursor across reconnects; disconnect only closes this browser transport.
    this.lastEventId = '';
    this.lifecycleRevision = undefined;
    this.startSse();
  }

  disconnect() {
    this.closedByClient = true;
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
    if (this.inactivityWatchdog !== null) {
      window.clearTimeout(this.inactivityWatchdog);
      this.inactivityWatchdog = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
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

  setReplaySpeed(speed: ReplaySpeed, resumeFrom?: string | null, sourceRowNo?: number) {
    if (this.mode !== 'historyReplay') return;
    const nextRateMs = replayIntervalMs(speed);
    if (nextRateMs === this.rateMs) return;
    this.rateMs = nextRateMs;

    // The backend applies rateMs when the SSE stream is created. Changing only
    // the browser-side drain interval cannot make an already-started backend
    // stream produce frames faster, so reconnect from the current cursor.
    if (this.closedByClient || this.fallbackActivated || !this.activeWell || !this.seedData) return;
    const activeCursor = this.activeAdapter?.getReplayCursor?.();
    const externalResume = normalizeSampleTime(resumeFrom || activeCursor?.sampleTime || '');
    if (externalResume) this.lastSampleTime = externalResume;
    const activeSourceRowNo = activeCursor?.sourceRowNo;
    if (Number.isFinite(activeSourceRowNo)) this.lastSourceRowNo = activeSourceRowNo;
    else if (Number.isFinite(sourceRowNo) && externalResume) this.lastSourceRowNo = sourceRowNo;
    // Keep the exact event-time boundary. The backend cursor is the tuple
    // (sample_time, source_row_no); advancing by one second can skip valid
    // rows that share a timestamp (or have sub-second precision).
    const resumeCursor = normalizeSampleTime(
      this.lastSampleTime
      || this.startTime
      || this.activeWell.discoveryTime
      || this.activeWell.startTime
      || '',
    );
    if (resumeCursor) this.startTime = resumeCursor;
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.activeAdapter?.disconnect();
    this.activeAdapter = null;
    this.startSse();
  }

  private startSse() {
    if (!this.activeWell || !this.seedData) return;
    const adapter = new SseDetectionDataSourceAdapter(this.endpoint, this.startTime, this.rateMs, this.sessionCode, this.lastSampleTime, this.lastSourceRowNo, this.lastEventId, this.mode);
    this.activeAdapter = adapter;
    this.bindAdapter(adapter, false);
    this.armWatchdog();
    this.armInactivityWatchdog();
    adapter.connect(this.activeWell, this.seedData);
  }

  private bindAdapter(adapter: DataSourceAdapter, isFallback: boolean) {
    adapter.onRecord((record) => {
      if (this.closedByClient) return;
      const sampleTime = normalizeSampleTime(sampleTimeFromRecord(record));
      const previousSampleTime = this.lastSampleTime;
      const source = record as Record<string, unknown>;
      const streamSequence = finite(readValue(source, ['stream_sequence', 'streamSequence']), NaN);
      const sourceRowNo = finite(readValue(source, ['source_row_no', 'sourceRowNo']), NaN);
      const lifecycleRevision = finite(readValue(source, ['lifecycle_revision', 'lifecycleRevision']), NaN);
      const eventId = String(readValue(source, ['event_id', 'eventId']) || '');
      const sampleMs = parseDateLikeMs(sampleTime);
      const previousSampleMs = parseDateLikeMs(previousSampleTime);
      const sampleIsNotOlder = !sampleTime || !previousSampleTime || sampleMs === null || previousSampleMs === null
        ? true
        : sampleMs >= previousSampleMs;
      const sourceIsNotOlder = !Number.isFinite(sourceRowNo) || !Number.isFinite(this.lastSourceRowNo)
        ? true
        : !sampleTime || !previousSampleTime || sampleMs === null || previousSampleMs === null
          ? sourceRowNo >= (this.lastSourceRowNo as number)
          : sampleMs > previousSampleMs || sourceRowNo >= (this.lastSourceRowNo as number);
      const cursorIsNotOlder = sampleIsNotOlder && sourceIsNotOlder;
      const sameCursor = Boolean(
        sampleTime && previousSampleTime && sampleMs !== null && previousSampleMs !== null
          && sampleMs === previousSampleMs
          && ((!Number.isFinite(sourceRowNo) || !Number.isFinite(this.lastSourceRowNo))
            || sourceRowNo === this.lastSourceRowNo),
      );
      // A reconnect/catch-up query can include the boundary row again. It is
      // already represented in the UI and must not be delivered twice.
      if (sameCursor) return;
      if (sampleTime && !cursorIsNotOlder) return;
      const resumeSourceRowNo = this.lastSourceRowNo;
      const hasGap = Number.isFinite(streamSequence) && this.lastStreamSequence !== null && streamSequence !== this.lastStreamSequence + 1;
      if (hasGap && !isFallback) {
        // Do not advance the durable cursor to the first frame after a stream
        // gap: that frame is intentionally withheld until catch-up replay has
        // filled the missing sequence range. Advancing here would make the
        // next request start after the gap and lose rows permanently.
        this.lastSourceRowNo = resumeSourceRowNo;
        this.scheduleSseReconnect({
          mode: this.mode,
          adapterName: 'V7 实时检测流',
          status: 'connecting',
          endpoint: this.endpoint,
          message: '检测到流序号缺口',
          lastRecordAt: sampleTime ? formatRecordDateTime(sampleTime) : null,
          recordCount: this.totalRecordCount,
          streamSequence: this.lastStreamSequence ?? undefined,
          sourceRowNo: resumeSourceRowNo,
          lifecycleRevision: this.lifecycleRevision,
          streamGap: true,
        }, '流序号缺口');
        return;
      }
      if (sampleTime && cursorIsNotOlder) this.lastSampleTime = sampleTime;
      if (Number.isFinite(streamSequence)) this.lastStreamSequence = streamSequence;
      if (Number.isFinite(sourceRowNo) && cursorIsNotOlder) this.lastSourceRowNo = sourceRowNo;
      if (Number.isFinite(lifecycleRevision)) this.lifecycleRevision = lifecycleRevision;
      if (eventId) this.lastEventId = eventId;
      this.reconnectAttempt = 0;
      if (!isFallback) this.recentSseReconnectAt = [];
      this.totalRecordCount += 1;
      this.armInactivityWatchdog();
      if (!isFallback && this.connectWatchdog !== null) {
        window.clearTimeout(this.connectWatchdog);
        this.connectWatchdog = null;
      }
      this.recordCallback(record);
    });

    adapter.onStatus((state) => {
      if (this.closedByClient) return;
      const reportedSampleTime = normalizeSampleTime(state.lastRecordAt || '');
      // `lastRecordAt` is a display value (seconds precision) and may be
      // emitted after a frame whose source timestamp carries microseconds.
      // Never overwrite the exact frame cursor with that lossy presentation;
      // only use a reported value to initialize an otherwise empty cursor.
      if (reportedSampleTime && !this.lastSampleTime) this.lastSampleTime = reportedSampleTime;
      if (Number.isFinite(state.sourceRowNo)) this.lastSourceRowNo = state.sourceRowNo;
      const adjustedState: DataSourceState = {
        ...state,
        recordCount: Math.max(state.recordCount || 0, this.totalRecordCount),
        lastRecordAt: state.lastRecordAt || (this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null),
      };
      if (state.sessionCode) this.sessionCode = state.sessionCode;

      if (!isFallback && !this.fallbackActivated) {
        // A backend session.error is authoritative (for example 409 because
        // the session does not exist or has the wrong mode), not a transient
        // transport failure. Only reconnectable statuses schedule another
        // fetch; otherwise a known terminal error would create an infinite
        // retry storm and hide the operator-facing error.
        if (state.status === 'paused' || state.status === 'reconnecting') {
          this.scheduleSseReconnect(adjustedState, state.message || '检测流连接中断');
          return;
        }
      }

      this.emitStatus(adjustedState);
    });
  }

  private scheduleSseReconnect(state: DataSourceState, reason: string) {
    if (this.closedByClient || this.fallbackActivated || !this.activeWell || !this.seedData || this.reconnectTimer !== null) return;
    if (this.inactivityWatchdog !== null) {
      window.clearTimeout(this.inactivityWatchdog);
      this.inactivityWatchdog = null;
    }
    const reconnectsInWindow = this.noteSseReconnect();
    if (this.mode === 'realtime' && reconnectsInWindow >= SSE_RECONNECT_FALLBACK_THRESHOLD) {
      this.switchToPreview(`${reason}（${SSE_RECONNECT_FALLBACK_WINDOW_MS / 1000} 秒内连续 ${reconnectsInWindow} 次重连）`);
      return;
    }
    // Reconnect from the exact last tuple. `afterSourceRowNo` disambiguates
    // rows in the same second; adding +1s would permanently skip them.
    const resumeFrom = normalizeSampleTime(
      this.lastSampleTime
      || this.startTime
      || this.activeWell.discoveryTime
      || this.activeWell.startTime
      || '',
    );
    if (resumeFrom) this.startTime = resumeFrom;
    this.activeAdapter?.disconnect();
    this.activeAdapter = null;
    const delays = [1000, 2000, 5000, 10000, 30000];
    const delay = delays[Math.min(this.reconnectAttempt, delays.length - 1)];
    this.reconnectAttempt += 1;
    this.emitStatus({
      ...state,
      status: 'reconnecting',
      endpoint: this.endpoint,
       message: `${reason}，${Math.round(delay / 1000)} 秒后附着原 Session 并从时间 ${this.lastSampleTime || '--'} 续接`,
      streamSequence: this.lastStreamSequence ?? undefined,
      sourceRowNo: this.lastSourceRowNo,
      lifecycleRevision: this.lifecycleRevision,
      streamGap: reason.includes('缺口'),
    });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByClient || this.fallbackActivated) return;
      this.startSse();
    }, delay);
  }

  private noteSseReconnect() {
    const now = Date.now();
    this.recentSseReconnectAt = this.recentSseReconnectAt
      .filter((attemptedAt) => now - attemptedAt <= SSE_RECONNECT_FALLBACK_WINDOW_MS);
    this.recentSseReconnectAt.push(now);
    return this.recentSseReconnectAt.length;
  }

  private armWatchdog() {
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
    }
    this.connectWatchdog = window.setTimeout(() => {
      this.connectWatchdog = null;
      if (this.closedByClient || this.fallbackActivated || this.totalRecordCount > 0) return;
      this.scheduleSseReconnect({ mode: this.mode, adapterName: 'V7 实时检测流', status: 'reconnecting', endpoint: this.endpoint, message: '检测流暂未返回事件，保持原 Session 重连', lastRecordAt: this.lastSampleTime, recordCount: this.totalRecordCount, sessionCode: this.sessionCode }, '检测流暂未返回事件');
    }, this.connectTimeoutMs);
  }

  private armInactivityWatchdog() {
    if (this.inactivityWatchdog !== null) {
      window.clearTimeout(this.inactivityWatchdog);
    }
    if (this.closedByClient || this.fallbackActivated || this.mode !== 'realtime') return;
    this.inactivityWatchdog = window.setTimeout(() => {
      this.inactivityWatchdog = null;
      if (this.closedByClient || this.fallbackActivated) return;
      this.scheduleSseReconnect({
        mode: this.mode,
        adapterName: 'V7 实时检测流',
        status: 'reconnecting',
        endpoint: this.endpoint,
        message: '检测流长时间未收到新帧，保持原 Session 重连',
        lastRecordAt: this.lastSampleTime ? formatRecordDateTime(this.lastSampleTime) : null,
        recordCount: this.totalRecordCount,
        sessionCode: this.sessionCode,
      }, '检测流长时间未收到新帧');
    }, STREAM_INACTIVITY_TIMEOUT_MS);
  }

  private switchToPreview(reason: string) {
    if (this.closedByClient || this.fallbackActivated || !this.activeWell || !this.seedData) return;
    this.fallbackActivated = true;
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
    if (this.inactivityWatchdog !== null) {
      window.clearTimeout(this.inactivityWatchdog);
      this.inactivityWatchdog = null;
    }
    this.activeAdapter?.disconnect();
    this.emitStatus({
      mode: this.mode,
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
      this.mode,
      this.lastSampleTime,
      this.lastSourceRowNo,
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

function createMonitoringAdapter(mode: MonitoringMode, endpoint: string, startTime: string, rateMs = REALTIME_FRAME_INTERVAL_MS, sessionCode = '', lastSampleTime?: string | null, lastSourceRowNo?: number): DataSourceAdapter {
  if (!endpoint) return new DisabledDataSourceAdapter();
  // History replay is a durable backend session too; it must attach to SSE rather than re-run frontend preview batches.
  return new ResilientRealtimeDataSourceAdapter(endpoint, startTime, rateMs, STREAM_CONNECT_TIMEOUT_MS, sessionCode, lastSampleTime, lastSourceRowNo, mode);
}

function getCycleInfo(_totalSeconds: number): CycleInfo {
  return {
    ...CYCLE_STATES[0],
    state: 0,
    operationState: 'Unknown',
    hypothesisState: 'Unknown',
    source: 'unknown',
    stateLabel: '后端状态未提供',
    shortLabel: '--',
    description: '等待后端返回操作周期与跨周期假设状态',
    cycleIndex: 0,
    elapsedInState: 0,
    totalStateSeconds: 1,
    progress: 0,
    tStopPump: null,
    tStartPump: null,
    tStable: null,
  };
}

export function WellControlProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [monitoringWindowMinutes, setMonitoringWindowMinutes] = useState<MonitoringWindowMinutes>(getInitialMonitoringWindowMinutes);
  configuredMonitoringWindowMinutes = monitoringWindowMinutes;
  const [wells, setWells] = useState<WellInfo[]>([]);
  const { user, loading: authLoading } = useAuth();
  const hasAccessToken = Boolean(user && getAccessToken());
  const [selectedWellId, setSelectedWellId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(STORAGE_SELECTED_WELL) || '';
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
  const wellInfo = wells.find((well) => well.wellId === selectedWellId) || wells[0] || EMPTY_WELL_INFO;
  const selectedWellRuntime = wellRuntimeStates[wellInfo?.wellId];
  const [currentData, setCurrentData] = useState<MonitoringData>(() => createInitialSelectedViewState(selectedWellId).currentData);
  const currentDataRef = useRef<MonitoringData>(currentData);
  const [flowHistory, setFlowHistory] = useState<FlowDataPoint[]>(() => createInitialSelectedViewState(selectedWellId).flowHistory);
  const [pressureHistory, setPressureHistory] = useState<PressureDataPoint[]>(() => createInitialSelectedViewState(selectedWellId).pressureHistory);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [acknowledgedEvents, setAcknowledgedEvents] = useState<AcknowledgedEventMap>({});
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
  const timeIndexRequestKeyRef = useRef('');
  const realtimeWellsRefreshInFlightRef = useRef(false);
  const runtimePersistTimerRef = useRef<number | null>(null);
  const snapshotPersistTimerRef = useRef<number | null>(null);
  const snapshotCacheLoadedRef = useRef(false);
  const selectedUiFlushTimerRef = useRef<number | null>(null);
  const pendingSelectedUiSnapshotRef = useRef<WellMonitoringSnapshot | null>(null);
  const wellRuntimeStatesRef = useRef(wellRuntimeStates);
  const backendEventIdsRef = useRef<Set<string>>(new Set());
  const backendEventKeysRef = useRef<Set<string>>(new Set());
  const backendEventOrderRef = useRef<Array<[string, string]>>([]);
  const activeEventIdRef = useRef<string | null>(null);
  const selectedWellIdRef = useRef(selectedWellId);
  const acknowledgedEventsRef = useRef<AcknowledgedEventMap>(acknowledgedEvents);
  const [cycleInfo, setCycleInfo] = useState<CycleInfo>(() => createInitialSelectedViewState(selectedWellId).cycleInfo);
  const [eventSpans, setEventSpans] = useState<EventSpan[]>([]);
  const [lifecycleNodes, setLifecycleNodes] = useState<LifecycleNode[]>([]);
  const [eventProjectionState, setEventProjectionState] = useState<EventProjectionState>({ status: 'loading', message: '等待读取服务端事件投影', lastUpdatedAt: null });

  useEffect(() => {
    configuredMonitoringWindowMinutes = monitoringWindowMinutes;
    try { window.localStorage.setItem(STORAGE_MONITORING_WINDOW_MINUTES, String(monitoringWindowMinutes)); } catch { /* session-only fallback */ }
    setFlowHistory((previous) => keepMonitoringWindow([...previous]));
    setPressureHistory((previous) => keepMonitoringWindow([...previous]));
  }, [monitoringWindowMinutes]);

  useEffect(() => {
    const handleStorageError = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; message?: string }>).detail;
      setRawDataSourceState((previous) => ({
        ...previous,
        status: 'error',
        message: `本地状态保存失败（${detail?.key || 'unknown'}）：${detail?.message || '浏览器存储不可用'}`,
      }));
    };
    window.addEventListener(STORAGE_ERROR_EVENT, handleStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, handleStorageError);
  }, []);

  useEffect(() => {
    selectedWellIdRef.current = selectedWellId;
  }, [selectedWellId]);

  const dataSourceState = useMemo<DataSourceState>(() => {
    if (!wellInfo?.wellId) return rawDataSourceState;
    const runtime = selectedWellRuntime;
    const mode = runtime?.monitoringMode || rawDataSourceState.mode || 'realtime';
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
    const pausedWithResume = !running
      && runtime?.monitoringMode === 'historyReplay'
      && runtime?.shouldAutoRestore !== false
      && hasWellResumeProgress(runtime, snapshot);
    const pausedWithHistory = !running && !pausedWithResume && (recordCount > 0 || Boolean(lastRecordAt) || Boolean(startedSampleTime));

    if (running) {
      const status = runtime?.status === 'connected'
        ? 'connected'
        : runtime?.status === 'catchingUp'
          ? 'catchingUp'
          : runtime?.status === 'reconnecting'
            ? 'reconnecting'
            : runtime?.status === 'connecting'
              ? 'connecting'
              : (recordCount > 0 || Boolean(lastRecordAt))
                ? 'connected'
                : 'connecting';
      return {
        mode,
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
        mode,
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
        mode,
        adapterName: rawDataSourceState.adapterName || 'MySQL 实时数据接口',
        status: 'paused',
        endpoint: rawDataSourceState.endpoint || realtimeEndpoint || null,
        message: runtime?.message || '已恢复上次回放起点，点击继续回放',
        lastRecordAt,
        recordCount,
      };
    }

    if (pausedWithHistory) {
      return {
        mode,
        adapterName: rawDataSourceState.adapterName || 'MySQL 实时数据接口',
        status: 'paused',
        endpoint: rawDataSourceState.endpoint || realtimeEndpoint || null,
        message: runtime?.message || (runtime?.monitoringMode === 'historyReplay' ? '已保留历史回放点，可按需继续回放' : '已停止实时监测，可重新监测'),
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
    void writeWellSnapshotsToIndexedDb(serialized);
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
      if (selectedUiFlushTimerRef.current !== null) {
        window.clearTimeout(selectedUiFlushTimerRef.current);
        selectedUiFlushTimerRef.current = null;
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
      .filter(([, runtime]) => runtime?.shouldAutoRestore !== false && isRuntimeStreamActive(runtime))
      .map(([wellId]) => wellId)
  ), [suppressedAutoRestoreWellIds, wellRuntimeStates]);

  const snapshotRecoverableWellIds = useMemo(() => (
    Object.entries(wellSnapshotsRef.current)
      .filter(([wellId, snapshot]) => {
        if (suppressedAutoRestoreWellIds.has(wellId)) return false;
        const runtime = wellRuntimeStates[wellId];
        if (!snapshot || runtime?.shouldAutoRestore === false || !isRuntimeStreamActive(runtime)) return false;
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
    if (runtime?.monitoringMode === 'realtime') {
      const pausedCursor = runtime.pausedSampleTime || runtime.lastRecordAt || snapshot.lastRecordAt || snapshot.currentSampleTime || '';
      // Resume at the exact source-civil cursor; source_row_no is carried by
      // the runtime separately and prevents same-timestamp rows being lost.
      return normalizeSampleTime(pausedCursor) || wellLatestSampleTime(well) || '';
    }
    if (runtime?.pausedSampleTime) return runtime.pausedSampleTime;
    return runtime?.lastRecordAt || snapshot.lastRecordAt || snapshot.currentSampleTime || runtime?.startedSampleTime || snapshot.startedSampleTime || well.discoveryTime || well.startTime || '';
  }, [getWellSnapshot]);

  const setWellSnapshot = useCallback((wellId: string, patch: Partial<WellMonitoringSnapshot>) => {
    const nextWell = wells.find((well) => well.wellId === wellId) || wellInfo;
    const previous = wellSnapshotsRef.current[wellId] || createWellMonitoringSnapshot(nextWell);
    wellSnapshotsRef.current[wellId] = { ...previous, ...patch };
    schedulePersistWellSnapshots();
  }, [schedulePersistWellSnapshots, wellInfo, wells]);

  const hydrateWellView = useCallback((well: WellInfo) => {
    const runtimeSessionCode = wellRuntimeStatesRef.current[well.wellId]?.sessionCode;
    const storedSnapshot = getWellSnapshot(well);
    const snapshot = runtimeSessionCode && storedSnapshot.sessionCode !== runtimeSessionCode
      ? createWellMonitoringSnapshot(well, runtimeSessionCode)
      : storedSnapshot;
    if (snapshot !== storedSnapshot) wellSnapshotsRef.current[well.wellId] = snapshot;
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
    if (snapshotCacheLoadedRef.current) return;
    snapshotCacheLoadedRef.current = true;
    void readWellSnapshotsFromIndexedDb().then((storedSnapshots) => {
      const merged = { ...storedSnapshots };
      Object.entries(wellSnapshotsRef.current).forEach(([wellId, snapshot]) => {
        const activeSessionCode = wellRuntimeStatesRef.current[wellId]?.sessionCode || snapshot.sessionCode;
        const storedSessionCode = merged[wellId]?.sessionCode;
        if (activeSessionCode && storedSessionCode !== activeSessionCode) {
          merged[wellId] = snapshot;
          return;
        }
        if (hasSnapshotResumeProgress(snapshot) || !merged[wellId]) merged[wellId] = snapshot;
      });
      wellSnapshotsRef.current = merged;
      const selectedWell = wells.find((well) => well.wellId === selectedWellIdRef.current) || wellInfo;
      const visibleHasProgress = flowHistory.length > 0 || pressureHistory.length > 0 || historyRecords.length > 0 || Boolean(currentSampleTime);
      if (selectedWell?.wellId && !visibleHasProgress && merged[selectedWell.wellId]) hydrateWellView(selectedWell);
    });
  }, [currentSampleTime, flowHistory.length, historyRecords.length, hydrateWellView, pressureHistory.length, wellInfo, wells]);

  useEffect(() => {
    if (!wellInfo?.wellId) return;
    hydrateWellView(wellInfo);
  }, [hydrateWellView, wellInfo?.wellId]);

  const selectedWellView: SelectedWellViewState = (() => {
    const snapshot = wellInfo?.wellId ? wellSnapshotsRef.current[wellInfo.wellId] : undefined;
    const snapshotMatchesSession = !selectedWellRuntime?.sessionCode
      || snapshot?.sessionCode === selectedWellRuntime.sessionCode;
    const usableSnapshot = snapshotMatchesSession ? snapshot : undefined;
    const visibleHasSeries = flowHistory.length > 0 || pressureHistory.length > 0 || historyRecords.length > 0;
    const visibleHasProgress = visibleHasSeries || Boolean(currentSampleTime);
    const snapshotHasProgress = hasSnapshotResumeProgress(usableSnapshot);
    const fromSnapshotFallback = !visibleHasProgress && snapshotHasProgress;
    return {
      currentData: fromSnapshotFallback ? (usableSnapshot?.currentData || currentData) : currentData,
      currentSampleTime: currentSampleTime || usableSnapshot?.currentSampleTime || usableSnapshot?.lastRecordAt || '',
      flowHistory: flowHistory.length > 0 ? flowHistory : (usableSnapshot?.flowHistory || []),
      pressureHistory: pressureHistory.length > 0 ? pressureHistory : (usableSnapshot?.pressureHistory || []),
      backendDetection: visibleHasProgress ? backendDetection : (usableSnapshot?.backendDetection || backendDetection),
      historyRecords: historyRecords.length > 0 ? historyRecords : (usableSnapshot?.historyRecords || []),
      cycleInfo: visibleHasProgress ? cycleInfo : (usableSnapshot?.cycleInfo || cycleInfo),
      shutInActive: fromSnapshotFallback ? (usableSnapshot?.shutInActive ?? shutInActive) : shutInActive,
      shutInStartedAt: shutInStartedAt || usableSnapshot?.shutInStartedAt || null,
      latestWellDepth: selectedWellRuntime?.latestWellDepth ?? usableSnapshot?.latestWellDepth ?? currentData.wellDepth ?? undefined,
      latestBitDepth: selectedWellRuntime?.latestBitDepth ?? usableSnapshot?.latestBitDepth ?? currentData.bitDepth ?? undefined,
      latestFormation: selectedWellRuntime?.latestFormation ?? usableSnapshot?.latestFormation ?? currentData.formation,
      fromSnapshotFallback,
    };
  })();
  const selectedWellManuallyStopped = selectedWellId ? suppressedAutoRestoreWellIds.has(selectedWellId) : false;
  const isWellManuallyStopped = useCallback((wellId: string) => suppressedAutoRestoreWellIds.has(wellId), [suppressedAutoRestoreWellIds]);

  const alertStatus = backendLevelToStatus(backendDetection.advisoryLevel);
  const baselineInfo = useMemo<BaselineInfo>(() => {
    const baseline = backendDetection.baselineSnapshot;
    const primaryChannels = baseline.channels.filter((channel) => ['standpipe_pressure', 'outlet_flow'].includes(channel.channel));
    const acceptedCycleCount = Math.max(
      backendDetection.baselineCount,
      ...primaryChannels.map((channel) => channel.supportingSampleCount),
      0,
    );
    const totalCycles = Math.max(historyRecords.length, acceptedCycleCount);
    const frozenCycles = baseline.frozenChannelCount;
    const coverageBase = baseline.ready
      ? 100
      : (acceptedCycleCount / Math.max(baseline.minimumReferenceSamples, 1)) * 100;
    const qualityPenalty = baseline.channelCount > 0
      ? (frozenCycles / Math.max(baseline.channelCount, 1)) * 100
      : 0;
    const isColdStart = baseline.warmup || !baseline.ready;
    return {
      totalCycles,
      qualifiedCycles: acceptedCycleCount,
      frozenCycles,
      acceptedCycleCount,
      isColdStart,
      coldStartRemaining: Math.max(0, baseline.minimumReferenceSamples - acceptedCycleCount),
      qualityScore: clamp(coverageBase - qualityPenalty * 0.6, 0, 100),
      templateCoverage: baseline.channelCount > 0
        ? clamp((baseline.readyChannelCount / baseline.channelCount) * 100, 0, 100)
        : clamp(coverageBase, 0, 100),
      lastResetReason: backendDetection.baselineInvalidReason
        || (baseline.status === 'ReadyWithQuarantine' ? '部分通道处于异常证据隔离，未参与更新' : isColdStart ? '当前工况条件参考仍在积累' : null),
      lastResetTime: baseline.lastUpdatedAt || backendDetection.baselineEndTime || null,
      referenceMinimumSamples: baseline.minimumReferenceSamples,
      readyChannelCount: baseline.readyChannelCount,
      referenceChannelCount: baseline.channelCount,
    };
  }, [backendDetection, historyRecords]);

  const updateWellRuntime = useCallback((wellId: string, patch: Partial<WellRuntimeState>) => {
    setWellRuntimeStates((prev) => {
      const now = new Date().toISOString();
      const defaults: WellRuntimeState = {
        wellId,
        monitoringMode: 'realtime',
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
        selectedReplayStartTime: null,
        replaySpeed: 1,
        pausedSampleTime: null,
        message: '待启动',
        updatedAt: now,
      };
      return {
        ...prev,
        [wellId]: {
          ...defaults,
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
    backendEventOrderRef.current = backendEventOrderRef.current.filter(([eventId, eventKey]) => {
      return !eventId.startsWith(prefix) && !eventKey.startsWith(prefix);
    });
  }, []);

  const appendAlertsFromRecord = useCallback((well: WellInfo, record: RealTimeRecord, data: MonitoringData) => {
    const backendLogs = queueLogEntriesFromRecord(record);
    if (backendLogs.length === 0) return;
    setAlerts((previous) => {
      let nextAlerts = previous;
      const additions: Alert[] = [];
      backendLogs.forEach((entry) => {
        if (!entry.eventId || !(entry.startTime || entry.timestamp)) return;
        const eventKey = `${well.wellId}:${backendEventKey(entry)}`;
        const eventInstanceId = `${well.wellId}:${entry.eventId}`;
        const eventStart = entry.startTime || entry.timestamp || record.timestamp;
        const eventEnd = entry.endTime || entry.timestamp || record.timestamp;
        const eventTime = formatRecordTime(eventStart);
        const eventEndTime = formatRecordTime(eventEnd);
        const existingIndex = nextAlerts.findIndex((alert) => alert.backendEventId === eventKey);
        if (existingIndex >= 0) {
          nextAlerts = nextAlerts.map((alert, index) => index === existingIndex ? {
            ...alert,
            warningId: entry.warningId ?? alert.warningId,
            lifecycleStatus: entry.lifecycleStatus || alert.lifecycleStatus,
            ackStatus: entry.ackStatus || alert.ackStatus,
            acknowledged: entry.ackStatus ? isAcknowledgedStatus(entry.ackStatus) : alert.acknowledged,
            acknowledgedBy: entry.acknowledgedBy || alert.acknowledgedBy,
            acknowledgedAt: entry.acknowledgedAt || alert.acknowledgedAt,
            acknowledgementCount: entry.acknowledgementCount ?? alert.acknowledgementCount,
            level: entry.advisoryLevel >= 4 ? 'critical' as const : entry.advisoryLevel >= 2 ? 'warning' as const : 'info' as const,
            title: entry.title || alert.title,
            description: entry.description || alert.description,
            primaryParameter: entry.primaryParameter || alert.primaryParameter,
            message: entry.title || alert.message,
            time: eventTime.timeStr,
            date: eventTime.dateStr,
            lastTime: eventEndTime.timeStr,
            lastDate: eventEndTime.dateStr,
            count: entry.sampleCount || (alert.count || 1) + 1,
            backendLevel: entry.advisoryLevel,
            peakBackendLevel: Math.max(alert.peakBackendLevel ?? alert.backendLevel, entry.advisoryLevel) as BackendLevel,
            formalEvalLevel: entry.formalEvalLevel,
            peakFormalEvalLevel: Math.max(alert.peakFormalEvalLevel ?? alert.formalEvalLevel, entry.formalEvalLevel) as BackendLevel,
            activeSignals: entry.activeSignals,
            eventState: entry.eventState,
            pumpState: entry.pumpState,
          } : alert);
          return;
        }
        const normalizedEntryState = entry.eventState.trim().toLowerCase();
        const isTerminal = normalizedEntryState === 'resolved'
          || normalizedEntryState === 'closedunresolved'
          || normalizedEntryState === 'closed_unresolved';
        if (entry.advisoryLevel < 2 && !isTerminal) return;
        if (backendEventIdsRef.current.has(eventInstanceId) || backendEventKeysRef.current.has(eventKey)) return;
        backendEventIdsRef.current.add(eventInstanceId);
        backendEventKeysRef.current.add(eventKey);
        backendEventOrderRef.current.push([eventInstanceId, eventKey]);
        while (backendEventOrderRef.current.length > MAX_TRACKED_BACKEND_EVENTS) {
          const [oldEventId, oldEventKey] = backendEventOrderRef.current.shift()!;
          backendEventIdsRef.current.delete(oldEventId);
          backendEventKeysRef.current.delete(oldEventKey);
        }
        additions.push({
          id: alertIdCounter.current++,
          warningId: entry.warningId,
          lifecycleStatus: entry.lifecycleStatus,
          ackStatus: entry.ackStatus,
          acknowledgedBy: entry.acknowledgedBy,
          acknowledgedAt: entry.acknowledgedAt,
          acknowledgementCount: entry.acknowledgementCount,
          wellId: well.wellId,
          wellName: well.wellName,
          wellBlock: well.blockName || well.block,
          wellDepth: data.wellDepth ?? well.depth,
          bitDepth: data.bitDepth,
          formation: data.formation || well.targetLayer || undefined,
          time: eventTime.timeStr,
          date: eventTime.dateStr,
          lastTime: eventEndTime.timeStr,
          lastDate: eventEndTime.dateStr,
          level: entry.advisoryLevel >= 4 ? 'critical' as const : entry.advisoryLevel >= 2 ? 'warning' as const : 'info' as const,
          title: entry.title,
          description: entry.description,
          primaryParameter: entry.primaryParameter,
          message: entry.title,
          acknowledged: acknowledgedEventsRef.current[eventKey] === true,
          code: entry.eventId,
          backendEventId: eventKey,
          backendLevel: entry.advisoryLevel,
          peakBackendLevel: entry.advisoryLevel,
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

  const scheduleSelectedUiSnapshot = useCallback((snapshot: WellMonitoringSnapshot) => {
    pendingSelectedUiSnapshotRef.current = snapshot;
    if (selectedUiFlushTimerRef.current !== null) return;
    selectedUiFlushTimerRef.current = window.setTimeout(() => {
      selectedUiFlushTimerRef.current = null;
      const pending = pendingSelectedUiSnapshotRef.current;
      pendingSelectedUiSnapshotRef.current = null;
      if (!pending) return;
      currentDataRef.current = pending.currentData;
      setCurrentData(pending.currentData);
      setCurrentSampleTime(pending.currentSampleTime);
      setFlowHistory([...pending.flowHistory]);
      setPressureHistory([...pending.pressureHistory]);
      setBackendDetection(pending.backendDetection);
      setHistoryRecords([...pending.historyRecords]);
      setCycleInfo(pending.cycleInfo);
      setShutInActive(pending.shutInActive);
      setShutInStartedAt(pending.shutInStartedAt);
    }, 250);
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
    const runtimeBeforeSync = wellRuntimeStatesRef.current[well.wellId];
    const storedSnapshot = wellSnapshotsRef.current[well.wellId] || createWellMonitoringSnapshot(well);
    const previous = runtimeBeforeSync?.sessionCode
      && storedSnapshot.sessionCode !== runtimeBeforeSync.sessionCode
      ? createWellMonitoringSnapshot(well, runtimeBeforeSync.sessionCode)
      : storedSnapshot;
    const runtimeStartedSampleTime = wellRuntimeStatesRef.current[well.wellId]?.startedSampleTime;
    wellSnapshotsRef.current[well.wellId] = {
      ...previous,
      sessionCode: runtimeBeforeSync?.sessionCode || previous.sessionCode || null,
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
    if (well.wellId === selectedWellIdRef.current) scheduleSelectedUiSnapshot(wellSnapshotsRef.current[well.wellId]);
  }, [schedulePersistWellSnapshots, scheduleSelectedUiSnapshot]);

  const resetSelectedWellView = useCallback((well: WellInfo, startTime = '') => {
    const nextInitial = makeInitialData(well);
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
    setEventSpans([]);
    setLifecycleNodes([]);
    setEventProjectionState({ status: 'loading', message: '等待新的监测 Session 建立，正在重置事件泳道', lastUpdatedAt: null });
    clearWellAlertState(well.wellId);
    void deleteEventProjectionFromIndexedDb(well.wellId);
    timeCounter.current = 0;
    historyIdCounter.current = 1;
    activeEventIdRef.current = null;
    setIsRunning(false);
    setRawDataSourceState(createInitialDataSourceState(realtimeEndpoint, startTime));
  }, [clearWellAlertState, realtimeEndpoint]);

  const resetWellSnapshot = useCallback((well: WellInfo, sessionCode: string | null = null) => {
    const snapshot = createWellMonitoringSnapshot(well, sessionCode);
    wellSnapshotsRef.current[well.wellId] = snapshot;
    void writeWellSnapshotsToIndexedDb({ [well.wellId]: serializeWellMonitoringSnapshot(snapshot) });
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

  const startBackgroundMonitoring = useCallback((well: WellInfo, startTime: string, preserveSnapshot = false, mode: MonitoringMode = 'realtime', sessionCode?: string, lastSampleTime?: string | null, lastSourceRowNo?: number) => {
    if (well.wellId === selectedWellIdRef.current) {
      adapterRef.current?.disconnect();
      adapterRef.current = null;
    }
    stopBackgroundMonitoring(well.wellId);
    const priorRuntime = wellRuntimeStatesRef.current[well.wellId];
    const effectiveSessionCode = sessionCode || priorRuntime?.sessionCode || '';
    const existingSnapshot = getWellSnapshot(well);
    const canPreserveSnapshot = preserveSnapshot
      && Boolean(effectiveSessionCode)
      && existingSnapshot.sessionCode === effectiveSessionCode;
    if (!canPreserveSnapshot) {
      resetWellSnapshot(well, effectiveSessionCode || null);
      clearWellAlertState(well.wellId);
      void deleteEventProjectionFromIndexedDb(well.wellId);
      if (well.wellId === selectedWellIdRef.current) resetSelectedWellView(well, startTime);
    }
    const initialSnapshot = canPreserveSnapshot ? existingSnapshot : getWellSnapshot(well);
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
    const isNewBackendSession = Boolean(effectiveSessionCode && effectiveSessionCode !== priorRuntime?.sessionCode);
    const streamCursor = isNewBackendSession
      ? (canPreserveSnapshot ? lastSourceRowNo : undefined)
      : (lastSourceRowNo ?? priorRuntime?.lastSeenSourceRowNo);
    const streamSampleTime = isNewBackendSession
      ? (canPreserveSnapshot ? (lastSampleTime ?? priorRuntime?.lastSeenSampleTime) : undefined)
      : (lastSampleTime ?? priorRuntime?.lastSeenSampleTime);
    const adapterStartTime = mode === 'historyReplay'
      ? normalizeSampleTime(startTime)
      : startTime;
    const adapter = createMonitoringAdapter(
      mode,
      realtimeEndpoint,
      adapterStartTime,
      mode === 'historyReplay' ? replayIntervalMs(priorRuntime?.replaySpeed || 1) : REALTIME_FRAME_INTERVAL_MS,
      effectiveSessionCode,
      streamSampleTime,
      streamCursor,
    );
    updateWellRuntime(well.wellId, {
      monitoringMode: mode,
      sessionCode: effectiveSessionCode || undefined,
      backendRuntimeStatus: 'Running',
      isBackendRunning: true,
    });
    backgroundStreamTokensRef.current[well.wellId] = streamToken;
    const isActiveStream = () => backgroundStreamTokensRef.current[well.wellId] === streamToken && backgroundAdaptersRef.current[well.wellId] === adapter;
    backgroundAdaptersRef.current[well.wellId] = adapter;
    adapter.onStatus((state) => {
      if (!isActiveStream()) return;
      const previousRuntime = wellRuntimeStatesRef.current[well.wellId];
      const snapshotCount = wellSnapshotsRef.current[well.wellId]?.historyRecords.length ?? 0;
      const nextRecordCount = Math.max(previousRuntime?.recordCount ?? 0, snapshotCount, state.recordCount || 0);
      const streamActive = state.status === 'connected' || state.status === 'connecting' || state.status === 'reconnecting' || state.status === 'catchingUp';
      const hasBackendSession = Boolean(effectiveSessionCode || previousRuntime?.sessionCode || priorRuntime?.sessionCode);
      updateWellRuntime(well.wellId, {
        monitoringMode: mode,
        status: state.status,
        isRunning: streamActive,
        shouldAutoRestore: previousRuntime?.shouldAutoRestore !== false,
        sessionCode: state.sessionCode || previousRuntime?.sessionCode,
        runtimeId: state.runtimeId || previousRuntime?.runtimeId,
        connectionStatus: state.status,
        backendRuntimeStatus: streamActive || hasBackendSession && previousRuntime?.backendRuntimeStatus === 'Stopped'
          ? 'Running'
          : previousRuntime?.backendRuntimeStatus,
        isBackendRunning: streamActive || previousRuntime?.isBackendRunning === true || hasBackendSession,
        isSubscriberConnected: state.status === 'connected',
        lastSeenSampleTime: state.lastRecordAt || previousRuntime?.lastSeenSampleTime,
        pausedSampleTime: streamActive ? null : previousRuntime?.pausedSampleTime,
        recordCount: nextRecordCount > 0 ? nextRecordCount : undefined,
        lastRecordAt: state.lastRecordAt || previousRuntime?.lastRecordAt,
        message: formatRuntimeFrameMessage(state.message, nextRecordCount),
      });
      // A transport error is reconnecting, never a backend-session stop or identity deletion.
    });
    adapter.onRecord((record) => {
      if (!isActiveStream()) return;
      recordCount += 1;
      lastData = normalizeRealTimeRecord(record, lastData);
      const sampleTimeText = sampleTimeFromRecord(record);
      const recordTime = formatRecordTime(sampleTimeText);
      const timestampMs = recordMillis(sampleTimeText);
      const nextDetection = normalizeBackendDetection(record);
      const canPaintEvent = isMonitorableEventRecord(record, lastData);
      cycleState = cycleInfoFromRecord(record, cycleState);
      if (sampleTimeText) sampleTime = formatRecordDateTime(sampleTimeText) || sampleTimeText.replace('T', ' ');
      const activeEventId = nextDetection.advisoryLevel >= 1 && canPaintEvent ? (nextDetection.eventId || null) : null;
      backendState = nextDetection;
      flowItems = appendMonitoringPoint(flowItems,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.advisoryLevel,
          eventId: activeEventId,
          eventTitle: nextDetection.eventTitle,
          eventDescription: nextDetection.physicalDescription,
          abnormalParameters: nextDetection.activeSignals,
          flowIn: lastData.flowIn,
          flowOut: lastData.flowOut,
          wellDepth: lastData.wellDepth,
          bitDepth: lastData.bitDepth,
          pitGain: lastData.pitGain,
          pitVolume: lastData.pitVolume,
          spm1: lastData.spm1,
          spm2: lastData.spm2,
          spm3: lastData.spm3,
          totalSpm: lastData.totalSpm,
          totalSpmComplete: lastData.totalSpmComplete,
          rop: lastData.rop,
          totalGas: lastData.totalGas,
          hookLoad: lastData.hookLoad,
          wob: lastData.wob,
          rpm: lastData.rpm,
          torque: lastData.torque,
        },
      );
      pressureItems = appendMonitoringPoint(pressureItems,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.advisoryLevel,
          eventId: activeEventId,
          eventTitle: nextDetection.eventTitle,
          eventDescription: nextDetection.physicalDescription,
          abnormalParameters: nextDetection.activeSignals,
          casingPressure: lastData.casingPressure,
          drillPipePressure: lastData.drillPipePressure,
          spp: lastData.spp,
          sppPredicted: lastData.sppPredicted,
        },
      );
      historyItems = appendHistoryRecord(historyItems,
        {
          id: Math.max(0, ...historyItems.map((item) => item.id || 0)) + 1,
          time: recordTime.timeStr,
          date: recordTime.dateStr,
          pitGain: lastData.pitGain,
          pitVolume: lastData.pitVolume,
          flowIn: lastData.flowIn,
          flowOut: lastData.flowOut,
          casingPressure: lastData.casingPressure,
          drillPipePressure: lastData.drillPipePressure,
          spp: lastData.spp,
          sppPredicted: lastData.sppPredicted,
          totalSpm: lastData.totalSpm,
          totalSpmComplete: lastData.totalSpmComplete,
          totalGas: lastData.totalGas,
          hookLoad: lastData.hookLoad,
          mudWeight: lastData.mudWeight,
          rop: lastData.rop,
          bitDepth: lastData.bitDepth,
          pumpState: nextDetection.pumpState,
          cycleState: cycleState.state,
          backendLevel: nextDetection.advisoryLevel,
          baselineValid: nextDetection.baselineValid,
          baselineWarmup: nextDetection.baselineWarmup,
          monitoringReady: nextDetection.monitoringReady,
          baselineCount: nextDetection.baselineCount,
          status: backendLevelToStatus(nextDetection.advisoryLevel),
        },
      );
      updateWellRuntime(well.wellId, {
        monitoringMode: mode,
        status: 'connected',
        isRunning: true,
        shouldAutoRestore: true,
        connectionStatus: 'connected',
        isBackendRunning: true,
        isSubscriberConnected: true,
        lastSeenSourceRowNo: finite(readValue(record as Record<string, unknown>, ['source_row_no', 'sourceRowNo']), wellRuntimeStatesRef.current[well.wellId]?.lastSeenSourceRowNo ?? NaN),
        lastSeenSampleTime: sampleTime || null,
        backendLevel: nextDetection.advisoryLevel,
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
  }, [appendAlertsFromRecord, clearWellAlertState, getWellSnapshot, realtimeEndpoint, resetSelectedWellView, resetWellSnapshot, stopBackgroundMonitoring, syncWellSnapshotFromSample, updateWellRuntime]);

  useEffect(() => () => {
    Object.values(backgroundAdaptersRef.current).forEach((adapter) => adapter.disconnect());
    backgroundAdaptersRef.current = {};
    Object.values(startRequestControllersRef.current).forEach((controller) => controller.abort());
    startRequestControllersRef.current = {};
  }, []);

  useEffect(() => {
    if (!realtimeWellsLoaded) return;
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
  }, [realtimeWellsLoaded, wells]);

  useEffect(() => {
    if (!user || !realtimeWellsLoaded) return;
    const validIds = new Set(wells.map((well) => well.wellId));
    const selected = selectedWellIdsFromUser.filter((wellId) => validIds.has(wellId));
    const running = runningWellIdsFromUser.filter((wellId) => validIds.has(wellId));
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
  }, [realtimeWellsLoaded, runningWellIdsFromUser, selectedWellIdsFromUser, updateWellRuntime, user, wells]);

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
    if (authLoading) return;
    const previewMode = window.location.pathname.includes('/wellbore-preview');
    if (previewMode) {
      setWells([]);
      setSelectedWellId('');
      setRealtimeWellsLoaded(true);
      setRawDataSourceState((prev) => ({
        ...prev,
        status: 'paused',
        message: '预览模式使用 Mock 井筒参数，不读取实时井列表',
      }));
      return;
    }
    if (!hasAccessToken) {
      setWells([]);
      setSelectedWellId('');
      setRealtimeWellsLoaded(false);
      setRawDataSourceState((prev) => ({
        ...prev,
        status: 'paused',
        message: '登录后读取实时井列表',
      }));
      return;
    }
    const controller = new AbortController();
    setWells([]);
    setRealtimeWellsLoaded(false);
    setRawDataSourceState((prev) => ({
      ...prev,
      status: 'connecting',
      message: '正在读取实时井列表',
    }));
    const loadRealtimeWells = async () => {
      if (realtimeWellsRefreshInFlightRef.current) return;
      realtimeWellsRefreshInFlightRef.current = true;
      try {
        const response = await authenticatedFetch(buildRealtimeApiUrl(realtimeEndpoint, '/wells'), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { wells?: unknown[] };
        if (controller.signal.aborted) return;
        const nextWells = (payload.wells || []).map(normalizeRealtimeWell).filter(Boolean) as WellInfo[];
        setRealtimeWellsLoaded(true);
        setWells((previous) => {
          // Keep the currently displayed metadata stable while replacing the
          // server-owned realtime tail fields with the newest values.
          const previousById = new Map(previous.map((well) => [well.wellId, well]));
          const merged = nextWells.map((well) => {
            const previousWell = previousById.get(well.wellId);
            if (previousWell && JSON.stringify(previousWell) === JSON.stringify(well)) return previousWell;
            return { ...previousWell, ...well };
          });
          return merged.length === previous.length && merged.every((well, index) => well === previous[index])
            ? previous
            : merged;
        });
        const validWellIds = new Set(nextWells.map((well) => well.wellId));
        setMonitoredWellIds((current) => {
          const next = current.filter((wellId) => validWellIds.has(wellId));
          saveWellListSelection(STORAGE_MONITORED_WELLS, next);
          return next;
        });
        setRealtimeTabWellIds((current) => {
          const next = current.filter((wellId) => validWellIds.has(wellId));
          saveWellListSelection(STORAGE_REALTIME_TABS, next);
          return next;
        });
        setSelectedWellId((current) => {
          const nextSelected = validWellIds.has(current) ? current : (nextWells[0]?.wellId || '');
          if (nextSelected) saveWellSelection(STORAGE_SELECTED_WELL, nextSelected);
          else window.localStorage.removeItem(STORAGE_SELECTED_WELL);
          return nextSelected;
        });
        setRawDataSourceState((prev) => {
          if (adapterRef.current || Object.keys(backgroundAdaptersRef.current).length > 0) return prev;
          return {
            ...prev,
            status: nextWells.length > 0 ? 'connecting' : 'paused',
            message: nextWells.length > 0
              ? `已同步 ${nextWells.length} 口实时井，等待选择起始时间`
              : '数据库中未读取到可监测井',
          };
        });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        // Keep the last good list during a transient network failure. The
        // next scheduled refresh will retry without forcing a page reload.
        setRawDataSourceState((prev) => ({ ...prev, status: 'error', message: `井列表刷新失败：${error instanceof Error ? error.message : '未知错误'}` }));
      } finally {
        realtimeWellsRefreshInFlightRef.current = false;
      }
    };
    void loadRealtimeWells();
    const refreshTimer = window.setInterval(() => void loadRealtimeWells(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
      realtimeWellsRefreshInFlightRef.current = false;
    };
  }, [authLoading, hasAccessToken, realtimeEndpoint, user?.id]);

  useEffect(() => {
    if (!hasAccessToken) return undefined;
    const controller = new AbortController();
    const currentWellId = wellInfo?.wellId || '';
    const requestSessionCode = selectedWellRuntime?.sessionCode || '';
    const requestStartToken = startRequestTokensRef.current[currentWellId] || 0;
    const loadWarnings = async () => {
      if (!requestSessionCode && selectedWellRuntime?.status === 'connecting') return;
      try {
        const url = new URL('/api/warnings/events', window.location.origin);
        if (wellInfo?.wellId) url.searchParams.set('wellId', wellInfo.wellId);
        if (selectedWellRuntime?.sessionCode) url.searchParams.set('sessionCode', selectedWellRuntime.sessionCode);
        const response = await authenticatedFetch(url.toString(), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = unwrapCollection(payload, ['events', 'warnings', 'items', 'data']);
        const next = rows.flatMap((value, index) => {
          if (!value || typeof value !== 'object') return [];
          const row = value as Record<string, unknown>;
          const warningId = Number(readValue(row, ['warning_id', 'warningId', 'id']));
          const eventId = String(readValue(row, ['event_id', 'eventId']) || warningId || '').trim();
          if (!eventId || !Number.isFinite(warningId)) return [];
          // This request is scoped to the selected realtime well.  The warning API returns the
          // numeric database id, while monitoring routes and cards use the realtime table key
          // (for example rt_000004).  Keep the client-side key consistent so the queue does not
          // filter out a warning that the API just returned.
          const realtimeWellId = currentWellId;
          const sessionCode = String(readValue(row, ['session_code', 'sessionCode']) || requestSessionCode || '').trim();
          const startTimeValue = readValue(row, ['start_time', 'startTime', 'timestamp']) as string | number | undefined;
          const endTimeValue = readValue(row, ['end_time', 'endTime']) as string | number | undefined;
          const eventTime = formatRecordTime(startTimeValue);
          // Active warning rows intentionally have a NULL end_time.  Using
          // start_time as a display fallback made every refresh render an
          // active incident as `start–start / <1秒`.  Advance the visible end
          // only to the latest source sample known by this session; terminal
          // rows still use their persisted resolution time.
          const latestKnownSample = currentSampleTime || selectedWellRuntime?.lastRecordAt || rawDataSourceState.lastRecordAt || '';
          const endTime = formatRecordTime(endTimeValue || latestKnownSample || startTimeValue);
          const level = normalizeBackendLevel(readValue(row, ['current_level', 'currentLevel', 'public_level', 'publicLevel', 'level']));
          const highestLevel = normalizeBackendLevel(readValue(row, ['highest_level', 'highestLevel', 'peak_level', 'peakLevel']) ?? level);
          // Current advisory level drives the list presentation; peak is
          // retained separately as historical context.
          const displayLevel = level;
          const presentation = operatorEventPresentation(row, displayLevel);
          const ackStatus = String(readValue(row, ['ack_status', 'ackStatus']) || 'unacknowledged');
          const eventKey = eventId;
          const backendEventId = `${realtimeWellId}:${eventKey}`;
          return [{
            id: Math.max(1, Math.round(warningId || index + 1)),
            warningId,
            wellId: realtimeWellId,
            wellName: String(readValue(row, ['well_name', 'wellName']) || wellInfo.wellName),
            sessionCode: sessionCode || undefined,
            time: eventTime.timeStr,
            date: eventTime.dateStr,
            lastTime: endTime.timeStr,
            lastDate: endTime.dateStr,
            level: alertLevelFromBackend(displayLevel),
            title: presentation.title,
            description: presentation.description,
            primaryParameter: presentation.primaryParameter,
            message: presentation.title,
            acknowledged: isAcknowledgedStatus(ackStatus),
            code: eventId,
            backendEventId,
            currentBackendLevel: level,
            backendLevel: level,
            peakBackendLevel: highestLevel,
            formalEvalLevel: normalizeBackendLevel(readValue(row, ['formal_eval_level', 'formalEvalLevel']) ?? level),
            peakFormalEvalLevel: normalizeBackendLevel(readValue(row, ['peak_formal_eval_level', 'peakFormalEvalLevel']) ?? level),
            activeSignals: presentation.abnormalParameters,
            eventState: String(readValue(row, ['event_state', 'eventState', 'lifecycle_status', 'lifecycleStatus']) || 'tracking'),
            pumpState: String(readValue(row, ['pump_state', 'pumpState']) || 'Unknown'),
            lifecycleStatus: String(readValue(row, ['lifecycle_status', 'lifecycleStatus']) || ''),
            ackStatus,
            acknowledgedBy: String(readValue(row, ['acknowledged_by', 'acknowledgedBy']) || '') || undefined,
            acknowledgedAt: String(readValue(row, ['acknowledged_at', 'acknowledgedAt']) || '') || undefined,
            acknowledgementCount: Math.max(0, Math.round(finite(readValue(row, ['acknowledgement_count', 'acknowledgementCount']), 0))),
            count: Math.max(1, Math.round(finite(readValue(row, ['sample_count', 'sampleCount']), 1))),
          } as Alert];
        });
        const currentRuntime = wellRuntimeStatesRef.current[currentWellId];
        const isSameSession = selectedWellIdRef.current === currentWellId
          && (currentRuntime?.sessionCode || '') === requestSessionCode
          && (startRequestTokensRef.current[currentWellId] || 0) === requestStartToken;
        if (!controller.signal.aborted && isSameSession) {
          setAlerts((previous) => mergeQueueAlertSnapshot(previous, next, currentWellId));
        }
      } catch {
        // Frame-stream alerts remain available when the warning projection endpoint is unavailable.
      }
    };
    void loadWarnings();
    const timer = window.setInterval(() => void loadWarnings(), 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [currentSampleTime, hasAccessToken, rawDataSourceState.lastRecordAt, selectedWellRuntime?.lastRecordAt, selectedWellRuntime?.sessionCode, wellInfo?.wellId, wellInfo?.wellName]);
  useEffect(() => {
    const selectedWellId = wellInfo?.wellId;
    const sessionCode = selectedWellRuntime?.sessionCode || '';
    const projectionCacheKey = `${selectedWellRuntime?.monitoringMode || 'realtime'}:${selectedWellRuntime?.sessionCode || ''}:${selectedWellRuntime?.startedSampleTime || ''}:${selectedWellRuntime?.monitoringStartedAt || ''}`;
    if (!selectedWellId) {
      setEventSpans([]);
      setLifecycleNodes([]);
      setEventProjectionState({ status: 'fallback', message: '尚未选择井，事件投影暂不可用', lastUpdatedAt: null });
      return undefined;
    }
    const controller = new AbortController();
    const projectionStartToken = startRequestTokensRef.current[selectedWellId] || 0;
    let timer = 0;
    let cachedProjection: CachedEventProjection | null = null;
    let projectionLoadInFlight = false;
    setEventSpans([]);
    setLifecycleNodes([]);
    setEventProjectionState({ status: 'loading', message: '正在同步服务端事件投影', lastUpdatedAt: null });
    if (!sessionCode && selectedWellRuntime?.status === 'connecting') {
      setEventProjectionState({ status: 'fallback', message: '等待新的监测 Session 建立，暂不加载旧事件泳道', lastUpdatedAt: null });
      return () => controller.abort();
    }
    const applyCachedProjection = (projection: CachedEventProjection, message: string, status: EventProjectionState['status']) => {
      const currentRuntime = wellRuntimeStatesRef.current[selectedWellId];
      if (
        controller.signal.aborted
        || selectedWellIdRef.current !== selectedWellId
        || (currentRuntime?.sessionCode || '') !== sessionCode
        || (startRequestTokensRef.current[selectedWellId] || 0) !== projectionStartToken
      ) return;
      setEventSpans(projection.eventSpans);
      setLifecycleNodes(projection.lifecycleNodes);
      setEventProjectionState({ status, message, lastUpdatedAt: projection.updatedAt });
    };
    const loadCache = async () => {
      cachedProjection = await readEventProjectionFromIndexedDb(selectedWellId, projectionCacheKey);
      if (cachedProjection) applyCachedProjection(cachedProjection, `本地正式事件投影 · ${cachedProjection.eventSpans.length} 个事件 · ${cachedProjection.lifecycleNodes.length} 个节点`, 'fallback');
      else if (!hasAccessToken) {
        setEventSpans([]);
        setLifecycleNodes([]);
        setEventProjectionState({ status: 'fallback', message: '未连接服务端事件投影，曲线仅显示帧级兼容标记', lastUpdatedAt: null });
      }
    };
    const load = async () => {
      if (!hasAccessToken || projectionLoadInFlight) return;
      projectionLoadInFlight = true;
      setEventProjectionState((previous) => ({ ...previous, status: previous.lastUpdatedAt ? previous.status : 'loading', message: '正在同步服务端事件投影' }));
      try {
        const wellId = encodeURIComponent(selectedWellId);
        const sessionQuery = sessionCode ? `?sessionCode=${encodeURIComponent(sessionCode)}` : '';
        const response = await authenticatedFetch(buildRealtimeApiUrl(realtimeEndpoint, `/wells/${wellId}/event-projection${sessionQuery}`), { cache: 'no-store', signal: controller.signal });
        if (response.status === 404) {
          if (cachedProjection) applyCachedProjection(cachedProjection, '后端暂未开放 EventSpan 接口，继续显示本地正式投影', 'fallback');
          else {
            setEventSpans([]);
            setLifecycleNodes([]);
            setEventProjectionState({ status: 'fallback', message: '后端暂未开放 EventSpan 接口，当前使用帧级兼容标记', lastUpdatedAt: new Date().toISOString() });
          }
          projectionLoadInFlight = false;
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as Record<string, unknown>;
        const currentRuntime = wellRuntimeStatesRef.current[selectedWellId];
        if (
          controller.signal.aborted
          || selectedWellIdRef.current !== selectedWellId
          || (currentRuntime?.sessionCode || '') !== sessionCode
          || (startRequestTokensRef.current[selectedWellId] || 0) !== projectionStartToken
        ) {
          projectionLoadInFlight = false;
          return;
        }
        const nextSpans = unwrapCollection(payload.eventSpans ?? payload.event_spans ?? payload, ['eventSpans', 'event_spans', 'items', 'data']).map(normalizeEventSpan).filter(Boolean) as EventSpan[];
        const nextNodes = unwrapCollection(payload.lifecycleEvents ?? payload.lifecycle_events ?? payload, ['lifecycleEvents', 'lifecycle_events', 'items', 'data']).map(normalizeLifecycleNode).filter(Boolean) as LifecycleNode[];
        const updatedAt = new Date().toISOString();
        cachedProjection = { eventSpans: nextSpans, lifecycleNodes: nextNodes, updatedAt, cacheKey: projectionCacheKey };
        setEventSpans(nextSpans);
        setLifecycleNodes(nextNodes);
        setEventProjectionState({ status: 'connected', message: `服务端事件投影 · ${nextSpans.length} 个事件 · ${nextNodes.length} 个节点`, lastUpdatedAt: updatedAt });
        void writeEventProjectionToIndexedDb(selectedWellId, cachedProjection);
        projectionLoadInFlight = false;
      } catch (error) {
        projectionLoadInFlight = false;
        if (controller.signal.aborted) return;
        if (cachedProjection) applyCachedProjection(cachedProjection, `事件投影同步失败，继续显示本地正式投影：${error instanceof Error ? error.message : '未知错误'}`, 'error');
        else setEventProjectionState({ status: 'error', message: `事件投影同步失败：${error instanceof Error ? error.message : '未知错误'}`, lastUpdatedAt: new Date().toISOString() });
      }
    };
    void loadCache().then(() => void load());
    if (hasAccessToken) timer = window.setInterval(() => void load(), 15000);
    return () => {
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
  }, [hasAccessToken, realtimeEndpoint, selectedWellRuntime?.monitoringMode, selectedWellRuntime?.monitoringStartedAt, selectedWellRuntime?.sessionCode, selectedWellRuntime?.startedSampleTime, wellInfo?.wellId]);

  useEffect(() => {
    if (!hasAccessToken) return;
    if (!realtimeWellsLoaded || !wellInfo?.wellId) return;
    const controller = new AbortController();
    const preservedStartTime = selectedWellRuntime?.monitoringMode === 'historyReplay' && selectedWellRuntime?.startedSampleTime
      ? toDatetimeLocalValue(selectedWellRuntime.startedSampleTime)
      : '';
    const timeIndexRequestKey = `${realtimeEndpoint}|${wellInfo.wellId}|${preservedStartTime}`;
    if (timeIndexRequestKeyRef.current === timeIndexRequestKey) return;
    timeIndexRequestKeyRef.current = timeIndexRequestKey;
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
        timeIndexRequestKeyRef.current = '';
      });
    return () => {
      if (timeIndexRequestKeyRef.current === timeIndexRequestKey) {
        timeIndexRequestKeyRef.current = '';
      }
      controller.abort();
    };
  }, [hasAccessToken, realtimeEndpoint, realtimeWellsLoaded, selectedWellRuntime?.startedSampleTime, wellInfo?.wellId]);

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
    const mode = selectedWellRuntime?.monitoringMode || 'realtime';
    const selectedReplayStartTime = selectedWellRuntime?.selectedReplayStartTime
      || selectedWellRuntime?.startedSampleTime
      || fromDatetimeLocalValue(selectedStartTime);
    const adapterStartTime = mode === 'historyReplay'
      ? normalizeSampleTime(selectedReplayStartTime)
      : (selectedWellRuntime?.lastSeenSampleTime || selectedWellRuntime?.lastRecordAt || selectedWellRuntime?.startedSampleTime || wellLatestSampleTime(wellInfo));
    const adapter = createMonitoringAdapter(
      mode,
      realtimeEndpoint,
      adapterStartTime,
      mode === 'historyReplay' ? replayIntervalMs(selectedWellRuntime?.replaySpeed || 1) : REALTIME_FRAME_INTERVAL_MS,
      selectedWellRuntime?.sessionCode || '',
      selectedWellRuntime?.lastSeenSampleTime,
      selectedWellRuntime?.lastSeenSourceRowNo,
    );
    adapterRef.current = adapter;
    adapter.onStatus((state) => {
      const previousRuntime = wellRuntimeStatesRef.current[wellInfo.wellId];
      const snapshotCount = wellSnapshotsRef.current[wellInfo.wellId]?.historyRecords.length ?? 0;
      const nextRecordCount = Math.max(previousRuntime?.recordCount ?? 0, snapshotCount, state.recordCount || 0);
      const streamActive = state.status === 'connected' || state.status === 'connecting' || state.status === 'reconnecting' || state.status === 'catchingUp';
      setRawDataSourceState(state);
      updateWellRuntime(wellInfo.wellId, {
        monitoringMode: mode,
        status: state.status,
        isRunning: streamActive,
        shouldAutoRestore: streamActive,
        sessionCode: state.sessionCode || previousRuntime?.sessionCode,
        runtimeId: state.runtimeId || previousRuntime?.runtimeId,
        connectionStatus: state.status,
        isBackendRunning: previousRuntime?.isBackendRunning ?? true,
        isSubscriberConnected: state.status === 'connected',
        lastSeenSampleTime: state.lastRecordAt || previousRuntime?.lastSeenSampleTime,
        pausedSampleTime: streamActive ? null : previousRuntime?.pausedSampleTime,
        recordCount: nextRecordCount > 0 ? nextRecordCount : undefined,
        lastRecordAt: state.lastRecordAt || previousRuntime?.lastRecordAt,
        message: formatRuntimeFrameMessage(state.message, nextRecordCount),
      });
      if (state.status === 'paused' || state.status === 'error') {
        autoRestoringWellIdsRef.current.delete(wellInfo.wellId);
        autoRestoreFailureAtRef.current[wellInfo.wellId] = Date.now();
      }
    });
    adapter.onRecord((record) => {
      const previousSnapshot = getWellSnapshot(wellInfo);
      const sampleTimeText = sampleTimeFromRecord(record);
      const recordTime = formatRecordTime(sampleTimeText);
      const timestampMs = recordMillis(sampleTimeText);
      timeCounter.current = Number(record.cycleSeconds) > 0 ? Number(record.cycleSeconds) : timeCounter.current;
      const nextCycleInfo = cycleInfoFromRecord(record, previousSnapshot.cycleInfo);

      const nextData = normalizeRealTimeRecord(record, currentDataRef.current);
      currentDataRef.current = nextData;
      const nextDetection = normalizeBackendDetection(record);
      const canPaintEvent = isMonitorableEventRecord(record, nextData);
      if (nextDetection.eventId && canPaintEvent) {
        activeEventIdRef.current = nextDetection.eventId;
      } else if (nextDetection.advisoryLevel < 1 || !canPaintEvent) {
        activeEventIdRef.current = null;
      }
      const activeEventId = nextDetection.advisoryLevel >= 1 && canPaintEvent ? activeEventIdRef.current : null;
      const nextFlowHistory = appendMonitoringPoint(previousSnapshot.flowHistory,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.advisoryLevel,
          eventId: activeEventId,
          eventTitle: nextDetection.eventTitle,
          eventDescription: nextDetection.physicalDescription,
          abnormalParameters: nextDetection.activeSignals,
          flowIn: nextData.flowIn,
          flowOut: nextData.flowOut,
          wellDepth: nextData.wellDepth,
          bitDepth: nextData.bitDepth,
          pitGain: nextData.pitGain,
          pitVolume: nextData.pitVolume,
          spm1: nextData.spm1,
          spm2: nextData.spm2,
          spm3: nextData.spm3,
          totalSpm: nextData.totalSpm,
          totalSpmComplete: nextData.totalSpmComplete,
          rop: nextData.rop,
          totalGas: nextData.totalGas,
          hookLoad: nextData.hookLoad,
          wob: nextData.wob,
          rpm: nextData.rpm,
          torque: nextData.torque,
        },
      );
      const nextPressureHistory = appendMonitoringPoint(previousSnapshot.pressureHistory,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.advisoryLevel,
          eventId: activeEventId,
          casingPressure: nextData.casingPressure,
          drillPipePressure: nextData.drillPipePressure,
          spp: nextData.spp,
          sppPredicted: nextData.sppPredicted,
        },
      );
      const nextHistoryRecords = appendHistoryRecord(previousSnapshot.historyRecords,
        {
          id: historyIdCounter.current++,
          time: recordTime.timeStr,
          date: recordTime.dateStr,
          pitGain: nextData.pitGain,
          pitVolume: nextData.pitVolume,
          flowIn: nextData.flowIn,
          flowOut: nextData.flowOut,
          casingPressure: nextData.casingPressure,
          drillPipePressure: nextData.drillPipePressure,
          spp: nextData.spp,
          sppPredicted: nextData.sppPredicted,
          totalSpm: nextData.totalSpm,
          totalSpmComplete: nextData.totalSpmComplete,
          totalGas: nextData.totalGas,
          hookLoad: nextData.hookLoad,
          mudWeight: nextData.mudWeight,
          rop: nextData.rop,
          bitDepth: nextData.bitDepth,
          pumpState: nextDetection.pumpState,
          cycleState: nextCycleInfo.state,
          backendLevel: nextDetection.advisoryLevel,
          baselineValid: nextDetection.baselineValid,
          baselineWarmup: nextDetection.baselineWarmup,
          monitoringReady: nextDetection.monitoringReady,
          baselineCount: nextDetection.baselineCount,
          status: backendLevelToStatus(nextDetection.advisoryLevel),
        },
      );
      updateWellRuntime(wellInfo.wellId, {
        monitoringMode: mode,
        backendLevel: nextDetection.advisoryLevel,
        status: 'connected',
        isRunning: true,
        shouldAutoRestore: true,
        connectionStatus: 'connected',
        isBackendRunning: true,
        isSubscriberConnected: true,
        lastSeenSourceRowNo: finite(readValue(record as Record<string, unknown>, ['source_row_no', 'sourceRowNo']), wellRuntimeStatesRef.current[wellInfo.wellId]?.lastSeenSourceRowNo ?? NaN),
        lastSeenSampleTime: sampleTimeText ? (formatRecordDateTime(sampleTimeText) || sampleTimeText.replace('T', ' ')) : `${recordTime.dateStr} ${recordTime.timeStr}`,
        latestWellDepth: nextData.wellDepth,
        latestBitDepth: nextData.bitDepth,
        latestFormation: nextData.formation,
        recordCount: historyIdCounter.current,
        lastRecordAt: sampleTimeText ? (formatRecordDateTime(sampleTimeText) || sampleTimeText.replace('T', ' ')) : `${recordTime.dateStr} ${recordTime.timeStr}`,
        message: `检测流推送中 · ${historyIdCounter.current} 帧`,
      });
      appendAlertsFromRecord(wellInfo, record, nextData);
      syncWellSnapshotFromSample(
        wellInfo,
        nextData,
        sampleTimeText ? (formatRecordDateTime(sampleTimeText) || sampleTimeText.replace('T', ' ')) : `${recordTime.dateStr} ${recordTime.timeStr}`,
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
  }, [appendAlertsFromRecord, getWellSnapshot, isRunning, realtimeEndpoint, selectedStartTime, selectedWellRuntime?.monitoringMode, selectedWellRuntime?.selectedReplayStartTime, selectedWellRuntime?.startedSampleTime, wellInfo?.wellId]);

  const resetForWell = (well: WellInfo, startTime = selectedStartTime, clearEvents = false) => {
    const nextInitial = makeInitialData(well);
    wellSnapshotsRef.current[well.wellId] = {
      sessionCode: null,
      currentData: nextInitial,
      currentSampleTime: '',
      lastRecordAt: null,
      monitoringStartedAt: null,
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
    if (wellInfo.wellId) {
      void resetRealtimeBaseline(realtimeEndpoint, wellInfo.wellId).catch((error) => {
        console.error('Failed to reset backend baseline', error);
      });
    }
  };

  const selectWell = (wellId: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const runtime = wellRuntimeStates[wellId];
    const mode = runtime?.monitoringMode || 'realtime';
    const hasBackgroundStream = Boolean(backgroundAdaptersRef.current[wellId]);
    selectedWellIdRef.current = wellId;
    saveWellSelection(STORAGE_SELECTED_WELL, wellId);
    if (user) {
      const nextSelectedWells = Array.from(new Set([wellId, ...monitoredWellIds]));
      if (!sameStringList(nextSelectedWells, monitoredWellIds)) void saveSelectedWells(nextSelectedWells);
    }
    setSelectedWellId(wellId);
    hydrateWellView(nextWell);
    if (mode === 'historyReplay' && runtime?.startedSampleTime) {
      const nextStartTime = toDatetimeLocalValue(runtime.startedSampleTime);
      setSelectedStartTime(nextStartTime);
      setSelectedStartFrame(0);
    } else if (mode === 'realtime') {
      setSelectedStartTime('');
      setSelectedStartFrame(0);
    }
    const hasResumeProgress = hasWellResumeProgress(runtime, wellSnapshotsRef.current[wellId]);
    if (mode === 'realtime') {
      if (
        runtime?.shouldAutoRestore !== false
        && (
          hasBackgroundStream
          || (Boolean(runtime?.sessionCode) && isRuntimeStreamActive(runtime))
        )
      ) {
        setIsRunning(true);
        updateWellRuntime(wellId, {
          status: runtime?.status === 'paused' ? 'connecting' : (runtime?.status || 'connecting'),
          isRunning: true,
          shouldAutoRestore: true,
          message: runtime?.message || '正在切换监测井',
        });
        if (!hasBackgroundStream && runtime?.sessionCode) {
          startBackgroundMonitoring(
            nextWell,
            runtime?.lastSeenSampleTime || runtime?.lastRecordAt || wellLatestSampleTime(nextWell),
            true,
            'realtime',
            runtime.sessionCode,
            runtime.lastSeenSampleTime,
            runtime.lastSeenSourceRowNo,
          );
        }
        return;
      }
      setIsRunning(false);
      return;
    }
    if (
      runtime?.shouldAutoRestore !== false
      && (
        hasBackgroundStream
        || (hasResumeProgress && isRuntimeStreamActive(runtime))
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
        startBackgroundMonitoring(
          nextWell,
          getResumeSampleTime(nextWell, runtime),
           true,
           'historyReplay',
           runtime.sessionCode,
           runtime.lastSeenSampleTime,
           runtime.lastSeenSourceRowNo);
      }
      return;
    }
    setIsRunning(false);
  };

  const addMonitoredWell = useCallback((wellId: string) => {
    if (!wells.some((well) => well.wellId === wellId)) return;
    setMonitoredWellIds((prev) => {
      if (prev.includes(wellId)) return prev;
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_MONITORED_WELLS, next);
      if (user && !sameStringList(prev, next)) void saveSelectedWells(next);
      return next;
    });
  }, [user, wells]);

  const removeMonitoredWell = (wellId: string) => {
    stopBackgroundMonitoring(wellId);
    setManualStoppedWellIds((current) => current.includes(wellId) ? current : [...current, wellId]);
    setMonitoredWellIds((prev) => {
      const next = prev.filter((item) => item !== wellId);
      if (sameStringList(prev, next)) return prev;
      saveWellListSelection(STORAGE_MONITORED_WELLS, next);
      if (user) void saveSelectedWells(next);
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
      if (sameStringList(prev, next)) return prev;
      saveWellListSelection(STORAGE_MONITORED_WELLS, next);
      if (user) void saveSelectedWells(next);
      return next;
    });
  };

  const openRealtimeWell = (wellId: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const runtime = wellRuntimeStates[wellId];
    addMonitoredWell(wellId);
    setRealtimeTabWellIds((prev) => {
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_REALTIME_TABS, next);
      return next;
    });
    hydrateWellView(nextWell);
    selectedWellIdRef.current = wellId;
    if (runtime?.monitoringMode === 'realtime') {
      setSelectedWellId(wellId);
      setSelectedStartTime('');
      if (runtime?.status === 'connecting' && !runtime?.sessionCode) {
        updateWellRuntime(wellId, {
          monitoringMode: 'realtime',
          status: 'connecting',
          isRunning: false,
          shouldAutoRestore: false,
          message: runtime.message || '正在建立实时监测会话',
        });
        setIsRunning(false);
        return;
      }
      if (
        runtime?.shouldAutoRestore !== false
        && (isRuntimeStreamActive(runtime) || backgroundAdaptersRef.current[wellId])
      ) {
        updateWellRuntime(wellId, {
          status: runtime?.status === 'paused' ? 'connecting' : (runtime?.status || 'connecting'),
          isRunning: true,
          shouldAutoRestore: true,
          message: runtime?.message || '正在进入实时监测',
        });
        setIsRunning(true);
        if (!backgroundAdaptersRef.current[wellId]) {
          startBackgroundMonitoring(
            nextWell,
            runtime?.lastSeenSampleTime || runtime?.lastRecordAt || wellLatestSampleTime(nextWell),
            true,
            'realtime',
            runtime?.sessionCode,
            runtime?.lastSeenSampleTime,
            runtime?.lastSeenSourceRowNo,
          );
        }
      } else {
        updateWellRuntime(wellId, {
          monitoringMode: 'realtime',
          status: 'paused',
          isRunning: false,
          shouldAutoRestore: false,
          message: runtime?.recordCount ? '已停止实时监测，可重新监测' : '待启动',
        });
        setIsRunning(false);
      }
      return;
    }
    const nextStartTime = runtime?.startedSampleTime ? toDatetimeLocalValue(runtime.startedSampleTime) : '';
    if (nextStartTime) {
      setSelectedWellId(wellId);
      setSelectedStartTime(nextStartTime);
      if (runtime?.shouldAutoRestore !== false && (isRuntimeStreamActive(runtime) || backgroundAdaptersRef.current[wellId])) {
        const hasResumeProgress = hasWellResumeProgress(runtime, wellSnapshotsRef.current[wellId]);
        if (hasResumeProgress || backgroundAdaptersRef.current[wellId]) {
          updateWellRuntime(wellId, {
            status: runtime?.status === 'paused' ? 'connecting' : (runtime?.status || 'connecting'),
            isRunning: true,
            shouldAutoRestore: true,
            message: runtime?.message || '正在进入历史回放',
          });
          setIsRunning(true);
        } else {
          updateWellRuntime(wellId, {
            status: 'paused',
            isRunning: false,
            message: '已恢复上次回放起点，点击继续回放',
          });
          setIsRunning(false);
        }
      } else {
        updateWellRuntime(wellId, {
          status: 'paused',
          isRunning: false,
          message: '已恢复上次回放起点，点击继续回放',
        });
        setIsRunning(false);
      }
      if (
        runtime?.shouldAutoRestore !== false
        && hasWellResumeProgress(runtime, wellSnapshotsRef.current[wellId])
        && isRuntimeStreamActive(runtime)
        && !backgroundAdaptersRef.current[wellId]
      ) {
        startBackgroundMonitoring(
          nextWell,
          getResumeSampleTime(nextWell, runtime),
          true,
          runtime?.monitoringMode || 'realtime',
          runtime?.sessionCode,
          runtime?.lastSeenSampleTime,
          runtime?.lastSeenSourceRowNo);
      }
      return;
    }
    setSelectedWellId(wellId);
    startWellMonitoring(wellId);
  };

  const startWellMonitoring = useCallback(async (wellId: string, options?: { resumeFrom?: string; restartFrom?: string; preserveSnapshot?: boolean; restoreOnly?: boolean; forceRestart?: boolean; action?: 'start' | 'restart' | 'continue' }) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const priorRuntime = wellRuntimeStatesRef.current[wellId];
    const snapshotBeforeStart = wellSnapshotsRef.current[wellId] || createWellMonitoringSnapshot(nextWell);
    const monitoringMode = priorRuntime?.monitoringMode || 'realtime';
    const requestedAction = options?.action || 'start';
    const isHistoryContinue = monitoringMode === 'historyReplay' && requestedAction === 'continue';
    const isRestoreOnly = monitoringMode === 'historyReplay' && Boolean(options?.restoreOnly);
    const shouldPreserveSnapshot = monitoringMode === 'historyReplay'
      ? Boolean(options?.preserveSnapshot || isRestoreOnly || requestedAction === 'continue')
      : false;
    const wasManuallyStopped = manualStoppedWellIds.includes(wellId);
    const startToken = (startRequestTokensRef.current[wellId] || 0) + 1;
    startRequestTokensRef.current[wellId] = startToken;
    const requestController = new AbortController();
    startRequestControllersRef.current[wellId]?.abort();
    startRequestControllersRef.current[wellId] = requestController;
    const releaseStartRequest = () => {
      if (startRequestControllersRef.current[wellId] === requestController) {
        delete startRequestControllersRef.current[wellId];
      }
    };

    setManualStoppedWellIds((current) => current.includes(wellId) ? current.filter((item) => item !== wellId) : current);
    if (typeof window !== 'undefined') {
      const currentStopped = getInitialManualStoppedWellIds().filter((item) => item !== wellId);
      window.localStorage.setItem(STORAGE_MANUAL_STOPPED_WELLS, JSON.stringify(currentStopped));
    }

    addMonitoredWell(wellId);
    setRealtimeTabWellIds((prev) => {
      const next = prev.includes(wellId) ? prev : [...prev, wellId];
      saveWellListSelection(STORAGE_REALTIME_TABS, next);
      return next;
    });

    if (options?.forceRestart) {
      stopBackgroundMonitoring(wellId);
      if (priorRuntime?.sessionCode || priorRuntime?.isBackendRunning || priorRuntime?.backendRuntimeStatus === 'Running') {
        try {
          await authenticatedFetch(buildRealtimeApiUrl('', `/api/monitoring/sessions/${encodeURIComponent(wellId)}/stop`), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          });
        } catch {
          // Best effort: a stale or already-completed backend session should not block a fresh restart.
        }
        if (startRequestTokensRef.current[wellId] !== startToken) {
          releaseStartRequest();
          return;
        }
      }
    }
    if (!options?.forceRestart && (wellRuntimeStatesRef.current[wellId]?.isRunning || backgroundAdaptersRef.current[wellId])) {
      autoRestoringWellIdsRef.current.delete(wellId);
      releaseStartRequest();
      return;
    }

    const configuredReplayStart = clampReplayStartTime(
      priorRuntime?.selectedReplayStartTime
      || (wellId === selectedWellIdRef.current ? selectedStartTime : ''),
      nextWell,
    );
    const explicitRestartStart = monitoringMode === 'historyReplay' && requestedAction === 'restart'
      ? clampReplayStartTime(options?.restartFrom || '', nextWell)
      : '';
    let latestRealtimeStart = wellLatestSampleTime(nextWell);
    // The list loaded when the page opened can be behind the receiver by one
    // or more sender frames. Before creating a realtime session, ask the
    // backend for the current tail so the first attach never depends on a
    // manual page refresh.
    let latestRealtimeSourceRowNo: number | undefined;
    if (monitoringMode === 'realtime') {
      try {
        const latestResponse = await authenticatedFetch(
          buildRealtimeApiUrl(realtimeEndpoint, `/wells/${encodeURIComponent(wellId)}/times?maxOptions=1`),
          { cache: 'no-store', signal: requestController.signal },
        );
        if (latestResponse.ok) {
          const latestPayload = await latestResponse.json() as Record<string, unknown>;
          const serverLatest = normalizeSampleTime(String(
            latestPayload.last_time
              || latestPayload.lastTime
              || latestPayload.end_time
              || latestPayload.endTime
              || '',
           ));
           const parsedRowNo = finite(latestPayload.last_source_row_no ?? latestPayload.lastSourceRowNo, NaN);
           latestRealtimeSourceRowNo = Number.isFinite(parsedRowNo) ? parsedRowNo : undefined;
          if (serverLatest) {
            latestRealtimeStart = serverLatest;
            setWells((current) => current.map((item) => item.wellId === wellId
              ? { ...item, sampleEndTime: serverLatest, endTime: serverLatest, lastRealtimeSampleTime: serverLatest }
              : item));
          }
        }
      } catch (error) {
        if (requestController.signal.aborted) {
          releaseStartRequest();
          return;
        }
        // The already loaded tail remains a safe fallback for a transient
        // time-index failure; the stream itself still uses no-store reads.
      }
    }
    const resumeFrom = monitoringMode === 'historyReplay'
      ? isHistoryContinue
        ? (options?.resumeFrom || priorRuntime?.lastSeenSampleTime || priorRuntime?.lastRecordAt || '')
        : (explicitRestartStart || configuredReplayStart)
      : latestRealtimeStart;
    const directStartTime = monitoringMode === 'historyReplay'
      ? clampReplayStartTime(resumeFrom || configuredReplayStart, nextWell)
      : latestRealtimeStart;

    if (!directStartTime) {
      updateWellRuntime(wellId, {
        monitoringMode,
        status: 'error',
        isRunning: false,
        shouldAutoRestore: false,
        message: monitoringMode === 'historyReplay' ? '未读取到可用历史回放时间' : '未读取到可用实时起点',
      });
      releaseStartRequest();
      return;
    }

    const nextMonitoringStartedAt = !wasManuallyStopped && shouldPreserveSnapshot
      ? (resolveMonitoringStartedAt(
        priorRuntime,
        snapshotBeforeStart,
        priorRuntime?.startedSampleTime || snapshotBeforeStart.startedSampleTime || directStartTime || null,
        priorRuntime?.lastRecordAt || snapshotBeforeStart.lastRecordAt || snapshotBeforeStart.currentSampleTime || directStartTime || null,
      ) || new Date().toISOString())
      : new Date().toISOString();
    const nextStartTime = toDatetimeLocalValue(directStartTime);

    if (wellId === selectedWellIdRef.current) {
      adapterRef.current?.disconnect();
      adapterRef.current = null;
    }

    if (monitoringMode === 'realtime') {
      stopBackgroundMonitoring(wellId);
      if (wellId === selectedWellIdRef.current) {
        setSelectedStartFrame(0);
        setSelectedStartTime('');
      }
      updateWellRuntime(wellId, {
        monitoringMode: 'realtime',
        status: 'connecting',
        isRunning: false,
        shouldAutoRestore: false,
        monitoringStartedAt: nextMonitoringStartedAt,
        startedSampleTime: directStartTime,
        selectedReplayStartTime: priorRuntime?.selectedReplayStartTime ?? null,
        sessionCode: undefined,
        pausedSampleTime: null,
        runtimeId: undefined,
        backendRuntimeStatus: undefined,
        connectionStatus: 'connecting',
        isBackendRunning: false,
        isSubscriberConnected: false,
        lastSeenSampleTime: null,
        lastSeenSourceRowNo: undefined,
        backendCurrentSourceRowNo: undefined,
        backendCurrentSampleTime: null,
        runtimeStopReason: undefined,
        recordCount: 0,
        backendLevel: 0 as BackendLevel,
        lastRecordAt: null,
        message: `正在从最新点重新接入实时监测 · 起点 ${formatRecordTime(directStartTime).timeStr}`,
      });
      if (wellId === selectedWellIdRef.current) {
        setIsRunning(false);
      }
    } else if (isRestoreOnly) {
      updateWellRuntime(wellId, {
        monitoringMode,
        status: 'connecting',
        isRunning: true,
        shouldAutoRestore: true,
        monitoringStartedAt: nextMonitoringStartedAt,
        startedSampleTime: priorRuntime?.startedSampleTime || snapshotBeforeStart.startedSampleTime || directStartTime,
        pausedSampleTime: null,
        ...(shouldPreserveSnapshot ? {} : { recordCount: 0, backendLevel: 0 as BackendLevel, lastRecordAt: null }),
        message: `正在恢复检测流 · 起始 ${formatRecordTime(directStartTime).timeStr}`,
      });
      if (wellId === selectedWellIdRef.current) {
        setSelectedStartFrame(0);
        setSelectedStartTime(nextStartTime);
        hydrateWellView(nextWell);
        setIsRunning(true);
      }
      startBackgroundMonitoring(nextWell, directStartTime, shouldPreserveSnapshot, monitoringMode);
      autoRestoringWellIdsRef.current.delete(wellId);
      delete autoRestoreFailureAtRef.current[wellId];
      releaseStartRequest();
      return;
    } else {
      updateWellRuntime(wellId, {
        monitoringMode,
        status: 'connecting',
        isRunning: false,
        shouldAutoRestore: true,
        monitoringStartedAt: nextMonitoringStartedAt,
        startedSampleTime: directStartTime,
        selectedReplayStartTime: directStartTime,
        sessionCode: undefined,
        runtimeId: undefined,
        backendRuntimeStatus: undefined,
        connectionStatus: 'connecting',
        isBackendRunning: false,
        isSubscriberConnected: false,
        lastSeenSampleTime: null,
        lastSeenSourceRowNo: undefined,
        backendCurrentSourceRowNo: undefined,
        backendCurrentSampleTime: null,
        runtimeStopReason: undefined,
        pausedSampleTime: null,
        ...(shouldPreserveSnapshot ? {} : { recordCount: 0, backendLevel: 0 as BackendLevel, lastRecordAt: null }),
        message: `正在建立历史回放 · 起始 ${formatRecordTime(directStartTime).timeStr}`,
      });
      if (wellId === selectedWellIdRef.current) {
        setSelectedStartFrame(0);
        setSelectedStartTime(nextStartTime);
        hydrateWellView(nextWell);
        setIsRunning(false);
      }
    }

    void authenticatedFetch(buildRealtimeApiUrl('', '/api/monitoring/sessions'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: requestController.signal,
      body: JSON.stringify({
        wellId,
        mode: monitoringMode === 'historyReplay' ? 'history_replay' : 'realtime',
        startTime: toApiDateTimeOffset(directStartTime),
        afterSampleTime: monitoringMode === 'realtime' ? directStartTime : undefined,
        afterSourceRowNo: monitoringMode === 'realtime' ? latestRealtimeSourceRowNo : undefined,
        followTail: monitoringMode !== 'historyReplay',
        rateMs: monitoringMode === 'historyReplay' ? replayIntervalMs(priorRuntime?.replaySpeed || 1) : REALTIME_FRAME_INTERVAL_MS,
        action: requestedAction,
        sessionCode: isHistoryContinue ? priorRuntime?.sessionCode : undefined,
      }),
    })
      .then(async (response) => {
        if (startRequestTokensRef.current[wellId] !== startToken) return;
        const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok || payload.ok === false) throw new Error(String(payload.error || `HTTP ${response.status}`));
        const sessionCode = String(payload.sessionCode || payload.session_code || '');
        if (!sessionCode) throw new Error('Backend did not return a monitoring session code.');
        const runtimeId = String(payload.runtimeId || payload.runtime_id || '');
        const sourceRowNo = isHistoryContinue
          ? finite(payload.currentSourceRowNo ?? payload.current_source_row_no, NaN)
          : Number.NaN;
        const currentSampleTime = isHistoryContinue
          ? normalizeSampleTime(String(payload.currentSampleTime || payload.current_sample_time || ''))
          : '';
        updateWellRuntime(wellId, {
          sessionCode,
          runtimeId: runtimeId || undefined,
          backendRuntimeStatus: 'Running',
          isBackendRunning: true,
          isRunning: true,
           shouldAutoRestore: true,
           startedSampleTime: directStartTime,
           selectedReplayStartTime: monitoringMode === 'historyReplay' ? directStartTime : undefined,
           lastSeenSampleTime: currentSampleTime || undefined,
           lastSeenSourceRowNo: Number.isFinite(sourceRowNo) ? sourceRowNo : undefined,
          message: isHistoryContinue ? '正在继续原历史回放会话' : '后端监测会话已创建，正在附着数据流',
        });
        startBackgroundMonitoring(nextWell, directStartTime, shouldPreserveSnapshot, monitoringMode, sessionCode, currentSampleTime || undefined, Number.isFinite(sourceRowNo) ? sourceRowNo : undefined);
        if (wellId === selectedWellIdRef.current) setIsRunning(true);
        autoRestoringWellIdsRef.current.delete(wellId);
        delete autoRestoreFailureAtRef.current[wellId];
      })
      .catch((error: Error) => {
        if (requestController.signal.aborted || startRequestTokensRef.current[wellId] !== startToken) return;
        setManualStoppedWellIds((current) => current.includes(wellId) ? current : [...current, wellId]);
        if (typeof window !== 'undefined') {
          const currentStopped = getInitialManualStoppedWellIds();
          if (!currentStopped.includes(wellId)) {
            window.localStorage.setItem(STORAGE_MANUAL_STOPPED_WELLS, JSON.stringify([...currentStopped, wellId]));
          }
        }
        updateWellRuntime(wellId, {
          status: 'error',
          connectionStatus: 'error',
          isRunning: false,
          isBackendRunning: false,
          shouldAutoRestore: false,
          message: `无法创建监测会话：${error.message}`,
        });
        if (wellId === selectedWellIdRef.current) setIsRunning(false);
      })
      .finally(() => {
        releaseStartRequest();
      });
  }, [addMonitoredWell, hydrateWellView, manualStoppedWellIds, selectedStartTime, startBackgroundMonitoring, stopBackgroundMonitoring, updateWellRuntime, wells]);

  useEffect(() => {
    if (!hasAccessToken || !realtimeWellsLoaded) return;
    const controller = new AbortController();
    let requestInFlight = false;
    const loadActiveSessions = async () => {
      if (controller.signal.aborted || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await authenticatedFetch(
          buildRealtimeApiUrl('', '/api/monitoring/sessions/active'),
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { sessions?: Array<Record<string, unknown>> };
        if (controller.signal.aborted) return;
        for (const session of payload.sessions || []) {
          const wellId = String(session.wellId || session.well_id || '');
          const well = wells.find((item) => item.wellId === wellId);
          if (!well || backgroundAdaptersRef.current[wellId]) continue;
          // An explicit start/restart owns this transition. Attaching an active
          // session here would race the requested replay origin and make a
          // restart behave like a continuation from the old backend cursor.
          if (startRequestControllersRef.current[wellId]) continue;
          const prior = wellRuntimeStatesRef.current[wellId];
          const manuallyStopped = manualStoppedWellIds.includes(wellId) || getInitialManualStoppedWellIds().includes(wellId);
          if (manuallyStopped || prior?.shouldAutoRestore === false || prior?.runtimeStopReason === 'ManualBackendStop') continue;
          const sessionCode = String(session.sessionCode || session.session_code || prior?.sessionCode || '');
          const sessionMode = String(session.mode || '').trim().toLowerCase().replace('-', '_') === 'history_replay'
            ? 'historyReplay'
            : 'realtime';
          const backendRequestedStartTime = String(
            session.startTime
            || session.start_time
            || '',
          ).replace('T', ' ').trim();
          const backendSessionStartedAt = String(
            session.startedAt
            || session.started_at
            || '',
          ).replace('T', ' ').trim();
          const hasStableReplayStart = sessionMode !== 'historyReplay'
            || Boolean(backendRequestedStartTime || prior?.selectedReplayStartTime || prior?.startedSampleTime);
          const backendStartTime = sessionMode === 'historyReplay'
            ? backendRequestedStartTime
              || prior?.selectedReplayStartTime
              || prior?.startedSampleTime
              || wellEarliestSampleTime(well)
            : backendRequestedStartTime || backendSessionStartedAt;
          const currentSampleTime = String(session.currentSampleTime || session.current_sample_time || '').replace('T', ' ').trim();
          const resumeSampleTime = hasStableReplayStart
            ? currentSampleTime || prior?.lastSeenSampleTime
            : '';
          const sourceRowValue = finite(session.currentSourceRowNo ?? session.current_source_row_no, NaN);
          const sourceRowNo = Number.isFinite(sourceRowValue) && sourceRowValue > 0 ? sourceRowValue : undefined;
          updateWellRuntime(wellId, {
            monitoringMode: sessionMode,
            sessionCode,
            runtimeId: String(session.runtimeId || session.runtime_id || prior?.runtimeId || ''),
            backendRuntimeStatus: 'Running',
            isBackendRunning: true,
            connectionStatus: 'connecting',
            status: 'connecting',
            isRunning: true,
            shouldAutoRestore: true,
            startedSampleTime: backendStartTime || prior?.startedSampleTime || currentSampleTime || null,
            selectedReplayStartTime: sessionMode === 'historyReplay'
              ? (backendStartTime || prior?.selectedReplayStartTime || prior?.startedSampleTime || null)
              : prior?.selectedReplayStartTime || null,
            lastSeenSourceRowNo: sourceRowNo,
            lastSeenSampleTime: resumeSampleTime || prior?.lastSeenSampleTime,
            lastRecordAt: resumeSampleTime || prior?.lastRecordAt || null,
            backendCurrentSourceRowNo: sourceRowNo,
            backendCurrentSampleTime: resumeSampleTime || null,
            message: '已发现后端持续监测 Session，正在附着并补齐数据',
          });
          startBackgroundMonitoring(
            well,
            backendStartTime || currentSampleTime || prior?.lastSeenSampleTime || prior?.lastRecordAt || wellLatestSampleTime(well),
            true,
            sessionMode,
            sessionCode,
            resumeSampleTime || undefined,
            sourceRowNo,
          );
        }
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        // Preserve local session identity; a later auth/network recovery or
        // the next polling tick will retry without creating a new session.
      } finally {
        requestInFlight = false;
      }
    };
    void loadActiveSessions();
    const refreshTimer = window.setInterval(() => void loadActiveSessions(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, [hasAccessToken, manualStoppedWellIds, realtimeWellsLoaded, startBackgroundMonitoring, updateWellRuntime, wells]);

  useEffect(() => {
    if (!hasAccessToken || !realtimeWellsLoaded) return;
    restorableWellIds.forEach((wellId) => {
      if (!wells.some((well) => well.wellId === wellId)) return;
      if (backgroundAdaptersRef.current[wellId]) return;
      // An explicit start/restart owns this transition. Do not let the recovery
      // effect launch a second attach request from the previous snapshot while
      // the new Session is still being created.
      if (startRequestControllersRef.current[wellId]) return;
      if (autoRestoringWellIdsRef.current.has(wellId)) return;
      if (Date.now() - (autoRestoreFailureAtRef.current[wellId] || 0) < 30000) return;
      const runtime = wellRuntimeStates[wellId];
      if (runtime?.shouldAutoRestore === false) return;
      if (!isRuntimeStreamActive(runtime)) return;
      if (runtime?.isRunning && runtime.status === 'connected') return;
      autoRestoringWellIdsRef.current.add(wellId);
      const well = wells.find((item) => item.wellId === wellId);
      if (!well) return;
      if ((runtime?.monitoringMode || 'realtime') === 'realtime') {
        if (!runtime?.sessionCode) {
          autoRestoringWellIdsRef.current.delete(wellId);
          return;
        }
        updateWellRuntime(wellId, {
          status: 'connecting',
          connectionStatus: 'connecting',
          isRunning: true,
          shouldAutoRestore: true,
          message: runtime.message || '正在恢复实时监测连接',
        });
        startBackgroundMonitoring(
          well,
          runtime?.lastSeenSampleTime || runtime?.lastRecordAt || wellLatestSampleTime(well),
          true,
          'realtime',
          runtime.sessionCode,
          runtime.lastSeenSampleTime,
          runtime.lastSeenSourceRowNo,
        );
        autoRestoringWellIdsRef.current.delete(wellId);
        return;
      }
      const resumeFrom = getResumeSampleTime(well, runtime);
      startWellMonitoring(wellId, { resumeFrom, preserveSnapshot: true, restoreOnly: true });
    });
  }, [getResumeSampleTime, hasAccessToken, realtimeWellsLoaded, restorableWellIds, startBackgroundMonitoring, startWellMonitoring, updateWellRuntime, wellRuntimeStates, wells]);

  const pauseWellMonitoring = (wellId: string) => {
    const runtime = wellRuntimeStatesRef.current[wellId];
    const mode = runtime?.monitoringMode || 'realtime';
    if (mode === 'realtime') {
      stopWellMonitoring(wellId);
      return;
    }
    flushAllPersistence();
    startRequestControllersRef.current[wellId]?.abort();
    delete startRequestControllersRef.current[wellId];
    startRequestTokensRef.current[wellId] = (startRequestTokensRef.current[wellId] || 0) + 1;
    autoRestoringWellIdsRef.current.delete(wellId);
    stopBackgroundMonitoring(wellId);
    if (wellId === selectedWellIdRef.current) {
      adapterRef.current?.disconnect();
      adapterRef.current = null;
      setIsRunning(false);
    }
    const snapshot = wellSnapshotsRef.current[wellId];
    const pauseCursor = runtime?.lastRecordAt || snapshot?.lastRecordAt || snapshot?.currentSampleTime || null;
    updateWellRuntime(wellId, {
      monitoringMode: mode,
      status: 'paused',
      isRunning: false,
      shouldAutoRestore: true,
      connectionStatus: 'paused',
      isBackendRunning: true,
      isSubscriberConnected: false,
      lastRecordAt: pauseCursor,
      pausedSampleTime: pauseCursor,
      message: mode === 'historyReplay'
        ? '前端暂停查看，后端历史回放仍在运行'
        : '前端暂停查看，后端持续监测；恢复时会补齐断线期间的新点',
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
    const runtime = wellRuntimeStatesRef.current[wellId];
    const mode = runtime?.monitoringMode || 'realtime';
    updateWellRuntime(wellId, {
      monitoringMode: mode,
      status: 'paused',
      connectionStatus: 'paused',
      isRunning: false,
      isBackendRunning: false,
      isSubscriberConnected: false,
      backendRuntimeStatus: 'Stopped',
      runtimeStopReason: 'ManualBackendStop',
      shouldAutoRestore: false,
      startedSampleTime: null,
      pausedSampleTime: null,
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
    const mode = runtime?.monitoringMode || 'realtime';
    if (!nextWell) return;
    if (mode !== 'historyReplay') {
      restartWellMonitoring(wellId);
      return;
    }
    if (!runtime?.sessionCode) {
      updateWellRuntime(wellId, { status: 'error', connectionStatus: 'error', message: '没有可继续的历史回放会话，请选择“重新回放”。' });
      return;
    }
    startWellMonitoring(wellId, {
      resumeFrom: runtime.lastRecordAt || runtime.lastSeenSampleTime || runtime.startedSampleTime || '',
      preserveSnapshot: true,
      action: 'continue',
    });
  };

  const restartWellMonitoring = (wellId: string) => {
    if (wellRuntimeStatesRef.current[wellId]?.monitoringMode === 'historyReplay') return;
    startWellMonitoring(wellId, { action: 'restart', forceRestart: true });
  };

  const restartHistoryReplay = (wellId: string) => {
    const runtime = wellRuntimeStatesRef.current[wellId];
    if (runtime?.monitoringMode !== 'historyReplay') return;
    const restartFrom = runtime.selectedReplayStartTime
      || (wellId === selectedWellIdRef.current ? fromDatetimeLocalValue(selectedStartTime) : '');
    startWellMonitoring(wellId, {
      restartFrom,
      preserveSnapshot: false,
      action: 'restart',
      forceRestart: true,
    });
  };

  const updateWellMonitoringMode = (wellId: string, mode: MonitoringMode) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const safeMode = normalizeMonitoringMode(mode);
    const runtime = wellRuntimeStatesRef.current[wellId];
    const selectedReplayStart = clampReplayStartTime(
      runtime?.selectedReplayStartTime || runtime?.startedSampleTime || nextWell.discoveryTime || nextWell.startTime || '',
      nextWell,
    );
    const modeChanged = runtime?.monitoringMode !== safeMode;
    updateWellRuntime(wellId, {
      monitoringMode: safeMode,
      selectedReplayStartTime: safeMode === 'historyReplay' ? selectedReplayStart : runtime?.selectedReplayStartTime ?? selectedReplayStart,
      pausedSampleTime: null,
      shouldAutoRestore: false,
      ...(modeChanged ? {
        sessionCode: undefined,
        runtimeId: undefined,
        backendRuntimeStatus: undefined,
        isBackendRunning: false,
        isSubscriberConnected: false,
        lastSeenSourceRowNo: undefined,
        backendCurrentSourceRowNo: undefined,
        lastSeenSampleTime: null,
        backendCurrentSampleTime: null,
        runtimeStopReason: undefined,
      } : {}),
      message: safeMode === 'historyReplay' ? '已切换为历史回放，可选择历史时间' : '已切换为实时监测，将从最新点接入',
    });
    if (wellId === selectedWellIdRef.current) {
      const nextStartTime = safeMode === 'historyReplay' ? toDatetimeLocalValue(selectedReplayStart) : '';
      setSelectedStartTime(nextStartTime);
      if (!runtime?.isRunning) resetForWell(nextWell, nextStartTime);
    }
  };

  const updateWellReplayStartTime = (wellId: string, value: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    const nextStart = clampReplayStartTime(fromDatetimeLocalValue(value), nextWell);
    const nextLocalValue = toDatetimeLocalValue(nextStart);
    updateWellRuntime(wellId, {
      monitoringMode: 'historyReplay',
      selectedReplayStartTime: nextStart,
      startedSampleTime: nextStart,
      pausedSampleTime: null,
      shouldAutoRestore: false,
      message: nextStart ? `历史回放起点已选择 · ${formatRecordTime(nextStart).timeStr}` : '请选择历史回放起点',
    });
    if (wellId === selectedWellIdRef.current) {
      setSelectedStartTime(nextLocalValue);
      resetForWell(nextWell, nextLocalValue);
    }
  };

  const updateWellReplaySpeed = (wellId: string, speed: ReplaySpeed) => {
    const nextSpeed = normalizeReplaySpeed(speed);
    const runtime = wellRuntimeStatesRef.current[wellId];
    const resumeFrom = runtime?.lastSeenSampleTime || runtime?.lastRecordAt || null;
    const sourceRowNo = runtime?.lastSeenSourceRowNo;
    updateWellRuntime(wellId, { replaySpeed: nextSpeed });
    backgroundAdaptersRef.current[wellId]?.setReplaySpeed?.(nextSpeed, resumeFrom, sourceRowNo);
    if (wellId === selectedWellIdRef.current) {
      adapterRef.current?.setReplaySpeed?.(nextSpeed, resumeFrom, sourceRowNo);
    }
  };

  const selectStartFrame = (frame: number) => {
    const option = startOptions.find((item) => item.frame === frame);
    setSelectedStartFrame(frame);
    const nextStartTime = option?.timestamp ? toDatetimeLocalValue(option.timestamp) : '';
    setSelectedStartTime(nextStartTime);
    if (wellRuntimeStatesRef.current[wellInfo.wellId]?.monitoringMode === 'historyReplay') {
      updateWellRuntime(wellInfo.wellId, { selectedReplayStartTime: option?.timestamp || null });
    }
    resetForWell(wellInfo, nextStartTime);
  };

  const updateSelectedStartTime = (value: string) => {
    setSelectedStartTime(value);
    if (!value) {
      setSelectedStartFrame(0);
      if (wellRuntimeStatesRef.current[wellInfo.wellId]?.monitoringMode === 'historyReplay') {
        updateWellRuntime(wellInfo.wellId, { selectedReplayStartTime: null });
      }
      resetForWell(wellInfo, '');
      return;
    }
    const timeText = fromDatetimeLocalValue(value);
    const option = startOptions.find((item) => item.timestamp >= timeText);
    if (option) setSelectedStartFrame(option.frame);
    if (wellRuntimeStatesRef.current[wellInfo.wellId]?.monitoringMode === 'historyReplay') {
      updateWellRuntime(wellInfo.wellId, { selectedReplayStartTime: timeText });
    }
    resetForWell(wellInfo, value);
  };

  const acknowledgeAlert = async (id: number) => {
    const target = alerts.find((alert) => alert.id === id);
    if (!target?.warningId) {
      setRawDataSourceState((previous) => ({ ...previous, status: 'error', message: '报警确认失败：后端事件未返回 warningId，无法形成审计记录' }));
      return;
    }
    try {
      const response = await authenticatedFetch(new URL(`/api/warnings/events/${target.warningId}/acknowledge`, window.location.origin).toString(), { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const acknowledgedAt = new Date().toISOString();
      setAlerts((previous) => previous.map((alert) => alert.id === id ? { ...alert, acknowledged: true, ackStatus: 'acknowledged', acknowledgedAt, acknowledgementCount: (alert.acknowledgementCount || 0) + 1 } : alert));
      setAcknowledgedEvents((previous) => {
        const next: AcknowledgedEventMap = { ...previous, [target.backendEventId]: true };
        acknowledgedEventsRef.current = next;
        return next;
      });
    } catch (error) {
      setRawDataSourceState((previous) => ({ ...previous, status: 'error', message: `报警确认失败：${error instanceof Error ? error.message : '未知错误'}` }));
    }
  };

  const acknowledgeAll = async () => {
    const targets = alerts.filter((alert) => !alert.acknowledged && alert.warningId);
    if (targets.length === 0) {
      setRawDataSourceState((previous) => ({ ...previous, status: 'error', message: '批量确认失败：当前事件缺少可审计 warningId' }));
      return;
    }
    try {
      const response = await authenticatedFetch(new URL('/api/warnings/events/acknowledge-all', window.location.origin).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warningIds: targets.map((alert) => alert.warningId), wellId: wellInfo.wellId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const targetIds = new Set(targets.map((alert) => alert.id));
      const acknowledgedAt = new Date().toISOString();
      setAlerts((previous) => previous.map((alert) => targetIds.has(alert.id) ? { ...alert, acknowledged: true, ackStatus: 'acknowledged', acknowledgedAt, acknowledgementCount: (alert.acknowledgementCount || 0) + 1 } : alert));
      setAcknowledgedEvents((previous) => {
        const next = { ...previous };
        targets.forEach((alert) => { next[alert.backendEventId] = true; });
        acknowledgedEventsRef.current = next;
        return next;
      });
    } catch (error) {
      setRawDataSourceState((previous) => ({ ...previous, status: 'error', message: `批量确认失败：${error instanceof Error ? error.message : '未知错误'}` }));
    }
  };
  const startShutInProcedure = () => {
    if (shutInActive) return;
    const { timeStr } = formatNow();
    setShutInActive(true);
    setShutInStartedAt(timeStr);
  };

  const updateThresholds = (t: ThresholdSettings) => setThresholds(t);
  const updateMonitoringWindowMinutes = (minutes: MonitoringWindowMinutes) => setMonitoringWindowMinutes(normalizeMonitoringWindowMinutes(minutes));

  const updateRealtimeEndpoint = (endpoint: string) => {
    const safe = normalizeRealtimeEndpoint(endpoint);
    setRealtimeEndpoint(safe);
    setRawDataSourceState(createInitialDataSourceState(safe, selectedStartTime));
  };
  const buildSelectedRealtimeApiUrl = useCallback(
    (path: string) => buildRealtimeApiUrl(realtimeEndpoint, path),
    [realtimeEndpoint],
  );

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
        monitoringWindowMinutes,
        alertStatus,
        backendDetection,
        cycleInfo,
        eventSpans,
        lifecycleNodes,
        eventProjectionState,
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
        buildRealtimeApiUrl: buildSelectedRealtimeApiUrl,
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
        restartWellMonitoring,
        restartHistoryReplay,
        stopWellMonitoring,
        pauseWellMonitoring,
        resumeWellMonitoring,
        updateWellMonitoringMode,
        updateWellReplayStartTime,
        updateWellReplaySpeed,
        selectStartFrame,
        updateSelectedStartTime,
        startShutInProcedure,
        updateThresholds,
        updateMonitoringWindowMinutes,
        updateRealtimeEndpoint,
      }}
    >
      {children}
    </WellControlContext.Provider>
  );
}
