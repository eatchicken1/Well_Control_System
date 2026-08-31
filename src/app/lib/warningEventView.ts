import type { BackendLevel } from '../context/WellControlContext';
import type { WarningEventLatestFrame, WarningEventReviewItem, WarningEventTrendPoint } from '../api/warningsApi';
import { formatSourceTime, parseSourceDateMs } from './sourceTime';

/**
 * Shared presentation helpers for persisted warning events (list rows,
 * detail page). All labels stay in operator language: detector enums and
 * internal candidate names never surface here.
 */

export function safeLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

export function formalVisualLevel(value: unknown): 2 | 3 | 4 {
  const level = safeLevel(value);
  return level >= 4 ? 4 : level >= 3 ? 3 : 2;
}

export function eventLevel(event: WarningEventReviewItem) {
  return Math.max(safeLevel(event.currentLevel), safeLevel(event.highestLevel)) as BackendLevel;
}

export function lifecycleKey(event: WarningEventReviewItem) {
  return (event.candidateState || event.status || '').trim().toLowerCase();
}

export function isEnded(event: WarningEventReviewItem) {
  const state = lifecycleKey(event);
  return event.status.toLowerCase() === 'ended'
    || state === 'ended'
    || state === 'resolved'
    || state === 'closed'
    || state === 'closedunresolved';
}

export function lifecycleLabel(event: WarningEventReviewItem) {
  if (event.isAcknowledged) return '已确认';
  const state = lifecycleKey(event);
  if (isEnded(event)) return state === 'closedunresolved' ? '已关闭·未解除' : '已结束';
  if (state === 'tracking') return '持续跟踪';
  if (state === 'observing' || state === 'watch') return '异常观察';
  if (state === 'recovering') return '恢复观察';
  if (state === 'hold') return '保持（解释冻结）';
  if (state === 'confirmed') return '风险确认';
  return event.status === 'active' ? '预警中' : event.status || '待确认';
}

export function formatDuration(start: string, end: string) {
  if (!start || !end) return '持续中';
  const startMs = parseSourceDateMs(start);
  const endMs = parseSourceDateMs(end);
  if (startMs === null || endMs === null) return '—';
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds < 0) return '—';
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

/** Axis label for trend charts: source-civil HH:mm:ss. */
export function trendTimeLabel(value: string) {
  return formatSourceTime(value) || value.slice(11, 19) || value;
}

export function cleanTechnicalText(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/certificate|证书|UnknownProxy|H_kick_watch|candidate_cluster|precursor_certificate/i.test(text)) return '';
  return text
    .replace(/H_kick_watch/gi, '疑似溢流，继续观察')
    .replace(/UnknownProxy/gi, '出口流量测量类型尚未确认')
    .replace(/candidate[_\s-]*cluster/gi, '异常组合')
    .replace(/certificate/gi, '组合证据')
    .replace(/precursor/gi, '早期异常')
    .replace(/[；;]\s*[；;]+/g, '；')
    .trim();
}

export function plainEventState(value?: string | null) {
  const state = String(value || '').trim().toLowerCase();
  if (['active', 'tracking', 'observing', 'suspected', 'watch', 'open'].includes(state)) return '异常仍在持续，需继续观察';
  if (state === 'confirmed') return '异常已确认';
  if (['recovering', 'recovery'].includes(state)) return '参数正在恢复，暂不能解除观察';
  if (state === 'hold') return '事件保持：解释框架切换/数据间断，事件身份保留，参考学习冻结';
  if (state === 'closedunresolved') return '事件已关闭（未解除）';
  if (['closed', 'resolved', 'ended'].includes(state)) return '事件已结束';
  return '等待更多现场数据';
}

export function plainLifecycleEvent(value: string) {
  const key = value.trim().toLowerCase();
  if (/(created|opened|start)/.test(key)) return '首次发现异常';
  if (/(escalat|promot|level_up)/.test(key)) return '异常程度升高';
  if (/(recover|deescalat|level_down)/.test(key)) return '参数开始恢复';
  if (/(closed|resolved|ended)/.test(key)) return '事件结束';
  if (/(updated|revision|track)/.test(key)) return '持续观察到新变化';
  return '事件状态更新';
}

/* ------------------------------------------------------------------ */
/* Active-signal parsing (operator language)                           */
/* ------------------------------------------------------------------ */

function signalDirection(signal: string) {
  const key = signal.toLowerCase();
  if (key === 'total_gas' || key === 'gas_support') return 'up';
  if (/(increase|rise|gain|elevat|up|增|升)/.test(key)) return 'up';
  if (/(drop|decrease|loss|down|降|跌)/.test(key)) return 'down';
  return 'watch';
}

