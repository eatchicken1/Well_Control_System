import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileWarning,
  Gauge,
  Hash,
  LineChart as LineChartIcon,
  RefreshCw,
  ScrollText,
  Waves,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { acknowledgeWarningEvent, fetchWarningEventDetail, type WarningEventReviewDetail, type WarningEventReviewItem } from '../api/warningsApi';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';
import { operatorEventPresentation } from '../lib/operatorEventPresentation';
import { formatSourceDateTime, formatSourceTime } from '../lib/sourceTime';
import { LEVEL_VISUAL, safeLevel } from '../lib/levelVisual';
import {
  buildChannelStats,
  buildEvidenceFamilies,
  cleanTechnicalText,
  DEVIATION_LABEL,
  familyBadge,
  formatChannelValue,
  formatDeltaPct,
  formatDuration,
  isEnded,
  lifecycleLabel,
  plainEventState,
  plainLifecycleEvent,
  trendTimeLabel,
  trustLabel,
  type ChannelStat,
  type EvidenceFamily,
} from '../lib/warningEventView';

type TabId = 'overview' | 'evidence' | 'parameters' | 'action';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: '事件概览' },
  { id: 'evidence', label: '证据链' },
  { id: 'parameters', label: '参数详情' },
  { id: 'action', label: '处置建议' },
];

const FAMILY_ICONS = {
  pressure: Gauge,
  fluid: Waves,
} as const;

