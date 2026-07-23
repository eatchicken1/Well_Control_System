import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
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
          <div className="mt-2 text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">{event.reason || '后端未提供文字原因，请打开详情查看算法帧。'}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ops-muted">
            <span>事件 {event.warningCode || event.eventId}</span>
            <span>Session {event.sessionCode || '—'}</span>
            <span>样本 {event.sampleCount}</span>
            {event.primarySignal && <span>主信号 {backendSignalLabel(event.primarySignal)}</span>}
            {event.isAcknowledged && <span>确认人 {event.acknowledgedBy || '—'} · {event.acknowledgedAt || '—'}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.activeSignals.length > 0 ? event.activeSignals.map((signal) => <span key={signal} className="ops-inline-tile px-2 py-1 text-[11px]">{backendSignalLabel(signal)}</span>) : <span className="text-xs ops-muted">未记录活动信号</span>}
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
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <aside className="h-full w-full max-w-[920px] overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-950" role="dialog" aria-modal="true" aria-labelledby="warning-review-detail-title" onClick={(click) => click.stopPropagation()}>
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0">
              <div className="ops-eyebrow">现场事件详情 · 后端事实</div>
              <h2 id="warning-review-detail-title" className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{event?.wellName || '报警事件'} · {event?.warningCode || event?.eventId || '加载中'}</h2>
              {event && <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className={`rounded px-2 py-1 font-semibold ${LEVEL_VISUAL[visualLevel(level)].badge}`}>L{level} {BACKEND_LEVEL_META[level].label}</span><span className="ops-inline-tile px-2 py-1">{lifecycleLabel(event)}</span><span className="ops-inline-tile px-2 py-1">Session {event.sessionCode || '—'}</span></div>}
            </div>
            <button type="button" className="ops-button-secondary px-2 py-1" onClick={onClose} aria-label="关闭事件详情"><X className="h-4 w-4" /></button>
          </header>

          <div className="ops-scroll flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
            {loading && <div className="ops-empty-state min-h-[180px]"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-cyan-600" /><div className="text-sm ops-muted">正在读取事件详情…</div></div>}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100">{error}</div>}
            {event && !loading && (
              <>
                <section className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-900 dark:text-cyan-100"><Eye className="h-4 w-4" />现场先看</div>
                  <p className="mt-2 text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">{event.reason || '后端未保存文字原因，请结合关键测点与算法状态复核。'}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><SummaryMetric label="当前等级" value={event.currentLevel} /><SummaryMetric label="事件最高等级" value={event.highestLevel} /><SummaryMetric label="覆盖样本" value={event.sampleCount} /><SummaryMetric label="确认次数" value={event.acknowledgementCount} /></div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">算法证据与判断</h3><span className="text-xs ops-muted">事件 {event.eventId}</span></div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{signals.length ? signals.map((signal) => <span key={signal} className="ops-inline-tile px-2 py-1 text-xs">{backendSignalLabel(signal)}</span>) : <span className="text-sm ops-muted">未记录活动信号</span>}</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2"><InfoItem label="主触发信号" value={event.primarySignal ? backendSignalLabel(event.primarySignal) : '—'} /><InfoItem label="候选状态" value={event.candidateState || event.status || '—'} /><InfoItem label="人工复核" value={event.needsManualReview ? '需要' : '未标记'} /><InfoItem label="起止时间" value={`${event.startTime || '—'} 至 ${event.endTime || '持续中'}`} /></div>
                </section>

                {frame ? <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">最新算法帧与关键测点</h3><span className="text-xs ops-muted">采样 {frame.sampleTime} · Frame {frame.frameId}</span></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="入口流量" value={frame.inletFlow} /><Metric label="出口流量" value={frame.outletFlow} /><Metric label="总池体积" value={frame.pitVolume} unit="m³" /><Metric label="立管压力" value={frame.standpipePressure} unit="MPa" /><Metric label="套管压力" value={frame.casingPressure} unit="MPa" /><Metric label="钻头深度" value={frame.bitDepth} unit="m" /><Metric label="井深" value={frame.wellDepth} unit="m" /><Metric label="正式评估" value={frame.formalEvalLevel} prefix="L" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><InfoItem label="算法事件状态" value={frame.eventState || '—'} /><InfoItem label="主导假设" value={frame.dominantHypothesis || '—'} /><InfoItem label="跨周期结论" value={frame.cycleResolution || '—'} /><InfoItem label="前兆等级" value={frame.precursorLevel || '—'} /></div>{frame.reason && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-200">{frame.reason}</p>}</section> : <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm ops-muted dark:border-slate-700 dark:bg-slate-900">当前事件没有匹配到已持久化算法帧，列表中的事件摘要仍来自后端事件投影。</section>}

                {detail?.lifecycle?.length ? <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-900 dark:text-slate-100">生命周期轨迹</h3><div className="mt-3 space-y-2">{detail.lifecycle.map((item, index) => <div key={`${item.sampleTime}-${item.eventName}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-500" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-sm font-medium"><span>{item.eventName}</span><span className="ops-inline-tile px-1.5 py-0.5 text-[11px]">L{item.publicLevel}</span><span className="ops-inline-tile px-1.5 py-0.5 text-[11px]">{item.eventState}</span><span className="text-xs ops-muted">修订 {item.revisionSequence}</span></div><div className="mt-1 text-xs ops-muted">{item.sampleTime}</div>{item.reason && <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.reason}</div>}</div></div>)}</div></section> : null}

                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">确认审计</h3><span className="text-xs ops-muted">记录由后端保存</span></div>{detail?.acknowledgements?.length ? <div className="mt-3 space-y-2">{detail.acknowledgements.map((item) => <div key={item.acknowledgementId} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950"><div className="flex flex-wrap items-center gap-2 font-medium"><span>{item.user || '未知用户'}</span><span className="ops-inline-tile px-1.5 py-0.5 text-[11px]">{item.action}</span><span className="text-xs ops-muted">{item.acknowledgedAt}</span></div>{item.comment && <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">备注：{item.comment}</div>}</div>)}</div> : <div className="mt-3 text-sm ops-muted">暂无确认记录</div>}</section>
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

function Metric({ label, value, unit = '', prefix = '' }: { label: string; value: number | null | undefined; unit?: string; prefix?: string }) {
  const text = typeof value === 'number' && Number.isFinite(value) && prefix ? `${prefix}${value}` : readableValue(value, unit);
  return <div className="ops-inline-tile px-3 py-2"><div className="text-[11px] ops-muted">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{text}</div></div>;
}