function signalParameters(signal: string) {
  const key = signal.toLowerCase();
  const parameters: string[] = [];
  if (/(outlet|return|出口|返出)/.test(key)) parameters.push('出口流量');
  if (/(pit|pool|volume|池)/.test(key)) parameters.push('总池体积');
  if (/(standpipe|spp|pressure|立压)/.test(key) && !/(casing|套压)/.test(key)) parameters.push('立管压力');
  if (/(casing|套压)/.test(key)) parameters.push('套管压力');
  if (/(gas|烃|气测)/.test(key)) parameters.push('气测');
  if (/(rop|钻速)/.test(key)) parameters.push('钻速');
  if (/(inlet|入口)/.test(key)) parameters.push('入口流量');
  return [...new Set(parameters)];
}

export function abnormalParameters(signals: string[], _frame?: WarningEventLatestFrame | null) {
  const byParameter = new Map<string, { parameter: string; direction: string; source: string }>();
  signals.forEach((signal) => {
    if (/unknownproxy|outlet_semantic/i.test(signal)) return;
    const direction = signalDirection(signal);
    signalParameters(signal).forEach((parameter) => {
      const previous = byParameter.get(parameter);
      if (!previous || previous.direction === 'watch') byParameter.set(parameter, { parameter, direction, source: signal });
    });
  });
  return [...byParameter.values()];
}

/** Compact parameter-direction labels for list rows, e.g. “出口流量升高”. */
export function fieldSignalLabels(signals: string[]) {
  return abnormalParameters(signals).map((item) => (
    `${item.parameter}${item.direction === 'up' ? '升高' : item.direction === 'down' ? '降低' : '出现异常趋势'}`
  ));
}

/* ------------------------------------------------------------------ */
/* Trend channel analytics                                             */
/* ------------------------------------------------------------------ */

export type TrendChannelKey = 'inletFlow' | 'outletFlow' | 'pitVolume' | 'standpipePressure' | 'casingPressure';

export interface TrendChannelMeta {
  key: TrendChannelKey;
  label: string;
  unit: string;
  /** Chart stroke color, shared with monitoring curves where possible. */
  color: string;
  precision: number;
  family: 'pressure' | 'fluid';
}

export const TREND_CHANNELS: TrendChannelMeta[] = [
  { key: 'standpipePressure', label: '立管压力', unit: 'MPa', color: '#0891b2', precision: 2, family: 'pressure' },
  { key: 'casingPressure', label: '套管压力', unit: 'MPa', color: '#7c3aed', precision: 2, family: 'pressure' },
  { key: 'outletFlow', label: '出口流量', unit: '', color: '#2563eb', precision: 2, family: 'fluid' },
  { key: 'pitVolume', label: '总池体积', unit: 'm³', color: '#d97706', precision: 2, family: 'fluid' },
  { key: 'inletFlow', label: '入口流量', unit: 'L/s', color: '#059669', precision: 2, family: 'fluid' },
];

export type ChannelDeviation = 'not_evaluable' | 'none' | 'mild' | 'moderate' | 'strong';

export interface ChannelStat {
  meta: TrendChannelMeta;
  series: Array<{ time: string; value: number }>;
  /** Median of the leading window inside the event, used as the onset reference. */
  baseline: number | null;
  current: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  direction: 'up' | 'down' | 'flat';
  deviation: ChannelDeviation;
  /** 0-100 strength score for trust bars. */
  strengthPct: number;
  min: number | null;
  max: number | null;
}

/**
 * The persisted trend covers the event window only, so the leading window is
 * the closest honest approximation of the onset reference ("事件起点参考");
 * the current value prefers the persisted latest frame and falls back to the
 * trailing trend point.
 */
export function buildChannelStats(
  trend: WarningEventTrendPoint[] | undefined,
  frame?: (Partial<Record<TrendChannelKey, number | null>> & Pick<WarningEventLatestFrame, 'outletUnit' | 'inletUnit'>) | null,
): ChannelStat[] {
  return TREND_CHANNELS.map((baseMeta) => {
    const meta = baseMeta.key === 'outletFlow' && frame?.outletUnit
      ? { ...baseMeta, unit: frame.outletUnit }
      : baseMeta.key === 'inletFlow' && frame?.inletUnit
        ? { ...baseMeta, unit: frame.inletUnit }
        : baseMeta;
    const series = (trend || [])
      .map((point) => ({ time: point.sampleTime, value: point[meta.key] }))
      .filter((point): point is { time: string; value: number } => typeof point.value === 'number' && Number.isFinite(point.value));
    const baseline = null;
    const frameValue = frame?.[meta.key];
    const current = typeof frameValue === 'number' && Number.isFinite(frameValue)
      ? frameValue
      : series.length
        ? series[series.length - 1].value
        : null;
    const min = series.length ? Math.min(...series.map((point) => point.value)) : null;
    const max = series.length ? Math.max(...series.map((point) => point.value)) : null;
    const deltaAbs = null;
    const deltaPct = null;
    const direction = 'flat' as const;
    const deviation: ChannelDeviation = 'not_evaluable';
    const strengthPct = 0;
    return { meta, series, baseline, current, deltaAbs, deltaPct, direction, deviation, strengthPct, min, max };
  });
}

