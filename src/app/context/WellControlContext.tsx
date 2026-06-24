import { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';

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
  bitDepth: number;
  rpm: number;
  confidenceLevel: number;
  pumpState: string;
  condition: string;
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
  formalEvalLevel: BackendLevel;
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
}

export interface FlowDataPoint {
  time: string;
  timestampMs?: number;
  backendLevel?: BackendLevel;
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
  cycleState: CycleState;
  backendLevel: BackendLevel;
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
const LEGACY_REALTIME_ENDPOINT = 'http://127.0.0.1:8787/api/realtime';

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

interface DataSourceAdapter {
  connect: (well: WellInfo, seed: MonitoringData) => void;
  disconnect: () => void;
  onRecord: (callback: (record: RealTimeRecord) => void) => void;
  onStatus: (callback: (state: DataSourceState) => void) => void;
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
  wellInfo: WellInfo;
  selectedWellId: string;
  algorithmInterface: AlgorithmInterfaceInfo;
  dataSourceState: DataSourceState;
  realtimeEndpoint: string;
  startOptions: RealtimeStartOption[];
  selectedStartFrame: number;
  selectedStartTime: string;
  timeBounds: RealtimeTimeBounds;
  shutInActive: boolean;
  shutInStartedAt: string | null;
  setIsRunning: (v: boolean) => void;
  handleReset: () => void;
  acknowledgeAlert: (id: number) => void;
  acknowledgeAll: () => void;
  selectWell: (wellId: string) => void;
  selectStartFrame: (frame: number) => void;
  updateSelectedStartTime: (value: string) => void;
  startShutInProcedure: () => void;
  updateThresholds: (t: ThresholdSettings) => void;
  updateRealtimeEndpoint: (endpoint: string) => void;
}

const WellControlContext = createContext<WellControlContextType | null>(null);
const MONITORING_WINDOW_MS = 30 * 60 * 1000;
const MIN_MONITORING_POINTS = 1500;

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
  rootPath: 'D:\\Study\\research\\wall_control\\V7.0\\app\\server.cjs',
  mode: 'connected',
  endpoints: [
    {
      name: 'MySQL 实时判级',
      command: '/api/realtime/wells/:wellKey/stream',
      status: 'ready',
    },
    {
      name: '后端事件日志',
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
    stateLabel: '提钻 / 抽汲',
    shortLabel: '提钻',
    description: '关注抽汲诱发的井筒体积扰动',
  },
  {
    state: 1,
    stateLabel: '钻进尾段',
    shortLabel: '稳态',
    description: '稳定段进入基线候选池',
  },
  {
    state: 2,
    stateLabel: '停钻循环',
    shortLabel: '循环',
    description: '泵仍运行，建立停泵前压力参照',
  },
  {
    state: 3,
    stateLabel: '停泵接单根',
    shortLabel: '停泵',
    description: '后端持续跟踪停泵出口流量与总池体积变化',
  },
  {
    state: 4,
    stateLabel: '开泵恢复',
    shortLabel: '开泵',
    description: '后端重新建立开泵后的水力参照',
  },
  {
    state: 5,
    stateLabel: '恢复钻进',
    shortLabel: '检测',
    description: '后端实时判级进入稳定监测窗口',
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

function recordMillis(value?: string | number) {
  if (value === undefined || value === null || value === '') return Date.now();
  const parsed = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
}

function keepMonitoringWindow<T extends { timestampMs?: number }>(items: T[]) {
  if (items.length <= MIN_MONITORING_POINTS) return items;
  const latest = items.at(-1)?.timestampMs;
  if (!Number.isFinite(latest)) return items.slice(-MIN_MONITORING_POINTS);
  const cutoff = Number(latest) - MONITORING_WINDOW_MS;
  const byTime = items.filter((item) => !Number.isFinite(item.timestampMs) || Number(item.timestampMs) >= cutoff);
  return byTime.length < MIN_MONITORING_POINTS ? items.slice(-MIN_MONITORING_POINTS) : byTime;
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

function parseFrameMillis(value?: string) {
  if (!value) return Number.NaN;
  const millis = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(millis) ? millis : Number.NaN;
}

function toDatetimeLocalValue(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}` : '';
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return '';
  return value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
}

function formatStartLabel(frame: number, timestamp: string) {
  const time = timestamp ? timestamp.replace(/^(\d{4})-(\d{2})-(\d{2})[ T]/, '$2-$3 ') : `帧 ${frame}`;
  return time;
}

function buildStartOptionsFromTimeIndex(data: {
  frame_count?: number;
  first_time?: string;
  last_time?: string;
  start_time?: string;
  end_time?: string;
  discovery_time?: string;
  discovery_frame?: number;
  discovery_rel_min?: number | null;
  discovery?: { frame?: number | null; timestamp?: string; rel_min?: number | null } | null;
  options?: Array<{ frame: number; timestamp: string; rel_min: number | null }>;
}): RealtimeStartOption[] {
  const options = (data.options || []).map((option) => {
    const frame = finite(option.frame, 0);
    return {
      frame,
      timestamp: option.timestamp,
      relMin: option.rel_min,
      label: formatStartLabel(frame, option.timestamp),
    };
  });
  const discoveryTime = data.discovery_time || data.discovery?.timestamp || '';
  if (discoveryTime) {
    const explicitFrame = Number(data.discovery_frame ?? data.discovery?.frame);
    const firstMs = parseFrameMillis(data.first_time || data.start_time || '');
    const lastMs = parseFrameMillis(data.last_time || data.end_time || '');
    const discoveryMs = parseFrameMillis(discoveryTime);
    const estimatedFrame = Number.isFinite(explicitFrame)
      ? explicitFrame
      : Number.isFinite(firstMs) && Number.isFinite(lastMs) && Number.isFinite(discoveryMs) && lastMs > firstMs
        ? Math.round(((discoveryMs - firstMs) / (lastMs - firstMs)) * Math.max(0, Number(data.frame_count) - 1))
        : 0;
    const safeFrame = Math.max(0, Math.min(Math.max(0, Number(data.frame_count || 1) - 1), estimatedFrame));
    options.unshift({
      frame: safeFrame,
      timestamp: discoveryTime,
      relMin: data.discovery_rel_min ?? data.discovery?.rel_min ?? 0,
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
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const envValue = env?.VITE_WELL_REALTIME_HTTP_URL || env?.VITE_WELL_REALTIME_WS_URL;
  if (envValue) return envValue;
  if (typeof window === 'undefined') return DEFAULT_REALTIME_ENDPOINT;
  const stored = localStorage.getItem('wcs-realtime-endpoint');
  if (!stored) return DEFAULT_REALTIME_ENDPOINT;
  if (stored === LEGACY_REALTIME_ENDPOINT) {
    localStorage.setItem('wcs-realtime-endpoint', DEFAULT_REALTIME_ENDPOINT);
    return DEFAULT_REALTIME_ENDPOINT;
  }
  return stored;
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
    bitDepth: well.depth - 28,
    rpm: 0,
    confidenceLevel: 0,
    pumpState: 'Normal',
    condition: '等待接入',
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
    bitDepth: readNumber(record, ['bitDepth', 'bit_depth', 'bit_depth_m'], previous.bitDepth),
    rpm: readNumber(record, ['rpm', 'rotary_rpm'], previous.rpm),
    confidenceLevel: readNumber(record, ['confidenceLevel', 'formal_eval_level', 'public_level', 'confidence_level'], previous.confidenceLevel),
    pumpState: String(record.pumpState || record.pump_state || previous.pumpState || 'Normal'),
    condition: String(record.condition || previous.condition || '实时检测'),
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
  return url.toString();
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
    .replace(/返出/g, '出口流量');
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
}

function normalizeBackendLogEntries(record: RealTimeRecord): BackendLogEntry[] {
  const rawEntries = Array.isArray(record.log_entries) ? record.log_entries : [];
  return rawEntries.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const publicLevel = normalizeBackendLevel(row.public_level ?? row.level ?? row.formal_eval_level);
    if (publicLevel < 2) return [];
    const timestamp = String(row.timestamp || record.timestamp || record.sampleTime || record.sample_time || '');
    const eventId = String(row.event_id ?? `${timestamp || 'frame'}-${row.frame ?? index}-${publicLevel}`);
    return [{
      eventId,
      publicLevel,
      formalEvalLevel: normalizeBackendLevel(row.formal_eval_level ?? publicLevel),
      reason: displayAlarmText(row.reason || `后端实时判级 L${publicLevel}`),
      activeSignals: parseActiveSignals(row.active_signals),
      eventState: String(row.event_state || (publicLevel >= 4 ? 'confirmed' : 'tracking')),
      pumpState: String(row.pump_state || record.pump_state || 'Unknown'),
      timestamp,
    }];
  });
}

function backendEventKey(entry: BackendLogEntry) {
  const signals = entry.activeSignals.slice().sort().join(',');
  const reason = entry.reason.replace(/\d+(?:\.\d+)?/g, '#');
  return [entry.publicLevel, entry.eventState, entry.pumpState, signals, reason].join('|');
}

function normalizeBackendDetection(record: RealTimeRecord): BackendDetectionState {
  const logs = normalizeBackendLogEntries(record);
  const latestLog = logs.at(-1);
  const publicLevel = normalizeBackendLevel(
    record.public_level ?? record.formal_eval_level ?? record.confidence_level ?? record.confidenceLevel,
  );
  const formalEvalLevel = normalizeBackendLevel(record.formal_eval_level ?? latestLog?.formalEvalLevel ?? publicLevel);
  const timestamp = String(record.timestamp || record.sampleTime || record.sample_time || latestLog?.timestamp || '');
  const activeSignals = parseActiveSignals(record.active_signals);
  return {
    publicLevel,
    formalEvalLevel,
    reason: displayAlarmText(record.reason || latestLog?.reason || ''),
    activeSignals: activeSignals.length > 0 ? activeSignals : latestLog?.activeSignals || [],
    eventState: String(record.event_state || latestLog?.eventState || (publicLevel >= 4 ? 'confirmed' : publicLevel >= 2 ? 'tracking' : publicLevel === 1 ? 'observing' : 'normal')),
    pumpState: String(record.pump_state || record.pumpState || latestLog?.pumpState || 'Unknown'),
    timestamp,
    eventId: latestLog?.eventId || null,
  };
}

function normalizeRealtimeWell(item: unknown): WellInfo | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const key = String(row.key || row.well_key || row.wellId || row.tableName || '').trim();
  if (!key) return null;
  const frameCount = finite(row.frameCount ?? row.frame_count, 0);
  return {
    wellId: key,
    wellName: key,
    block: '实时监测井 · MySQL',
    depth: 4200,
    crew: frameCount > 0 ? `${frameCount.toLocaleString('zh-CN')} 帧` : '现场队伍',
    dataSource: 'realtime',
    baselineVersion: 'realtime-v7',
    startTime: String(row.startTime || row.start_time || ''),
    endTime: String(row.endTime || row.end_time || ''),
    discoveryTime: String(row.discoveryTime || row.discovery_time || ''),
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
        adapterName: 'V7 后端检测流',
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
      adapterName: 'V7 后端检测流',
      status: 'connecting',
      endpoint: url,
      message: `正在建立 ${well.wellName} 后端检测流`,
      lastRecordAt: null,
      recordCount: 0,
    });

    try {
      this.stream = new EventSource(url);
    } catch {
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 后端检测流',
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
        adapterName: 'V7 后端检测流',
        status: 'connecting',
        endpoint: url,
        message: '后端正在按起始时间计算检测窗口',
        lastRecordAt: null,
        recordCount: this.recordCount,
      });
    });

    this.stream.addEventListener('init', (event) => {
      const data = JSON.parse((event as MessageEvent).data || '{}');
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 后端检测流',
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
        adapterName: 'V7 后端检测流',
        status: 'connected',
        endpoint: url,
        message: `检测流推送中 · ${well.wellName} · ${this.recordCount} 帧`,
        lastRecordAt: this.lastSampleTime ? formatRecordTime(this.lastSampleTime).timeStr : null,
        recordCount: this.recordCount,
      });
    });

    this.stream.addEventListener('done', () => {
      this.emitStatus({
        mode: 'realtime',
        adapterName: 'V7 后端检测流',
        status: 'paused',
        endpoint: url,
        message: `检测窗口推送完成 · ${this.recordCount} 帧`,
        lastRecordAt: this.lastSampleTime ? formatRecordTime(this.lastSampleTime).timeStr : null,
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
        adapterName: 'V7 后端检测流',
        status: 'error',
        endpoint: url,
        message: data.error || '检测流连接中断，请检查后端和 MySQL',
        lastRecordAt: this.lastSampleTime ? formatRecordTime(this.lastSampleTime).timeStr : null,
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
  const [selectedWellId, setSelectedWellId] = useState(WELLS[0].wellId);
  const [startOptions, setStartOptions] = useState<RealtimeStartOption[]>([]);
  const [selectedStartFrame, setSelectedStartFrame] = useState(0);
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [timeBounds, setTimeBounds] = useState<RealtimeTimeBounds>({
    firstTime: '',
    lastTime: '',
    discoveryTime: '',
    discoveryFrame: 0,
    discoveryRelMin: null,
  });
  const [realtimeEndpoint, setRealtimeEndpoint] = useState(getInitialRealtimeEndpoint);
  const [dataSourceState, setDataSourceState] = useState<DataSourceState>(() => createInitialDataSourceState(getInitialRealtimeEndpoint()));
  const wellInfo = wells.find((well) => well.wellId === selectedWellId) || wells[0] || WELLS[0];
  const [currentData, setCurrentData] = useState<MonitoringData>(() => makeInitialData(wellInfo));
  const currentDataRef = useRef<MonitoringData>(currentData);
  const [flowHistory, setFlowHistory] = useState<FlowDataPoint[]>([]);
  const [pressureHistory, setPressureHistory] = useState<PressureDataPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [backendDetection, setBackendDetection] = useState<BackendDetectionState>(INITIAL_BACKEND_DETECTION);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [shutInActive, setShutInActive] = useState(false);
  const [shutInStartedAt, setShutInStartedAt] = useState<string | null>(null);
  const alertIdCounter = useRef(1);
  const historyIdCounter = useRef(1);
  const timeCounter = useRef(0);
  const adapterRef = useRef<DataSourceAdapter | null>(null);
  const backendEventIdsRef = useRef<Set<string>>(new Set());
  const backendEventKeysRef = useRef<Set<string>>(new Set());
  const [cycleInfo, setCycleInfo] = useState<CycleInfo>(() => getCycleInfo(0));

  const alertStatus = backendLevelToStatus(backendDetection.publicLevel);
  const baselineInfo = useMemo<BaselineInfo>(() => {
    const frozenCycles = Math.max(0, alerts.filter((alert) => alert.backendLevel >= 4).length);
    const acceptedCycleCount = Math.max(0, cycleInfo.cycleIndex * 3 + 7 - frozenCycles);
    const totalCycles = acceptedCycleCount + frozenCycles + 4;
    return {
      totalCycles,
      qualifiedCycles: acceptedCycleCount,
      frozenCycles,
      acceptedCycleCount,
      isColdStart: acceptedCycleCount < thresholds.coldStartCycleCount,
      coldStartRemaining: Math.max(0, thresholds.coldStartCycleCount - acceptedCycleCount),
      qualityScore: clamp(72 + acceptedCycleCount * 0.8 - frozenCycles * 3.5, 48, 96),
      templateCoverage: clamp(62 + acceptedCycleCount * 1.2, 62, 98),
      lastResetReason: null,
      lastResetTime: null,
    };
  }, [alerts, cycleInfo.cycleIndex, thresholds.coldStartCycleCount]);

  useEffect(() => {
    let cancelled = false;
    setDataSourceState((prev) => ({
      ...prev,
      status: 'connecting',
      message: '正在读取后端实时井列表',
    }));
    fetch(buildRealtimeApiUrl(realtimeEndpoint, '/wells'), { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: { wells?: unknown[] }) => {
        if (cancelled) return;
        const nextWells = (payload.wells || []).map(normalizeRealtimeWell).filter(Boolean) as WellInfo[];
        if (!nextWells.length) return;
        setWells(nextWells);
        setSelectedWellId((current) => nextWells.some((well) => well.wellId === current) ? current : nextWells[0].wellId);
        setDataSourceState((prev) => ({
          ...prev,
          status: 'connecting',
          message: `已读取 ${nextWells.length} 口实时井，等待选择起始时间`,
        }));
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setDataSourceState((prev) => ({
          ...prev,
          status: 'error',
          message: `井列表读取失败：${error.message}`,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [realtimeEndpoint]);

  useEffect(() => {
    if (!wellInfo?.wellId) return;
    let cancelled = false;
    setIsRunning(false);
    setStartOptions([]);
    setSelectedStartFrame(0);
    setSelectedStartTime('');
    setTimeBounds({ firstTime: '', lastTime: '', discoveryTime: '', discoveryFrame: 0, discoveryRelMin: null });
    setDataSourceState(createInitialDataSourceState(realtimeEndpoint));
    fetch(buildRealtimeApiUrl(realtimeEndpoint, `/wells/${encodeURIComponent(wellInfo.wellId)}/times?maxOptions=30`), { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const options = buildStartOptionsFromTimeIndex(data);
        const discoveryFrame = finite(data.discovery_frame ?? data.discovery?.frame, 0);
        const firstTime = data.first_time || data.start_time || options[0]?.timestamp || '';
        const lastTime = data.last_time || data.end_time || options.at(-1)?.timestamp || '';
        const discoveryTime = data.discovery_time || data.discovery?.timestamp || firstTime;
        setStartOptions(options);
        setTimeBounds({
          firstTime,
          lastTime,
          discoveryTime,
          discoveryFrame,
          discoveryRelMin: data.discovery_rel_min ?? data.discovery?.rel_min ?? null,
        });
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
        if (cancelled) return;
        setDataSourceState((prev) => ({
          ...prev,
          status: 'error',
          message: `时间索引读取失败：${error.message}`,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [realtimeEndpoint, wellInfo?.wellId]);

  useEffect(() => {
    adapterRef.current?.disconnect();
    if (!isRunning) {
      setDataSourceState((prev) => ({
        ...prev,
        adapterName: realtimeEndpoint ? prev.adapterName || 'MySQL 实时数据接口' : '真实数据接口',
        endpoint: prev.endpoint || realtimeEndpoint || null,
        status: realtimeEndpoint ? 'paused' : 'error',
        message: realtimeEndpoint
          ? selectedStartTime
            ? '已选择开始时间，点击开始监测'
            : '等待选择开始时间并启动监测'
          : '采集已暂停：未配置真实数据接口',
      }));
      return;
    }

    const seed = makeInitialData(wellInfo);
    const adapter: DataSourceAdapter = realtimeEndpoint
      ? new SseDetectionDataSourceAdapter(realtimeEndpoint, fromDatetimeLocalValue(selectedStartTime), 1200)
      : new DisabledDataSourceAdapter();
    adapterRef.current = adapter;
    adapter.onStatus(setDataSourceState);
    adapter.onRecord((record) => {
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
      const nextDetection = normalizeBackendDetection(record);
      setBackendDetection(nextDetection);
      const backendLogs = normalizeBackendLogEntries(record);
      if (backendLogs.length > 0) {
        setAlerts((previous) => {
          let nextAlerts = previous;
          const additions: Alert[] = [];
          backendLogs.forEach((entry) => {
            const eventKey = backendEventKey(entry);
            const eventTime = formatRecordTime(entry.timestamp || record.timestamp);
            const existingIndex = nextAlerts.findIndex((alert) => alert.backendEventId === eventKey);
            if (existingIndex >= 0) {
              nextAlerts = nextAlerts.map((alert, index) => index === existingIndex ? {
                ...alert,
                time: eventTime.timeStr,
                date: eventTime.dateStr,
                lastTime: eventTime.timeStr,
                lastDate: eventTime.dateStr,
                count: (alert.count || 1) + 1,
                backendLevel: entry.publicLevel,
                formalEvalLevel: entry.formalEvalLevel,
                activeSignals: entry.activeSignals,
                eventState: entry.eventState,
                pumpState: entry.pumpState,
              } : alert);
              return;
            }
            if (backendEventIdsRef.current.has(entry.eventId) || backendEventKeysRef.current.has(eventKey)) return;
            backendEventIdsRef.current.add(entry.eventId);
            backendEventKeysRef.current.add(eventKey);
            additions.push({
              id: alertIdCounter.current++,
              time: eventTime.timeStr,
              date: eventTime.dateStr,
              lastTime: eventTime.timeStr,
              lastDate: eventTime.dateStr,
              level: entry.publicLevel >= 4 ? 'critical' as const : 'warning' as const,
              message: entry.reason,
              acknowledged: false,
              code: entry.eventId,
              backendEventId: eventKey,
              backendLevel: entry.publicLevel,
              formalEvalLevel: entry.formalEvalLevel,
              activeSignals: entry.activeSignals,
              eventState: entry.eventState,
              pumpState: entry.pumpState,
              count: 1,
            });
          });
          return additions.length > 0 ? [...additions.reverse(), ...nextAlerts].slice(0, 60) : nextAlerts;
        });
      }
      setFlowHistory((prev) => keepMonitoringWindow([
        ...prev,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.publicLevel,
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
      ]));
      setPressureHistory((prev) => keepMonitoringWindow([
        ...prev,
        {
          time: recordTime.timeStr,
          timestampMs,
          backendLevel: nextDetection.publicLevel,
          casingPressure: nextData.casingPressure,
          drillPipePressure: nextData.drillPipePressure,
          spp: nextData.spp,
          sppPredicted: nextData.sppPredicted,
        },
      ]));
      setHistoryRecords((prev) => [
        ...prev.slice(-239),
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
          cycleState: nextCycleInfo.state,
          backendLevel: nextDetection.publicLevel,
          status: backendLevelToStatus(nextDetection.publicLevel),
        },
      ]);
    });
    adapter.connect(wellInfo, seed);

    return () => {
      adapter.disconnect();
    };
  }, [isRunning, selectedWellId, realtimeEndpoint, selectedStartTime, wellInfo]);

  const resetForWell = (well: WellInfo, startTime = selectedStartTime) => {
    const nextInitial = makeInitialData(well);
    currentDataRef.current = nextInitial;
    setCurrentData(nextInitial);
    setFlowHistory([]);
    setPressureHistory([]);
    setAlerts([]);
    setBackendDetection(INITIAL_BACKEND_DETECTION);
    setHistoryRecords([]);
    setShutInActive(false);
    setShutInStartedAt(null);
    setCycleInfo(getCycleInfo(0));
    timeCounter.current = 0;
    alertIdCounter.current = 1;
    historyIdCounter.current = 1;
    backendEventIdsRef.current.clear();
    backendEventKeysRef.current.clear();
    setIsRunning(false);
    setDataSourceState(createInitialDataSourceState(realtimeEndpoint, startTime));
  };

  const handleReset = () => {
    resetForWell(wellInfo);
  };

  const selectWell = (wellId: string) => {
    const nextWell = wells.find((well) => well.wellId === wellId);
    if (!nextWell) return;
    setSelectedWellId(wellId);
    resetForWell(nextWell, '');
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
  };

  const acknowledgeAll = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  };

  const startShutInProcedure = () => {
    if (shutInActive) return;
    const { timeStr } = formatNow();
    setShutInActive(true);
    setShutInStartedAt(timeStr);
  };

  const updateThresholds = (t: ThresholdSettings) => setThresholds(t);

  const updateRealtimeEndpoint = (endpoint: string) => {
    const next = endpoint.trim();
    setRealtimeEndpoint(next);
    if (next) localStorage.setItem('wcs-realtime-endpoint', next);
    else localStorage.removeItem('wcs-realtime-endpoint');
    setDataSourceState(createInitialDataSourceState(next, selectedStartTime));
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
        wellInfo,
        selectedWellId,
        algorithmInterface: ALGORITHM_INTERFACE,
        dataSourceState,
        realtimeEndpoint,
        startOptions,
        selectedStartFrame,
        selectedStartTime,
        timeBounds,
        shutInActive,
        shutInStartedAt,
        setIsRunning,
        handleReset,
        acknowledgeAlert,
        acknowledgeAll,
        selectWell,
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
