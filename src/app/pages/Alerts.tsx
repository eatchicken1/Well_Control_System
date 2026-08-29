import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { OpsProcedureRail } from '../components/OpsProcedureRail';
import { useWellControl } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';
import { operatorEventPresentation } from '../lib/operatorEventPresentation';
import { formalVisualLevel, LEVEL_VISUAL } from '../lib/levelVisual';
import { formatSourceDateTime } from '../lib/sourceTime';
import {
  eventLevel,
  fieldSignalLabels,
  formatDuration,
  isEnded,
  lifecycleLabel,
  safeLevel,
} from '../lib/warningEventView';
import {
  acknowledgeWarningEvent,
  acknowledgeWarningEvents,
  fetchWarningEvents,
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

function filteredEvents(
  events: WarningEventReviewItem[],
  levelFilter: LevelFilter,
  acknowledgementFilter: AcknowledgementFilter,
  lifecycleFilter: LifecycleFilter,
) {
  return events
    .filter((event) => {
      // L0/L1 do not belong in the formal alarm list: L1 is the advisory
      // observation lane on the monitoring page. Keeping them here would
      // visually promote an early weak precursor to "L2 formal" via the
      // L2+ visual floor below - the opposite of the L0-L4 escalation
      // semantics.
      if (eventLevel(event) < 2) return false;
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

export default function Alerts() {
  const navigate = useNavigate();
  const { backendDetection, wellInfo, selectedWellId, wells, wellRuntimeStates } = useWellControl();
  const currentWellId = selectedWellId || wellInfo.wellId;
  const activeWell = wells.find((well) => well.wellId === currentWellId) || wellInfo;
  const currentRuntime = wellRuntimeStates[currentWellId];
  const currentSessionCode = currentRuntime?.monitoringMode === 'historyReplay'
    ? currentRuntime.sessionCode || ''
    : '';
  const [page, setPage] = useState<WarningEventReviewPage | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [acknowledgementFilter, setAcknowledgementFilter] = useState<AcknowledgementFilter>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ackComment, setAckComment] = useState('');
  // Server-paged events (the realtime stream keeps a live newest-window;
  // this page is the full paginated history).
  const ALERT_PAGE_SIZE = 200;
  const [pageIndex, setPageIndex] = useState(1);

  const loadEvents = useCallback(async (signal?: AbortSignal) => {
    const firstLoad = page === null;
    if (firstLoad) setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetchWarningEvents({
        wellId: currentWellId || undefined,
        sessionCode: currentSessionCode || undefined,
        includeAcknowledged: true,
        page: pageIndex,
        pageSize: ALERT_PAGE_SIZE,
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
  }, [currentSessionCode, currentWellId, page, pageIndex]);

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setPageIndex(1);
    void loadEvents(controller.signal);
    const timer = window.setInterval(() => void loadEvents(), 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [currentSessionCode, currentWellId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    void loadEvents(controller.signal);
    return () => controller.abort();
  }, [pageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = page?.summary || EMPTY_SUMMARY;
  const events = useMemo(
    () => filteredEvents(page?.events || [], levelFilter, acknowledgementFilter, lifecycleFilter),
    [acknowledgementFilter, levelFilter, lifecycleFilter, page?.events],
  );
  const eligibleForBulkAcknowledgement = events.filter((event) => !event.isAcknowledged && event.warningId > 0);
  const currentLevel = safeLevel(backendDetection.advisoryLevel);
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
            <span className={`h-2 w-2 rounded-full ${LEVEL_VISUAL[currentLevel].dot}`} />
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
            <span className="ml-auto text-xs ops-muted">
              本页 {events.length} 条 · 后端共 {summary.total} 条
            </span>
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

        <div className="alerts-event-scroll ops-surface-body ops-scroll max-h-[calc(100vh-360px)] overflow-y-auto">
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
            events.map((event) => <AlertRow key={event.eventId} event={event} busy={busyAction === `ack:${event.eventId}`} onOpen={() => navigate(`/alerts/${encodeURIComponent(event.eventId)}`)} onAcknowledge={() => void acknowledgeOne(event)} />)
          )}
        </div>

        {page && page.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="ops-muted">第 {page.page} / {page.totalPages} 页 · 每页 {page.pageSize} 条</span>
            <div className="flex items-center gap-2">
              <button type="button" className="ops-button-secondary px-2.5 py-1.5" disabled={pageIndex <= 1 || refreshing} onClick={() => setPageIndex((current) => Math.max(1, current - 1))} aria-label="上一页">
                <ChevronLeft className="h-3.5 w-3.5" />上一页
              </button>
              <button type="button" className="ops-button-secondary px-2.5 py-1.5" disabled={pageIndex >= (page.totalPages || 1) || refreshing} onClick={() => setPageIndex((current) => current + 1)} aria-label="下一页">
                下一页<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRow({ event, busy, onOpen, onAcknowledge }: { event: WarningEventReviewItem; busy: boolean; onOpen: () => void; onAcknowledge: () => void }) {
  const navigate = useNavigate();
  const level = eventLevel(event);
  const presentation = operatorEventPresentation(event, level);
  const visual = LEVEL_VISUAL[formalVisualLevel(level)];
  const Icon = visual.icon;
  const canAcknowledge = event.warningId > 0 && !event.isAcknowledged;
  const visibleSignals = fieldSignalLabels(event.activeSignals);
  const effectClass = !event.isAcknowledged && level >= 2 ? `alarm-event-light-l${Math.min(4, level)}` : '';
  return (
    <article className={`relative border-b border-slate-200 border-l-4 px-4 py-4 last:border-b-0 dark:border-slate-800 ${effectClass} ${event.isAcknowledged ? 'border-l-slate-300 bg-white/60 opacity-75 dark:border-l-slate-700 dark:bg-slate-950/40' : `${visual.tone} ${level >= 4 ? 'border-l-red-600' : level >= 3 ? 'border-l-orange-500' : 'border-l-amber-500'}`}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-1 text-xs font-semibold ${visual.badge}`}>L{level} {BACKEND_LEVEL_META[level].label}</span>
            {event.highestLevel > event.currentLevel && <span className="rounded bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800 dark:bg-red-500/15 dark:text-red-100">峰值 L{event.highestLevel}</span>}
            <span className="rounded bg-black/5 px-2 py-1 text-[11px] ops-muted dark:bg-white/10">{lifecycleLabel(event)}</span>
            {event.needsManualReview && <span className="rounded bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-100">需人工复核</span>}
            <span className="text-xs ops-muted">{formatSourceDateTime(event.startTime) || event.startTime} · {formatDuration(event.startTime, event.endTime)}</span>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 block max-w-full text-left text-base font-semibold leading-6 text-slate-950 hover:text-cyan-700 dark:text-slate-100 dark:hover:text-cyan-300"
            title="打开事件详情"
          >
            {presentation.title}
          </button>
          <div className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{presentation.description}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ops-muted">
            <span>事件 {event.warningCode || event.eventId}</span>
            <span>Session {event.sessionCode || '—'}</span>
            <span>样本 {event.sampleCount}</span>
            {event.primaryParameter && <span>主要异常参数 {event.primaryParameter}</span>}
            {event.isAcknowledged && <span>确认人 {event.acknowledgedBy || '—'} · {event.acknowledgedAt || '—'}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleSignals.length > 0 ? visibleSignals.map((signal) => <span key={signal} className="ops-inline-tile px-2 py-1 text-[11px]">{signal}</span>) : <span className="text-xs ops-muted">未记录可识别的异常参数</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="button" className="ops-button-secondary px-3 py-1.5 text-xs" onClick={onOpen}><Eye className="h-3.5 w-3.5" />详情</button>
          {canAcknowledge ? <button type="button" className="ops-button-primary px-3 py-1.5 text-xs" onClick={onAcknowledge} disabled={busy}><Check className="h-3.5 w-3.5" />{busy ? '提交中…' : '确认报警'}</button> : event.isAcknowledged ? <span className="ops-inline-tile px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-200"><Check className="h-3.5 w-3.5" />已留痕</span> : <span className="ops-inline-tile px-3 py-1.5 text-xs text-amber-800 dark:text-amber-100">候选待落库</span>}
        </div>
      </div>
    </article>
  );
}
