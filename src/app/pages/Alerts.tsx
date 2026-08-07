import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { OpsProcedureRail } from '../components/OpsProcedureRail';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';
import {
  acknowledgeWarningEvent,
  acknowledgeWarningEvents,
  fetchWarningEventDetail,
  fetchWarningEvents,
  type WarningEventReviewDetail,
  type WarningEventReviewItem,
  type WarningEventLatestFrame,
  type WarningEventReviewPage,
  type WarningEventReviewSummary,
} from '../api/warningsApi';

type LevelFilter = 'all' | '2' | '3' | '4';
type AcknowledgementFilter = 'all' | 'unacknowledged' | 'acknowledged';
type LifecycleFilter = 'all' | 'active' | 'ended';

const EMPTY_SUMMARY: WarningEventReviewSummary = {
  ok: true,
  total: 0,
  active: 0,
  ended: 0,
  acknowledged: 0,
  unacknowledged: 0,
  l2: 0,
  l3: 0,
  l4: 0,
};

const LEVEL_VISUAL: Record<2 | 3 | 4, { tone: string; badge: string; icon: ElementType }> = {
  2: {
    tone: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100',
    icon: AlertTriangle,
  },
  3: {
    tone: 'border-orange-200 bg-orange-50/80 dark:border-orange-900/70 dark:bg-orange-950/20',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100',
    icon: Siren,
  },
  4: {
    tone: 'border-red-200 bg-red-50/80 dark:border-red-900/70 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-100',
    icon: ShieldAlert,
  },
};

function safeLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

function visualLevel(value: unknown): 2 | 3 | 4 {
  const level = safeLevel(value);
  return level >= 4 ? 4 : level >= 3 ? 3 : 2;
}

function eventLevel(event: WarningEventReviewItem) {
  return Math.max(safeLevel(event.currentLevel), safeLevel(event.highestLevel)) as BackendLevel;
}

function lifecycleKey(event: WarningEventReviewItem) {
  return (event.candidateState || event.status || '').trim().toLowerCase();
}

function isEnded(event: WarningEventReviewItem) {
  const state = lifecycleKey(event);
  return event.status.toLowerCase() === 'ended' || state === 'ended' || state === 'resolved' || state === 'closed';
}

function lifecycleLabel(event: WarningEventReviewItem) {
  if (event.isAcknowledged) return '已确认';
  if (isEnded(event)) return '已结束';
  const state = lifecycleKey(event);
  if (state === 'tracking') return '持续跟踪';
  if (state === 'observing') return '异常观察';
  if (state === 'recovering') return '恢复观察';
  if (state === 'confirmed') return '风险确认';
  return event.status === 'active' ? '活动事件' : event.status || '待确认';
}

function formatDuration(start: string, end: string) {
  if (!start || !end) return '持续中';
  const milliseconds = new Date(end.replace(' ', 'T')).getTime() - new Date(start.replace(' ', 'T')).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function readableValue(value: number | null | undefined, unit = '') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
}