export const DEVIATION_LABEL: Record<ChannelDeviation, string> = {
  not_evaluable: '未评估',
  none: '未偏离',
  mild: '轻度偏离',
  moderate: '明显偏离',
  strong: '强烈偏离',
};

export function formatChannelValue(stat: ChannelStat, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(stat.meta.precision)} ${stat.meta.unit}`;
}

export function formatDeltaPct(stat: ChannelStat) {
  if (stat.deviation === 'not_evaluable') return '未评估';
  if (stat.deltaPct == null || stat.direction === 'flat') return '基本持平';
  const arrow = stat.direction === 'up' ? '↑' : '↓';
  return `${arrow} ${Math.abs(stat.deltaPct).toFixed(1)}%`;
}

/* ------------------------------------------------------------------ */
/* Evidence families                                                   */
/* ------------------------------------------------------------------ */

export type EvidenceFamilyId = 'pressure' | 'pitinventory' | 'outletreturn' | 'fluidcomposition' | 'mechanical' | 'pumpboundary' | 'surfaceoperation' | 'sensorquality' | 'causalclosure';

export interface EvidenceFamily {
  id: EvidenceFamilyId;
  title: string;
  channels: ChannelStat[];
  /** Strongest member deviation drives the family badge. */
  deviation: ChannelDeviation;
  strengthPct: number;
  available: boolean;
  direction: string;
  persistenceSeconds: number;
  reason: string;
}

const FAMILY_TITLES: Record<EvidenceFamilyId, string> = {
  pressure: '压力证据',
  pitinventory: '池量库存证据',
  outletreturn: '出口返流证据',
  fluidcomposition: '流体组分证据',
  mechanical: '机械响应证据',
  pumpboundary: '泵边界证据',
  surfaceoperation: '地面作业证据',
  sensorquality: '传感器质量证据',
  causalclosure: '因果闭合证据',
};

const FAMILY_CHANNELS: Partial<Record<EvidenceFamilyId, TrendChannelKey[]>> = {
  pressure: ['standpipePressure', 'casingPressure'],
  pitinventory: ['pitVolume'],
  outletreturn: ['outletFlow'],
};

export function buildEvidenceFamilies(stats: ChannelStat[], frame?: WarningEventLatestFrame | null): EvidenceFamily[] {
  const backendFamilies = frame?.evidence?.families || [];
  const ids = backendFamilies.map((item) => item.family.toLowerCase()).filter((id): id is EvidenceFamilyId => id in FAMILY_TITLES);
  return ids
    .map((id) => {
      const channelKeys = FAMILY_CHANNELS[id] || [];
      const channels = stats.filter((stat) => channelKeys.includes(stat.meta.key) && stat.series.length > 0);
      const backend = backendFamilies.find((item) => item.family.toLowerCase() === id);
      const deviation: ChannelDeviation = backend?.available ? 'moderate' : 'not_evaluable';
      return { id, title: FAMILY_TITLES[id] || id, channels, deviation, strengthPct: 0,
        available: backend?.available === true, direction: backend?.direction || 'Unavailable',
        persistenceSeconds: backend?.persistenceSeconds || 0, reason: backend?.reason || '后端未提供证据评估' };
    })
    .filter((family) => family.channels.length > 0 || backendFamilies.some((item) => item.family.toLowerCase() === family.id));
}

export function familyBadge(deviation: ChannelDeviation) {
  if (deviation === 'not_evaluable') return { text: '未评估', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
  if (deviation === 'strong') return { text: '高度', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' };
  if (deviation === 'moderate') return { text: '支持', className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100' };
  if (deviation === 'mild') return { text: '轻度', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
  return { text: '未偏离', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
}

export function trustLabel(strengthPct: number) {
  if (strengthPct >= 70) return '较高';
  if (strengthPct >= 40) return '中等';
  return '较低';
}