function statusBadgeInfo(event: WarningEventReviewItem) {
  if (event.isAcknowledged && isEnded(event)) return { text: '已确认·已结束', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  if (event.isAcknowledged) return { text: '已确认', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100' };
  if (isEnded(event)) return { text: '已结束', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  return { text: '预警中', className: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100' };
}

function DeltaBadge({ stat }: { stat: ChannelStat }) {
  if (stat.direction === 'flat' || stat.deltaPct == null) {
    return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">持平</span>;
  }
  const up = stat.direction === 'up';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${up ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'}`}>
      {up ? '↑' : '↓'}
      {Math.abs(stat.deltaPct).toFixed(1)}%
    </span>
  );
}

/** Compact SVG trend preview for evidence cards (no chart lib overhead). */
function Sparkline({ values, color, height = 48 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) {
    return <div className="flex items-center justify-center text-[10px] ops-muted" style={{ height }}>样本不足</div>;
  }
  const width = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const toY = (value: number) => height - 5 - ((value - min) / span) * (height - 10);
  const linePoints = values.map((value, index) => `${(index * stepX).toFixed(2)},${toY(value).toFixed(2)}`);
  const areaPoints = `0,${height} ${linePoints.join(' ')} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} className="w-full" role="img" aria-label="事件窗口趋势缩略图">
      <polygon points={areaPoints} fill={color} opacity={0.08} />
      <polyline points={linePoints.join(' ')} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ChannelTrendChart({ stat, height = 220 }: { stat: ChannelStat; height?: number }) {
  const data = stat.series.map((point) => ({ time: trendTimeLabel(point.time), value: point.value }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 14, bottom: 2, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.28)" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.4)' }} minTickGap={32} />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => value.toFixed(stat.meta.precision)}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(stat.meta.precision)} ${stat.meta.unit}`, stat.meta.label]}
          labelStyle={{ color: '#475569' }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(148,163,184,0.4)' }}
        />
        {stat.baseline != null && (
          <ReferenceLine
            y={stat.baseline}
            stroke="#94a3b8"
            strokeDasharray="6 4"
            label={{ value: `事件起点 ${stat.baseline.toFixed(stat.meta.precision)}`, position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }}
          />
        )}
        <Line type="monotone" dataKey="value" stroke={stat.meta.color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Panel({ title, subtitle, icon: Icon, children, actions }: { title: string; subtitle?: string; icon?: typeof Gauge; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="ops-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/80">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {Icon ? <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /> : null}
          {title}
          {subtitle ? <span className="text-xs font-normal ops-muted">{subtitle}</span> : null}
        </h3>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

interface ChainNode {
  time: string;
  title: string;
  description: string;
  level: number;
}

function buildEvolutionChain(detail: WarningEventReviewDetail): ChainNode[] {
  const lifecycle = detail.lifecycle || [];
  if (!lifecycle.length) return [];
  const nodes: ChainNode[] = [];
  const first = lifecycle[0];
  nodes.push({
    time: first.sampleTime,
    title: '首次识别',
    description: cleanTechnicalText(first.reason) || plainLifecycleEvent(first.eventName),
    level: first.publicLevel,
  });
  let lastLevel = first.publicLevel;
  lifecycle.slice(1).forEach((entry) => {
    if (entry.publicLevel !== lastLevel) {
      nodes.push({
        time: entry.sampleTime,
        title: entry.publicLevel > lastLevel ? '事件升级' : '参数恢复',
        description: cleanTechnicalText(entry.reason) || plainLifecycleEvent(entry.eventName),
        level: entry.publicLevel,
      });
      lastLevel = entry.publicLevel;
    }
  });
  const last = lifecycle[lifecycle.length - 1];
  if (nodes.length && nodes[nodes.length - 1].time !== last.sampleTime) {
    nodes.push({
      time: last.sampleTime,
      title: '最新状态',
      description: cleanTechnicalText(last.reason) || plainLifecycleEvent(last.eventName),
      level: last.publicLevel,
    });
  }
  return nodes.length <= 5 ? nodes : [nodes[0], ...nodes.slice(nodes.length - 4)];
}

function EvolutionChain({ nodes }: { nodes: ChainNode[] }) {
  if (!nodes.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm ops-muted dark:border-slate-700">后端尚未保存该事件的演化记录。</div>;
  }
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {nodes.map((node, index) => {
        const visual = LEVEL_VISUAL[safeLevel(node.level)];
        return (
          <div key={`${node.time}-${node.title}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />}
            <div className={`min-w-[128px] rounded-lg border p-2.5 ${visual.tone}`}>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{node.title}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] ops-muted">
                <span className={`rounded px-1 py-0.5 text-[10px] font-semibold ${visual.badge}`}>L{node.level}</span>
                {formatSourceTime(node.time) || node.time}
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600 dark:text-slate-300" title={node.description}>{node.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrustBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" title={label}>{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] ops-muted">{trustLabel(value)}</span>
    </div>
  );
}

function EvidenceCard({ stat }: { stat: ChannelStat }) {
  const badge = familyBadge(stat.deviation);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stat.meta.color }} />
          <span className="truncate">{stat.meta.label}证据</span>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stat.current != null ? stat.current.toFixed(stat.meta.precision) : '—'}</span>
        <span className="text-[11px] ops-muted">{stat.meta.unit}</span>
        <DeltaBadge stat={stat} />
      </div>
      <div className="mt-2">
        <Sparkline values={stat.series.map((point) => point.value)} color={stat.meta.color} />
        <div className="mt-0.5 flex justify-between text-[10px] ops-muted">
          <span>{stat.series.length ? trendTimeLabel(stat.series[0].time) : ''}</span>
          <span>{stat.series.length ? trendTimeLabel(stat.series[stat.series.length - 1].time) : ''}</span>
        </div>
      </div>
      <div className="mt-1.5 text-[11px] ops-muted">证据强度: {DEVIATION_LABEL[stat.deviation]}</div>
    </div>
  );
}

function buildSuggestions(event: WarningEventReviewItem, stats: ChannelStat[], chain: ChainNode[]) {
  const abnormal = stats
    .filter((stat) => stat.deviation !== 'none')
    .sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
  const suggestions: string[] = [];
  if (isEnded(event)) {
    suggestions.push('事件已结束:请复核事件窗口内曲线,确认异常参数没有反弹后,填写处置备注并确认留痕。');
  } else if (abnormal.length) {
    const topText = abnormal.slice(0, 2).map((stat) => `${stat.meta.label}${stat.direction === 'up' ? '升高' : '降低'} ${Math.abs(stat.deltaPct ?? 0).toFixed(1)}%`).join('、');
    suggestions.push(`持续观察${topText}:当前 ${abnormal[0].meta.label} ${formatChannelValue(abnormal[0], abnormal[0].current)},较事件起点参考变化明显,请结合当前工况判断是否继续发展。`);
    suggestions.push(`按当前等级 L${event.currentLevel}(${BACKEND_LEVEL_META[safeLevel(event.currentLevel)].label}),现场应:${BACKEND_LEVEL_META[safeLevel(event.currentLevel)].action};若参数继续恶化,系统会自动升级等级并再次提醒。`);
  } else {
    suggestions.push('各参数较事件起点参考变化不大,继续保持观察,重点关注监测页实时曲线走向。');
    suggestions.push(`当前等级 L${event.currentLevel},现场应:${BACKEND_LEVEL_META[safeLevel(event.currentLevel)].action}。`);
  }
  const checks: string[] = [];
  if (abnormal.some((stat) => stat.meta.key === 'outletFlow')) checks.push('复核后端出口流量证据及其质量状态，确认该证据在当前工况下可解释。');
  if (abnormal.some((stat) => stat.meta.key === 'pitVolume')) checks.push('核对活动池液位与补充量、转浆记录,确认池体积增量真实。');
  if (abnormal.some((stat) => stat.meta.family === 'pressure')) checks.push('核对泵冲、排量与立压/套压表读数,排除设备操作造成的压力变化。');
  if (chain.length >= 2 && chain[chain.length - 1].level > chain[0].level) checks.push('事件等级已升级,建议通知值班干部并做好关井准备。');
  if (!checks.length) checks.push('核对传感器读数与采集链路,排除测量跳变或断线造成的假异常。');
  suggestions.push(...checks.slice(0, 2));
  return suggestions.slice(0, 4);
}

function buildFieldChecks(stats: ChannelStat[]) {
  const abnormal = stats.filter((stat) => stat.deviation !== 'none');
  const checks = new Set<string>([
    '确认当前是否在开泵、停泵、接单根、起下钻或关井,排除正常作业引起的参数变化。',
    '核对传感器是否跳变、断线或量程异常,并与现场机械表/池液位记录交叉确认。',
  ]);
  if (abnormal.some((stat) => stat.meta.key === 'outletFlow')) checks.add('复核后端出口流量证据及其质量状态，确认该证据在当前工况下可解释。');
  if (abnormal.some((stat) => stat.meta.key === 'pitVolume')) checks.add('核对活动池液位、补充量和转浆记录,确认池增量是否真实。');
  if (abnormal.some((stat) => stat.meta.family === 'pressure')) checks.add('核对泵冲、排量、节流状态和立压/套压表,排除设备操作造成的压力变化。');
  return [...checks];
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 px-3 py-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <div className="text-[11px] ops-muted">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={value}>{value}</div>
      </div>
    </div>
  );
}

function SuggestionList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-semibold text-white">{index + 1}</span>
          <span className={compact ? 'line-clamp-2' : ''}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default function EventDetail() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<WarningEventReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('overview');
  const [ackComment, setAckComment] = useState('');
  const [ackBusy, setAckBusy] = useState(false);
  const [ackError, setAckError] = useState('');
  const [syncedAt, setSyncedAt] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!eventId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetchWarningEventDetail(eventId, controller.signal);
      if (controller.signal.aborted) return;
      setDetail(next);
      setError('');
      setSyncedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : '事件详情加载失败');
    } finally {
      if (!(controller.signal.aborted && mode === 'initial')) {
        if (mode === 'initial') setLoading(false);
        else setRefreshing(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    setDetail(null);
    setTab('overview');
    setAckError('');
    void load('initial');
    return () => requestRef.current?.abort();
  }, [load]);

  const event = detail?.event ?? null;
  const ended = event ? isEnded(event) : false;

  useEffect(() => {
    if (!eventId || ended) return undefined;
    const timer = window.setInterval(() => void load('refresh'), 20_000);
    return () => window.clearInterval(timer);
  }, [eventId, ended, load]);

  const stats = useMemo(() => buildChannelStats(detail?.trend, detail?.latestFrame ?? null), [detail?.latestFrame, detail?.trend]);
  const families = useMemo(() => buildEvidenceFamilies(stats, detail?.latestFrame ?? null), [detail?.latestFrame, stats]);
  const abnormalStats = useMemo(
    () => stats.filter((stat) => stat.deviation !== 'none').sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0)),
    [stats],
  );
  const chainNodes = useMemo(() => (detail ? buildEvolutionChain(detail) : []), [detail]);
  const suggestions = useMemo(
    () => (event ? buildSuggestions(event, stats, chainNodes) : []),
    [chainNodes, event, stats],
  );
  const fieldChecks = useMemo(() => buildFieldChecks(stats), [stats]);

  const acknowledge = async () => {
    if (!event || event.warningId <= 0) return;
    setAckBusy(true);
    setAckError('');
    try {
      await acknowledgeWarningEvent(event.warningId, ackComment);
      setAckComment('');
      await load('refresh');
    } catch (ackFailure) {
      setAckError(ackFailure instanceof Error ? ackFailure.message : '确认失败');
    } finally {
      setAckBusy(false);
    }
  };

  const exportEvent = () => {
    if (!detail) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      event: detail.event,
      latestFrame: detail.latestFrame,
      lifecycle: detail.lifecycle,
      acknowledgements: detail.acknowledgements,
      channelStatistics: stats.map((stat) => ({
        channel: stat.meta.label,
        unit: stat.meta.unit,
        onsetReference: stat.baseline,
        latest: stat.current,
        changePercent: stat.deltaPct,
        deviation: DEVIATION_LABEL[stat.deviation],
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `event_${detail.event.warningCode || detail.event.eventId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-empty-state min-h-[320px]">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-cyan-600" />
          <div className="text-sm ops-muted">正在读取事件详情…</div>
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="ops-page space-y-3">
        <button type="button" className="ops-button-secondary w-fit px-3 py-1.5 text-xs" onClick={() => navigate('/alerts')}>
          <ArrowLeft className="h-3.5 w-3.5" />返回列表
        </button>
        <div className="ops-empty-state min-h-[280px]">
          <FileWarning className="mx-auto mb-2 h-6 w-6 text-amber-500" />
          <div className="text-sm text-slate-700 dark:text-slate-200">事件详情加载失败</div>
          <div className="mt-1 text-xs ops-muted">{error}</div>
          <button type="button" className="ops-button-primary mt-3 px-3 py-1.5 text-xs" onClick={() => void load('initial')}>
            <RefreshCw className="h-3.5 w-3.5" />重试
          </button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="ops-page space-y-3">
        <button type="button" className="ops-button-secondary w-fit px-3 py-1.5 text-xs" onClick={() => navigate('/alerts')}>
          <ArrowLeft className="h-3.5 w-3.5" />返回列表
        </button>
        <div className="ops-empty-state min-h-[280px]">
          <FileWarning className="mx-auto mb-2 h-6 w-6 text-slate-400" />
          <div className="text-sm text-slate-700 dark:text-slate-200">事件不存在或已被清理</div>
          <div className="mt-1 text-xs ops-muted">事件编号 {eventId}</div>
        </div>
      </div>
    );
  }

  // The header shows the review level (peak reached), matching the alarm
  // list; the live/current level stays visible as its own chip.
  const displayLevel = safeLevel(Math.max(event.currentLevel, event.highestLevel));
  const visual = LEVEL_VISUAL[displayLevel];
  const LevelIcon = visual.icon;
  const statusBadge = statusBadgeInfo(event);
  const presentation = operatorEventPresentation({
    ...event,
    physicalDescription: detail?.latestFrame?.physicalDescription || event.physicalDescription,
  }, displayLevel);
  const canAcknowledge = !event.isAcknowledged && event.warningId > 0;
  const latestRemark = detail?.acknowledgements?.length
    ? detail.acknowledgements[detail.acknowledgements.length - 1]
    : null;
  const wellLabel = event.wellName || String(event.wellId || '') || '—';
  const frame = detail?.latestFrame ?? null;
  const descriptionText = cleanTechnicalText(frame?.physicalDescription || event.physicalDescription)
    || presentation.description;
  const reasonText = cleanTechnicalText(frame?.reason || event.reason);

  return (
    <div className="ops-page space-y-3">
      {/* Back bar */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="ops-button-secondary px-3 py-1.5 text-xs" onClick={() => navigate('/alerts')} aria-label="返回报警事件列表">
          <ArrowLeft className="h-3.5 w-3.5" />返回列表
        </button>
        <div className="flex items-center gap-2 text-xs ops-muted">
          {syncedAt && <span>最近同步 {syncedAt}</span>}
          <button type="button" className="ops-button-secondary px-2.5 py-1.5 text-xs" onClick={() => void load('refresh')} disabled={refreshing} aria-label="刷新事件详情">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
      </div>

      {/* Header */}
      <section className={`ops-surface border-l-4 p-4 ${displayLevel >= 4 ? 'border-l-red-600' : displayLevel >= 3 ? 'border-l-orange-500' : 'border-l-amber-500'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {wellLabel} · L{displayLevel} 事件详情
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{presentation.title}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-bold ${visual.badge}`}>
              <LevelIcon className="h-4 w-4" />L{displayLevel}
            </span>
            <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold ${statusBadge.className}`}>{statusBadge.text}</span>
            {event.currentLevel < displayLevel && (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">当前 L{event.currentLevel}</span>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 divide-slate-100 border-t border-slate-100 pt-1 text-sm dark:divide-slate-800 dark:border-slate-800 sm:grid-cols-3 xl:grid-cols-6">
          <InfoTile icon={Hash} label="井号" value={wellLabel} />
          <InfoTile icon={FileWarning} label="事件ID" value={event.warningCode || event.eventId} />
          <InfoTile icon={Clock3} label="首次识别时间" value={formatSourceDateTime(event.startTime) || event.startTime || '—'} />
          <InfoTile icon={Activity} label="当前状态" value={lifecycleLabel(event)} />
          <InfoTile icon={ScrollText} label="持续时长" value={formatDuration(event.startTime, event.endTime)} />
          <InfoTile icon={ClipboardCheck} label="分析样本" value={`${event.sampleCount} 点`} />
        </div>
      </section>

      {/* Body grid */}
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {/* Tabs */}
          <div className="ops-surface overflow-hidden">
            <div className="flex gap-0.5 overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-800" role="tablist" aria-label="事件详情分区">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  data-active={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${tab === item.id
                    ? 'border-cyan-600 text-cyan-700 dark:border-cyan-400 dark:text-cyan-300'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* ---------------- Overview tab ---------------- */}
            {tab === 'overview' && (
              <div className="space-y-4 p-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><ScrollText className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />事件概述</h3>
                    <span className="text-xs ops-muted">更新时间 {formatSourceDateTime(event.updatedAt) || event.updatedAt || '—'}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{descriptionText}</p>
                  {reasonText && <p className="mt-1.5 text-xs leading-5 ops-muted">判定依据:{reasonText}</p>}
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">当前状态:{plainEventState(event.candidateState || event.status)}。</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {stats.map((stat) => (
                      <div key={stat.meta.key} className="ops-panel-soft border p-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[11px] ops-muted" title={stat.meta.label}>{stat.meta.label}</span>
                          <span className="text-[10px] ops-muted">{stat.meta.unit}</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stat.current != null ? stat.current.toFixed(stat.meta.precision) : '—'}</span>
                          <DeltaBadge stat={stat} />
                        </div>
                        <div className="mt-0.5 text-[10px] ops-muted">事件起点 {formatChannelValue(stat, stat.baseline)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><LineChartIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />证据链概览<span className="text-xs font-normal ops-muted">当前 vs 事件起点</span></h3>
                  {stats.length ? (
                    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {stats.map((stat) => <EvidenceCard key={stat.meta.key} stat={stat} />)}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-sm ops-muted dark:border-slate-700">该事件未保存事件窗口内的趋势数据,请到监测页按事件时间复核实时曲线。</div>
                  )}
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Gauge className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />关键参数异常<span className="text-xs font-normal ops-muted">当前 vs 事件起点</span></h3>
                  <div className="ops-scroll mt-2 overflow-x-auto">
                    <table className="ops-table w-full min-w-[560px]" aria-label="关键参数异常对比">
                      <thead>
                        <tr>
                          <th className="text-left">参数</th>
                          <th className="text-right">事件起点</th>
                          <th className="text-right">当前值</th>
                          <th className="text-right">变化</th>
                          <th className="text-center">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((stat) => {
                          const badge = familyBadge(stat.deviation);
                          return (
                            <tr key={stat.meta.key}>
                              <td className="whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{stat.meta.label}</td>
                              <td className="text-right tabular-nums text-sm ops-muted">{formatChannelValue(stat, stat.baseline)}</td>
                              <td className="text-right tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">{formatChannelValue(stat, stat.current)}</td>
                              <td className="text-right"><DeltaBadge stat={stat} /></td>
                              <td className="text-center">
                                <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>{DEVIATION_LABEL[stat.deviation]}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1.5 text-[11px] ops-muted">事件起点取事件窗口前段测点的中位数,仅代表事件内变化参考,不等于长期工艺基线。</p>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />事件演化链路</h3>
                  <div className="mt-2"><EvolutionChain nodes={chainNodes} /></div>
                </div>

                {detail?.lifecycle?.length ? (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Clock3 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />事件时间线</h3>
                    <div className="ops-scroll mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {[...detail.lifecycle].reverse().map((item, index) => {
                        const itemVisual = LEVEL_VISUAL[safeLevel(item.publicLevel)];
                        return (
                          <div key={`${item.sampleTime}-${item.revisionSequence}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950">
                            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${itemVisual.dot}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                                {plainLifecycleEvent(item.eventName)}
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${itemVisual.badge}`}>L{item.publicLevel}</span>
                                <span className="text-xs ops-muted">{formatSourceDateTime(item.sampleTime) || item.sampleTime}</span>
                              </div>
                              {cleanTechnicalText(item.reason) && <div className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{cleanTechnicalText(item.reason)}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ---------------- Evidence tab ---------------- */}
            {tab === 'evidence' && (
              <div className="space-y-4 p-4">
                {families.length ? families.map((family) => <EvidenceFamilyBlock key={family.id} family={family} />) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm ops-muted dark:border-slate-700">该事件未保存可用于证据分析的趋势数据。</div>
                )}
                <Panel title="支持信号清单" icon={ScrollText}>
                  {(() => {
                    const signals = frame?.activeSignals
                      ? frame.activeSignals.split(/[,、;；]/g).map((item) => item.trim()).filter(Boolean)
                      : event.activeSignals || [];
                    return signals.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {signals.map((signal, index) => <span key={`${signal}-${index}`} className="ops-inline-tile px-2 py-1 text-xs">{backendSignalLabel(signal)}</span>)}
                      </div>
                    ) : <div className="text-sm ops-muted">该事件未保存激活信号。</div>;
                  })()}
                </Panel>
              </div>
            )}

            {/* ---------------- Parameters tab ---------------- */}
            {tab === 'parameters' && (
              <div className="space-y-4 p-4">
                {stats.filter((stat) => stat.series.length > 0).length ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {stats.filter((stat) => stat.series.length > 0).map((stat) => (
                      <div key={stat.meta.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: stat.meta.color }} />
                            {stat.meta.label}
                            <span className="text-xs font-normal ops-muted">{stat.meta.unit}</span>
                          </div>
                          <DeltaBadge stat={stat} />
                        </div>
                        <div className="mt-2">
                          <ChannelTrendChart stat={stat} height={200} />
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                          <div><div className="text-[10px] ops-muted">事件起点</div><div className="text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">{stat.baseline != null ? stat.baseline.toFixed(stat.meta.precision) : '—'}</div></div>
                          <div><div className="text-[10px] ops-muted">当前</div><div className="text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">{stat.current != null ? stat.current.toFixed(stat.meta.precision) : '—'}</div></div>
                          <div><div className="text-[10px] ops-muted">窗口最低</div><div className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{stat.min != null ? stat.min.toFixed(stat.meta.precision) : '—'}</div></div>
                          <div><div className="text-[10px] ops-muted">窗口最高</div><div className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{stat.max != null ? stat.max.toFixed(stat.meta.precision) : '—'}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm ops-muted dark:border-slate-700">该事件未保存逐点趋势数据,请结合监测页历史曲线复核。</div>
                )}
              </div>
            )}

            {/* ---------------- Action tab ---------------- */}
            {tab === 'action' && (
              <div className="space-y-4 p-4">
                <Panel title="系统研判与建议" icon={ClipboardCheck}>
                  <SuggestionList items={suggestions} />
                </Panel>
                <Panel title="现场建议核对" icon={Check} subtitle="结合工况逐项确认">
                  <ol className="space-y-2">
                    {fieldChecks.map((item, index) => (
                      <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">{index + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
                <Panel title="确认审计" icon={ScrollText} subtitle="记录由后端保存">
                  {detail?.acknowledgements?.length ? (
                    <div className="space-y-2">
                      {detail.acknowledgements.map((item) => (
                        <div key={item.acknowledgementId} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
                          <div className="flex flex-wrap items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                            {item.user || '未知用户'}
                            <span className="ops-inline-tile px-1.5 py-0.5 text-[11px]">{item.action}</span>
                            <span className="text-xs ops-muted">{formatSourceDateTime(item.acknowledgedAt) || item.acknowledgedAt}</span>
                          </div>
                          {item.comment && <div className="mt-1 text-slate-600 dark:text-slate-300">备注:{item.comment}</div>}
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm ops-muted">暂无确认记录。</div>}
                </Panel>
                <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs ops-muted dark:border-slate-800 dark:bg-slate-900">
                  <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">技术追溯信息</summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="ops-inline-tile px-3 py-2"><div className="text-[11px]">事件编号</div><div className="mt-1 break-words text-slate-800 dark:text-slate-100">{event.eventId || '—'}</div></div>
                    <div className="ops-inline-tile px-3 py-2"><div className="text-[11px]">会话编号</div><div className="mt-1 break-words text-slate-800 dark:text-slate-100">{event.sessionCode || '—'}</div></div>
                    <div className="ops-inline-tile px-3 py-2"><div className="text-[11px]">后端帧号</div><div className="mt-1 break-words text-slate-800 dark:text-slate-100">{frame ? String(frame.frameId) : '—'}</div></div>
                    <div className="ops-inline-tile px-3 py-2"><div className="text-[11px]">原始状态</div><div className="mt-1 break-words text-slate-800 dark:text-slate-100">{frame?.eventState || event.candidateState || event.status || '—'}</div></div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* ---------------- Right sidebar ---------------- */}
        <aside className="min-w-0 space-y-3">
          {canAcknowledge && (
            <section className="ops-surface p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><ClipboardCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />处置确认</h3>
              <p className="mt-1.5 text-xs leading-5 ops-muted">确认会写入后端审计表,表示现场已复核该事件。</p>
              {ackError && <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">{ackError}</div>}
              <textarea
                value={ackComment}
                onChange={(change) => setAckComment(change.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="处置备注(可选,写入确认审计)"
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
              />
              <button type="button" className="ops-button-primary mt-2 w-full justify-center" onClick={() => void acknowledge()} disabled={ackBusy}>
                {ackBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                确认并记录
              </button>
            </section>
          )}

          <section className="ops-surface p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><ClipboardCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />研判与建议</h3>
            <div className="mt-2.5"><SuggestionList items={suggestions.slice(0, 3)} compact /></div>
          </section>

          <section className="ops-surface p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />证据可信度</h3>
            <div className="mt-3 space-y-2.5">
              {abnormalStats.length ? abnormalStats.map((stat) => (
                <TrustBar key={stat.meta.key} label={stat.meta.label} value={stat.strengthPct} color={stat.meta.color} />
              )) : stats.slice(0, 4).map((stat) => (
                <TrustBar key={stat.meta.key} label={stat.meta.label} value={stat.strengthPct} color={stat.meta.color} />
              ))}
              {!stats.length && <div className="text-xs ops-muted">无可评估的趋势数据。</div>}
            </div>
          </section>

          <section className="ops-surface p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><ChevronRight className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />快速操作</h3>
            <div className="mt-2.5 space-y-2">
              <button type="button" className="ops-button-secondary w-full justify-between px-3 py-2.5 text-sm" onClick={() => navigate('/monitoring')}>
                <span className="flex items-center gap-2"><LineChartIcon className="h-4 w-4" />查看实时曲线</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" className="ops-button-secondary w-full justify-between px-3 py-2.5 text-sm" onClick={exportEvent} disabled={!detail}>
                <span className="flex items-center gap-2"><Download className="h-4 w-4" />导出事件记录</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="ops-surface p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><ScrollText className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />备注</h3>
            {latestRemark ? (
              <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {latestRemark.comment || '未填写备注。'}
                <div className="mt-1 text-xs ops-muted">{latestRemark.user || '未知用户'} · {formatSourceDateTime(latestRemark.acknowledgedAt) || latestRemark.acknowledgedAt}</div>
              </div>
            ) : <div className="mt-2 text-sm ops-muted">暂无备注信息。</div>}
          </section>
        </aside>
      </div>

      {error && detail && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-lg dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100" role="status">
          自动同步失败:{error}
          <button type="button" className="ml-2 underline" onClick={() => void load('refresh')}>立即重试</button>
          <button type="button" className="ml-1.5" onClick={() => setError('')} aria-label="关闭提示"><X className="inline h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

function EvidenceFamilyBlock({ family }: { family: EvidenceFamily }) {
  const Icon = FAMILY_ICONS[family.id];
  const badge = familyBadge(family.deviation);
  return (
    <Panel title={`${family.title}链路`} icon={Icon} subtitle="当前 vs 事件起点" actions={<span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span>}>
      <div className="grid gap-3 lg:grid-cols-2">
        {family.channels.map((stat) => (
          <div key={stat.meta.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: stat.meta.color }} />
                {stat.meta.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stat.current != null ? stat.current.toFixed(stat.meta.precision) : '—'}</span>
                <span className="text-[11px] ops-muted">{stat.meta.unit}</span>
                <DeltaBadge stat={stat} />
              </div>
            </div>
            <div className="mt-2"><ChannelTrendChart stat={stat} height={170} /></div>
            <div className="mt-1 text-[11px] ops-muted">证据强度:{DEVIATION_LABEL[stat.deviation]} · 事件起点 {formatChannelValue(stat, stat.baseline)}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