function cleanTechnicalText(value?: string | null) {
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

function plainEventState(value?: string | null) {
  const state = String(value || '').trim().toLowerCase();
  if (['active', 'tracking', 'observing', 'suspected'].includes(state)) return '异常仍在持续，需继续观察';
  if (['confirmed'].includes(state)) return '异常已确认';
  if (['recovering'].includes(state)) return '参数正在恢复，暂不能解除观察';
  if (['closed', 'resolved', 'ended'].includes(state)) return '事件已结束';
  return '等待更多现场数据';
}

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

function currentParameterValue(parameter: string, frame?: WarningEventLatestFrame | null) {
  if (!frame) return '当前值未保存';
  if (parameter === '入口流量') return readableValue(frame.inletFlow, 'L/s');
  if (parameter === '出口流量') return readableValue(frame.outletFlow, 'L/s');
  if (parameter === '总池体积') return readableValue(frame.pitVolume, 'm³');
  if (parameter === '立管压力') return readableValue(frame.standpipePressure, 'MPa');
  if (parameter === '套管压力') return readableValue(frame.casingPressure, 'MPa');
  return '当前值未保存';
}

function parameterMeaning(parameter: string, direction: string) {
  if (parameter === '出口流量' && direction === 'up') return '返出量增大，需核对是否超过入口排量及正常波动范围。';
  if (parameter === '总池体积' && direction === 'up') return '池体积持续增加，是判断井筒流体增加的重要现场信号。';
  if (parameter === '立管压力' && direction === 'down') return '立压下降可能与井筒流体性质或循环状态变化有关，需结合泵冲和排量复核。';
  if (parameter === '套管压力' && direction === 'up') return '套压上升需关注井口压力变化，并核对是否处于关井或憋压工况。';
  if (parameter === '气测' && direction === 'up') return '气测升高说明返出流体含气增加，需结合迟到时间和钻遇层位判断。';
  if (parameter === '钻速' && direction === 'up') return '钻速突然加快可能提示地层变化，应结合岩性和其他参数判断。';
  return '该参数偏离近期正常状态，需要结合工况和相邻参数继续核对。';
}

function abnormalParameters(signals: string[], frame?: WarningEventLatestFrame | null) {
  const byParameter = new Map<string, { parameter: string; direction: string; source: string }>();
  signals.forEach((signal) => {
    if (/unknownproxy|outlet_semantic/i.test(signal)) return;
    const direction = signalDirection(signal);
    signalParameters(signal).forEach((parameter) => {
      const previous = byParameter.get(parameter);
      if (!previous || previous.direction === 'watch') byParameter.set(parameter, { parameter, direction, source: signal });
    });
  });
  if (frame?.inletFlow != null && frame?.outletFlow != null) {
    const difference = frame.outletFlow - frame.inletFlow;
    if (Math.abs(difference) >= 0.01 && !byParameter.has('出口流量')) {
      byParameter.set('出口流量', {
        parameter: '出口流量',
        direction: difference > 0 ? 'up' : 'down',
        source: 'inlet_outlet_difference',
      });
    }
  }
  return [...byParameter.values()];
}

function fieldSignalLabels(signals: string[]) {
  return abnormalParameters(signals).map((item) => (
    `${item.parameter}${item.direction === 'up' ? '升高' : item.direction === 'down' ? '降低' : '出现异常趋势'}`
  ));
}

function fieldConclusion(event: WarningEventReviewItem, signals: string[], frame?: WarningEventLatestFrame | null) {
  const parameters = abnormalParameters(signals, frame);
  if (!parameters.length) {
    return event.currentLevel >= 2
      ? '系统发现参数组合偏离近期正常状态，但现有数据还不足以指出单一主导参数。请核对流量、池体积、压力和当前作业工况。'
      : '当前未发现需要现场处置的持续异常。';
  }
  const names = parameters.map((item) => {
    if (item.direction === 'up') return `${item.parameter}升高`;
    if (item.direction === 'down') return `${item.parameter}降低`;
    return `${item.parameter}异常`;
  });
  return `系统同时发现${names.join('、')}。这些变化已达到 L${event.currentLevel} 观察条件，建议先核对仪表和作业工况，再判断是否存在溢流趋势。`;
}

function operatorChecks(parameters: ReturnType<typeof abnormalParameters>) {
  const checks = new Set<string>([
    '确认当前是否在开泵、停泵、接单根、起下钻或关井，排除正常作业引起的参数变化。',
    '核对传感器是否跳变、断线或量程异常，并与现场机械表/池液位记录交叉确认。',
  ]);
  if (parameters.some((item) => item.parameter === '出口流量')) checks.add('对比入口排量与出口流量，确认差值是否连续扩大。');
  if (parameters.some((item) => item.parameter === '总池体积')) checks.add('核对活动池液位、补充量和转浆记录，确认池增量是否真实。');
  if (parameters.some((item) => item.parameter.includes('压力'))) checks.add('核对泵冲、排量、节流状态和立压/套压表，排除设备操作造成的压力变化。');
  if (parameters.some((item) => item.parameter === '气测')) checks.add('结合迟到时间、背景气和接单根气，确认气测升高是否与当前井深对应。');
  return [...checks];
}

function filteredEvents(
  events: WarningEventReviewItem[],
  levelFilter: LevelFilter,
  acknowledgementFilter: AcknowledgementFilter,
  lifecycleFilter: LifecycleFilter,
) {
  return events
    .filter((event) => {
      if (levelFilter !== 'all' && eventLevel(event) !== Number(levelFilter)) return false;
      if (acknowledgementFilter === 'unacknowledged' && event.isAcknowledged) return false;
      if (acknowledgementFilter === 'acknowledged' && !event.isAcknowledged) return false;
      if (lifecycleFilter === 'active' && isEnded(event)) return false;
      if (lifecycleFilter === 'ended' && !isEnded(event)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isAcknowledged !== b.isAcknowledged) return a.isAcknowledged ? 1 : -1;
      if (eventLevel(a) !== eventLevel(b)) return eventLevel(b) - eventLevel(a);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

function CounterCard({ level, value }: { level: 2 | 3 | 4; value: number }) {
  const visual = LEVEL_VISUAL[level];
  const Icon = visual.icon;
  return (
    <div className={`ops-panel-soft flex min-w-0 items-center gap-3 border p-3 ${visual.tone}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${visual.badge}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
        <div className="truncate text-xs ops-muted">L{level} {BACKEND_LEVEL_META[level].shortLabel} · 事件数</div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="ops-inline-tile min-w-[108px] px-3 py-2">
      <div className="text-[11px] ops-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

export default function Alerts() {
  const { backendDetection, wellInfo, selectedWellId, wells } = useWellControl();
  const currentWellId = selectedWellId || wellInfo.wellId;
  const activeWell = wells.find((well) => well.wellId === currentWellId) || wellInfo;
  const [page, setPage] = useState<WarningEventReviewPage | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [acknowledgementFilter, setAcknowledgementFilter] = useState<AcknowledgementFilter>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WarningEventReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [ackComment, setAckComment] = useState('');

  const loadEvents = useCallback(async (signal?: AbortSignal) => {
    const firstLoad = page === null;
    if (firstLoad) setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetchWarningEvents({
        wellId: currentWellId || undefined,
        includeAcknowledged: true,
        page: 1,
        pageSize: 100,
      }, signal);
      setPage(next);
      setError('');
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : '报警事件加载失败');
    } finally {
      if (firstLoad) setLoading(false);
      else setRefreshing(false);
    }
  }, [currentWellId, page]);

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    void loadEvents(controller.signal);
    const timer = window.setInterval(() => void loadEvents(), 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [currentWellId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedEventId) {
      setDetail(null);
      setDetailError('');
      return undefined;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError('');
    void fetchWarningEventDetail(selectedEventId, controller.signal)
      .then(setDetail)
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setDetailError(loadError instanceof Error ? loadError.message : '事件详情加载失败');
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [selectedEventId]);

  const summary = page?.summary || EMPTY_SUMMARY;
  const events = useMemo(
    () => filteredEvents(page?.events || [], levelFilter, acknowledgementFilter, lifecycleFilter),
    [acknowledgementFilter, levelFilter, lifecycleFilter, page?.events],
  );
  const eligibleForBulkAcknowledgement = events.filter((event) => !event.isAcknowledged && event.warningId > 0);
  const currentLevel = safeLevel(backendDetection.publicLevel);
  const hasFilters = levelFilter !== 'all' || acknowledgementFilter !== 'all' || lifecycleFilter !== 'all';

  const acknowledgeOne = async (event: WarningEventReviewItem, comment = '') => {
    if (event.warningId <= 0) {
      setError('该条记录是算法候选，后端尚未生成可确认的 warning_id，不能写入确认记录。');
      return;
    }
    setBusyAction(`ack:${event.eventId}`);
    try {
      await acknowledgeWarningEvent(event.warningId, comment);
      setAckComment('');
      setSelectedEventId(null);
      await loadEvents();
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : '报警确认失败');
    } finally {
      setBusyAction(null);
    }
  };

  const acknowledgeVisible = async () => {
    if (eligibleForBulkAcknowledgement.length === 0) return;
    setBusyAction('ack-all');
    try {
      await acknowledgeWarningEvents({
        wellId: currentWellId || undefined,
        level: levelFilter === 'all' ? undefined : Number(levelFilter),
        status: lifecycleFilter === 'all' ? undefined : lifecycleFilter,
        maxCount: 500,
      }, ackComment);
      setAckComment('');
      await loadEvents();
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : '批量确认失败');
    } finally {
      setBusyAction(null);
    }
  };

  const queueSteps = [
    {
      code: 'L2',
      label: '预警复核',
      value: summary.l2 ? `${summary.l2} 条事件` : '无事件',
      state: summary.l2 ? 'warning' as const : 'done' as const,
      icon: AlertTriangle,
    },
    {
      code: 'L3',
      label: '处置准备',
      value: summary.l3 ? `${summary.l3} 条事件` : '无高等级预警',
      state: summary.l3 ? 'active' as const : 'done' as const,
      icon: Siren,
    },
    {
      code: 'L4',
      label: '确认处置',
      value: summary.l4 ? `${summary.l4} 条严重事件` : '无严重事件',
      state: summary.l4 ? 'critical' as const : 'done' as const,
      icon: ShieldAlert,
    },
    {
      code: 'ACK',
      label: '确认闭环',
      value: summary.unacknowledged ? `${summary.unacknowledged} 条未确认` : '队列清空',
      state: summary.unacknowledged ? 'active' as const : 'done' as const,
      icon: CheckCheck,
    },
  ];

  return (
    <div className="ops-page space-y-4">
      <MonitoringWellTabs />

      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">报警管理 · 后端事件投影</div>
          <h1 className="ops-title">报警事件复核</h1>
          <p className="text-sm ops-muted">
            {activeWell.wellName || currentWellId || '当前井'} · 算法当前 L{currentLevel} {BACKEND_LEVEL_META[currentLevel].label} · 后端持久化事件 {summary.total} 条
          </p>
        </div>
        <div className="ops-page-toolbar">
          <div className="ops-inline-tile hidden items-center gap-2 px-3 py-2 text-xs md:flex">
            <span className={`h-2 w-2 rounded-full ${currentLevel >= 4 ? 'bg-red-500' : currentLevel >= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            实时算法 L{currentLevel}
          </div>
          <button type="button" className="ops-button-secondary" onClick={() => void loadEvents()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
          {eligibleForBulkAcknowledgement.length > 0 && (
            <button type="button" className="ops-button-primary" onClick={() => void acknowledgeVisible()} disabled={busyAction !== null}>
              <CheckCheck className="h-4 w-4" />
              确认当前 {eligibleForBulkAcknowledgement.length} 条
            </button>
          )}
        </div>
      </div>

      <div className="ops-panel-soft flex flex-col gap-3 border border-cyan-200 bg-cyan-50/60 p-3 text-sm dark:border-cyan-900/60 dark:bg-cyan-950/20 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" />
          <div>
            <div className="font-semibold text-cyan-950 dark:text-cyan-100">现场先看：等级、状态、触发信号、算法原因</div>
            <div className="mt-0.5 text-xs text-cyan-900/75 dark:text-cyan-100/75">“确认”会写入后端确认审计表；算法候选没有 warning_id 时只展示，不允许伪确认。</div>
          </div>
        </div>
        <div className="text-xs text-cyan-900/75 dark:text-cyan-100/75">每 15 秒自动同步 · {page ? `最近同步 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}` : '正在连接后端'}</div>
      </div>

      <div className="ops-stat-grid">
        <CounterCard level={2} value={summary.l2} />
        <CounterCard level={3} value={summary.l3} />
        <CounterCard level={4} value={summary.l4} />
        <div className="ops-panel-soft flex min-w-0 items-center gap-3 border p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"><Check className="h-5 w-5" /></div>
          <div className="min-w-0"><div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{summary.acknowledged}</div><div className="truncate text-xs ops-muted">已确认 · 可追溯</div></div>
        </div>
      </div>

      <OpsProcedureRail steps={queueSteps} compact />

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100" role="alert">
          <span>{error}</span>
          <button type="button" className="shrink-0" onClick={() => setError('')} aria-label="关闭错误提示"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="ops-surface overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 ops-muted" />
            <div className="ops-segment" aria-label="报警等级筛选">
              {(['all', '2', '3', '4'] as LevelFilter[]).map((level) => (
                <button key={level} type="button" data-active={levelFilter === level} aria-pressed={levelFilter === level} onClick={() => setLevelFilter(level)}>
                  {level === 'all' ? '全部等级' : `L${level} ${BACKEND_LEVEL_META[Number(level) as 2 | 3 | 4].shortLabel}`}
                </button>
              ))}
            </div>
            <div className="ops-segment" aria-label="确认状态筛选">
              {(['all', 'unacknowledged', 'acknowledged'] as AcknowledgementFilter[]).map((status) => (
                <button key={status} type="button" data-active={acknowledgementFilter === status} aria-pressed={acknowledgementFilter === status} onClick={() => setAcknowledgementFilter(status)}>
                  {status === 'all' ? '全部状态' : status === 'unacknowledged' ? '未确认' : '已确认'}
                </button>
              ))}
            </div>
            <div className="ops-segment" aria-label="事件生命周期筛选">
              {(['all', 'active', 'ended'] as LifecycleFilter[]).map((status) => (
                <button key={status} type="button" data-active={lifecycleFilter === status} aria-pressed={lifecycleFilter === status} onClick={() => setLifecycleFilter(status)}>
                  {status === 'all' ? '全部事件' : status === 'active' ? '活动事件' : '已结束'}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs ops-muted">显示 {events.length} / {summary.total} 条</span>
          </div>
          {eligibleForBulkAcknowledgement.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={ackComment}
                onChange={(event) => setAckComment(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                placeholder="批量确认备注（可选，写入后端审计）"
                maxLength={1000}
              />
              <span className="text-xs ops-muted">确认范围按当前井、等级和生命周期筛选条件提交。</span>
            </div>
          )}
        </div>

        <div className="ops-surface-body ops-scroll max-h-[calc(100vh-390px)] overflow-y-auto">
          {loading ? (
            <div className="ops-empty-state m-3 min-h-[220px]"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-cyan-600" /><div className="text-sm ops-muted">正在读取后端报警事件…</div></div>
          ) : events.length === 0 ? (
            <div className="ops-empty-state m-3 min-h-[220px]">
              <Check className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
              <div className="text-sm text-slate-700 dark:text-slate-200">{summary.total === 0 ? '当前井暂无后端报警事件' : '当前筛选条件下暂无事件'}</div>
              <div className="mt-1 max-w-md text-center text-xs ops-muted">{summary.total === 0 ? '实时算法仍会在监测页展示当前证据；当事件投影写入后端后，会在此处出现并可复核。' : '可以清空筛选条件，或切换到“未确认”查看待处置队列。'}</div>
              {hasFilters && <button type="button" className="ops-button-secondary mt-3 px-3 py-1.5 text-xs" onClick={() => { setLevelFilter('all'); setAcknowledgementFilter('all'); setLifecycleFilter('all'); }}><Filter className="h-3.5 w-3.5" />清空筛选</button>}
            </div>
          ) : (
            events.map((event) => <AlertRow key={event.eventId} event={event} busy={busyAction === `ack:${event.eventId}`} onDetail={() => setSelectedEventId(event.eventId)} onAcknowledge={() => void acknowledgeOne(event)} />)
          )}
        </div>
      </div>

      {selectedEventId && (
        <ReviewDetailDrawer
          detail={detail}
          loading={detailLoading}
          error={detailError}
          comment={ackComment}
          onCommentChange={setAckComment}
          busy={busyAction === `ack:${selectedEventId}`}
          onClose={() => setSelectedEventId(null)}
          onAcknowledge={() => detail && void acknowledgeOne(detail.event, ackComment)}
        />
      )}
    </div>
  );
}

function AlertRow({ event, busy, onDetail, onAcknowledge }: { event: WarningEventReviewItem; busy: boolean; onDetail: () => void; onAcknowledge: () => void }) {
  const level = eventLevel(event);
  const visual = LEVEL_VISUAL[visualLevel(level)];
  const Icon = visual.icon;
  const canAcknowledge = event.warningId > 0 && !event.isAcknowledged;
  const visibleSignals = fieldSignalLabels(event.activeSignals);
  return (
    <article className={`relative border-b border-slate-200 border-l-4 px-4 py-4 last:border-b-0 dark:border-slate-800 ${event.isAcknowledged ? 'border-l-slate-300 bg-white/60 opacity-75 dark:border-l-slate-700 dark:bg-slate-950/40' : `${visual.tone} ${level >= 4 ? 'border-l-red-600' : level >= 3 ? 'border-l-orange-500' : 'border-l-amber-500'}`}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-1 text-xs font-semibold ${visual.badge}`}>L{level} {BACKEND_LEVEL_META[level].label}</span>
            {event.highestLevel > event.currentLevel && <span className="rounded bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800 dark:bg-red-500/15 dark:text-red-100">峰值 L{event.highestLevel}</span>}
            <span className="rounded bg-black/5 px-2 py-1 text-[11px] ops-muted dark:bg-white/10">{lifecycleLabel(event)}</span>
            {event.needsManualReview && <span className="rounded bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-100">需人工复核</span>}
            <span className="text-xs ops-muted">{event.startTime} · {formatDuration(event.startTime, event.endTime)}</span>
          </div>
          <div className="mt-2 text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">{cleanTechnicalText(event.reason) || `系统发现${visibleSignals.join('、') || '多项参数偏离近期正常状态'}，请打开详情核对具体变化。`}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ops-muted">
            <span>事件 {event.warningCode || event.eventId}</span>
            <span>Session {event.sessionCode || '—'}</span>
            <span>样本 {event.sampleCount}</span>
            {event.primarySignal && <span>主信号 {backendSignalLabel(event.primarySignal)}</span>}
            {event.isAcknowledged && <span>确认人 {event.acknowledgedBy || '—'} · {event.acknowledgedAt || '—'}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleSignals.length > 0 ? visibleSignals.map((signal) => <span key={signal} className="ops-inline-tile px-2 py-1 text-[11px]">{signal}</span>) : <span className="text-xs ops-muted">未记录可识别的异常参数</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="button" className="ops-button-secondary px-3 py-1.5 text-xs" onClick={onDetail}><Eye className="h-3.5 w-3.5" />详情</button>
          {canAcknowledge ? <button type="button" className="ops-button-primary px-3 py-1.5 text-xs" onClick={onAcknowledge} disabled={busy}><Check className="h-3.5 w-3.5" />{busy ? '提交中…' : '确认报警'}</button> : event.isAcknowledged ? <span className="ops-inline-tile px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-200"><Check className="h-3.5 w-3.5" />已留痕</span> : <span className="ops-inline-tile px-3 py-1.5 text-xs text-amber-800 dark:text-amber-100">候选待落库</span>}
        </div>
      </div>
    </article>
  );
}

function ReviewDetailDrawer({ detail, loading, error, comment, onCommentChange, busy, onClose, onAcknowledge }: { detail: WarningEventReviewDetail | null; loading: boolean; error: string; comment: string; onCommentChange: (value: string) => void; busy: boolean; onClose: () => void; onAcknowledge: () => void }) {
  const event = detail?.event;
  const frame = detail?.latestFrame;
  const level = event ? eventLevel(event) : 0;
  const signals = frame?.activeSignals ? frame.activeSignals.split(',').map((item) => item.trim()).filter(Boolean) : event?.activeSignals || [];
  const parameterChanges = abnormalParameters(signals, frame);
  const checks = operatorChecks(parameterChanges);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <aside className="h-full w-full max-w-[920px] overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-950" role="dialog" aria-modal="true" aria-labelledby="warning-review-detail-title" onClick={(click) => click.stopPropagation()}>
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0">
              <div className="ops-eyebrow">报警详情 · 现场复核</div>
              <h2 id="warning-review-detail-title" className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{event?.wellName || '报警事件'} · {event ? `${event.startTime || '时间未知'} 发现异常` : '加载中'}</h2>
              {event && <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className={`rounded px-2 py-1 font-semibold ${LEVEL_VISUAL[visualLevel(level)].badge}`}>L{level} {BACKEND_LEVEL_META[level].label}</span><span className="ops-inline-tile px-2 py-1">{lifecycleLabel(event)}</span><span className="ops-inline-tile px-2 py-1">持续 {formatDuration(event.startTime, event.endTime)}</span></div>}
            </div>
            <button type="button" className="ops-button-secondary px-2 py-1" onClick={onClose} aria-label="关闭事件详情"><X className="h-4 w-4" /></button>
          </header>

          <div className="ops-scroll flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
            {loading && <div className="ops-empty-state min-h-[180px]"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-cyan-600" /><div className="text-sm ops-muted">正在读取事件详情…</div></div>}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100">{error}</div>}
            {event && !loading && (
              <>
                <section className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-900 dark:text-cyan-100"><Eye className="h-4 w-4" />先看结论</div>
                  <p className="mt-2 text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">{fieldConclusion(event, signals, frame)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">当前状态：{plainEventState(event.candidateState || event.status)}。系统结论用于提示复核，是否处置应结合当前作业工况和现场核对结果。</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3"><SummaryMetric label="当前等级" value={event.currentLevel} /><SummaryMetric label="最高等级" value={event.highestLevel} /><SummaryMetric label="已分析样本" value={event.sampleCount} /></div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><Activity className="h-4 w-4 text-cyan-600" />异常参数怎么变了</h3><span className="text-xs ops-muted">采样时间 {frame?.sampleTime || event.updatedAt || '—'}</span></div>
                  {parameterChanges.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{parameterChanges.map((item) => <ParameterChange key={item.parameter} parameter={item.parameter} direction={item.direction} currentValue={currentParameterValue(item.parameter, frame)} meaning={parameterMeaning(item.parameter, item.direction)} />)}</div> : <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm ops-muted dark:border-slate-700">后端没有保存可识别的异常参数变化，请结合下方当前测点和历史曲线复核。</div>}
                  {frame?.inletFlow != null && frame?.outletFlow != null && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">流量对比：入口 {readableValue(frame.inletFlow, 'L/s')}，出口 {readableValue(frame.outletFlow, 'L/s')}，出口比入口{frame.outletFlow >= frame.inletFlow ? '高' : '低'} {readableValue(Math.abs(frame.outletFlow - frame.inletFlow), 'L/s')}。</div>}
                </section>

                {frame ? <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">发现异常时的测点</h3><span className="text-xs ops-muted">{frame.sampleTime}</span></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="入口流量" value={frame.inletFlow} unit="L/s" /><Metric label="出口流量" value={frame.outletFlow} unit="L/s" /><Metric label="总池体积" value={frame.pitVolume} unit="m³" /><Metric label="立管压力" value={frame.standpipePressure} unit="MPa" /><Metric label="套管压力" value={frame.casingPressure} unit="MPa" /><Metric label="钻头深度" value={frame.bitDepth} unit="m" /><Metric label="井深" value={frame.wellDepth} unit="m" /><Metric label="事件等级" value={event.currentLevel} prefix="L" /></div></section> : <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm ops-muted dark:border-slate-700 dark:bg-slate-900">当前事件没有保存对应测点，请回到实时监测曲线按事件时间复核。</section>}

                <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20"><h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><ClipboardCheck className="h-4 w-4 text-emerald-600" />现场建议核对</h3><ol className="mt-3 space-y-2">{checks.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">{index + 1}</span><span>{item}</span></li>)}</ol></section>

                {detail?.lifecycle?.length ? <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-900 dark:text-slate-100">事件变化过程</h3><div className="mt-3 space-y-2">{detail.lifecycle.map((item, index) => <div key={`${item.sampleTime}-${item.eventName}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-500" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-sm font-medium"><span>{plainLifecycleEvent(item.eventName)}</span><span className="ops-inline-tile px-1.5 py-0.5 text-[11px]">L{item.publicLevel}</span><span className="text-xs ops-muted">{item.sampleTime}</span></div>{cleanTechnicalText(item.reason) && <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{cleanTechnicalText(item.reason)}</div>}</div></div>)}</div></section> : null}

                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">确认审计</h3><span className="text-xs ops-muted">记录由后端保存</span></div>{detail?.acknowledgements?.length ? <div className="mt-3 space-y-2">{detail.acknowledgements.map((item) => <div key={item.acknowledgementId} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950"><div className="flex flex-wrap items-center gap-2 font-medium"><span>{item.user || '未知用户'}</span><span className="ops-inline-tile px-1.5 py-0.5 text-[11px]">{item.action}</span><span className="text-xs ops-muted">{item.acknowledgedAt}</span></div>{item.comment && <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">备注：{item.comment}</div>}</div>)}</div> : <div className="mt-3 text-sm ops-muted">暂无确认记录</div>}</section>

                <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs ops-muted dark:border-slate-800 dark:bg-slate-900"><summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">技术追溯信息</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><InfoItem label="事件编号" value={event.eventId || '—'} /><InfoItem label="会话编号" value={event.sessionCode || '—'} /><InfoItem label="后端帧号" value={frame ? String(frame.frameId) : '—'} /><InfoItem label="原始状态" value={frame?.eventState || event.candidateState || event.status || '—'} /></div></details>
              </>
            )}
          </div>

          {event && !event.isAcknowledged && event.warningId > 0 && <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-2 md:flex-row md:items-center"><input value={comment} onChange={(input) => onCommentChange(input.target.value)} maxLength={1000} placeholder="现场处置备注（可选，写入确认审计）" className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" /><button type="button" className="ops-button-primary" onClick={onAcknowledge} disabled={busy}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}确认并记录</button></div></footer>}
        </div>
      </aside>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="ops-inline-tile px-3 py-2"><div className="text-[11px] ops-muted">{label}</div><div className="mt-1 break-words text-sm text-slate-900 dark:text-slate-100">{value}</div></div>;
}

function ParameterChange({ parameter, direction, currentValue, meaning }: { parameter: string; direction: string; currentValue: string; meaning: string }) {
  const DirectionIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Activity;
  const directionText = direction === 'up' ? '升高' : direction === 'down' ? '降低' : '偏离正常';
  const tone = direction === 'up'
    ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20'
    : direction === 'down'
      ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20'
      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950';
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><DirectionIcon className="h-4 w-4" />{parameter}</div>
        <span className="rounded bg-white/70 px-2 py-1 text-xs font-semibold dark:bg-slate-900/70">{directionText}</span>
      </div>
      <div className="mt-2 text-sm">当前值：<strong className="tabular-nums">{currentValue}</strong></div>
      <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{meaning}</p>
    </div>
  );
}

function plainLifecycleEvent(value: string) {
  const key = value.trim().toLowerCase();
  if (/(created|opened|start)/.test(key)) return '首次发现异常';
  if (/(escalat|promot|level_up)/.test(key)) return '异常程度升高';
  if (/(recover|deescalat|level_down)/.test(key)) return '参数开始恢复';
  if (/(closed|resolved|ended)/.test(key)) return '事件结束';
  if (/(updated|revision|track)/.test(key)) return '持续观察到新变化';
  return '事件状态更新';
}

function Metric({ label, value, unit = '', prefix = '' }: { label: string; value: number | null | undefined; unit?: string; prefix?: string }) {
  const text = typeof value === 'number' && Number.isFinite(value) && prefix ? `${prefix}${value}` : readableValue(value, unit);
  return <div className="ops-inline-tile px-3 py-2"><div className="text-[11px] ops-muted">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{text}</div></div>;
}
