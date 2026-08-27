import { Activity, AlertTriangle, ArrowDown, Bell, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alert } from '../context/WellControlContext';
import {
  filterMonitoringEvents,
  monitoringEventVisualTone,
  restoreFollowLatest,
  updateFollowLatestForItems,
  updateFollowLatestForScroll,
  type FollowLatestState,
  type MonitoringEventFilter,
  type MonitoringEventStreamItem,
  type MonitoringLifecycleStatus,
} from '../lib/monitoringEventStream';
import { EventExplanationDrawer } from './EventExplanationDrawer';

const FILTERS: Array<{ value: MonitoringEventFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'alarms', label: '告警 L2+' },
  { value: 'unacknowledged', label: '未确认' },
];

const TONE_CLASSES = {
  neutral: 'border-l-slate-300 bg-white text-slate-700 dark:border-l-slate-600 dark:bg-slate-950/30 dark:text-slate-200',
  amber: 'border-l-amber-500 bg-amber-50/55 text-slate-800 dark:border-l-amber-400 dark:bg-amber-950/15 dark:text-slate-100',
  orange: 'border-l-orange-500 bg-orange-50/60 text-slate-900 dark:border-l-orange-400 dark:bg-orange-950/15 dark:text-slate-50',
  red: 'border-l-red-600 bg-red-50/60 text-slate-950 dark:border-l-red-500 dark:bg-red-950/15 dark:text-slate-50',
} as const;

const BADGE_CLASSES = {
  neutral: 'border-slate-300 bg-transparent text-slate-600 dark:border-slate-600 dark:text-slate-300',
  amber: 'border-amber-300 bg-amber-100/60 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  orange: 'border-orange-300 bg-orange-100/60 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200',
  red: 'border-red-300 bg-red-100/60 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200',
} as const;

function durationLabel(duration: number) {
  if (duration < 1_000) return '<1秒';
  const seconds = Math.round(duration / 1_000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小时${minutes % 60}分`;
}

function clockLabel(value: string) {
  const match = String(value || '').match(/(\d{2}:\d{2}:\d{2})/);
  return match?.[1] || value || '--:--:--';
}

function lifecycleLabel(status: MonitoringLifecycleStatus) {
  if (status === 'active') return '进行中';
  if (status === 'hold') return '保持（解释冻结）';
  if (status === 'watching') return '观察中';
  if (status === 'recovering') return '恢复中';
  if (status === 'closedUnresolved') return '已关闭·未解除';
  return '已结束';
}

function StatusIcon({ item }: { item: MonitoringEventStreamItem }) {
  if (item.kind === 'observation') return <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (!item.isActive) return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (item.currentLevel >= 4) return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  return <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

function EventRow({ item, onOpen }: { item: MonitoringEventStreamItem; onOpen?: () => void }) {
  const tone = monitoringEventVisualTone(item);
  const primaryBadgeLevel = item.kind === 'alarm' && !item.isActive ? item.peakLevel : item.currentLevel;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-1.5 leading-4">
        <StatusIcon item={item} />
        <time className="w-[4.1rem] shrink-0 font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{clockLabel(item.startTime)}</time>
        <span className={`rounded border px-1 py-px text-[9px] font-bold leading-3 ${BADGE_CLASSES[tone]}`}>{item.kind === 'alarm' && !item.isActive ? '峰 ' : ''}L{item.kind === 'observation' ? 1 : primaryBadgeLevel}</span>
        <span className={`min-w-0 flex-1 truncate text-[11px] ${tone === 'orange' || tone === 'red' ? 'font-semibold' : 'font-medium'}`}>{item.message}</span>
        {item.kind === 'alarm' && item.isActive && item.peakLevel > item.currentLevel ? (
          <span className="shrink-0 rounded border border-slate-300 px-1 text-[9px] font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">峰 L{item.peakLevel}</span>
        ) : null}
        {item.kind === 'alarm' && item.isActive && item.ackStatus === 'unacknowledged' ? (
          <span className="flex shrink-0 items-center gap-1 text-[9px] font-semibold text-red-700 dark:text-red-300"><Circle className="h-2 w-2 fill-current" aria-hidden="true" />未确认</span>
        ) : (
          <span className="shrink-0 text-[9px] text-slate-500 dark:text-slate-400">{item.kind === 'observation' ? '无需确认' : item.ackStatus === 'acknowledged' ? '已确认' : lifecycleLabel(item.lifecycleStatus)}</span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1 pl-5 text-[9px] leading-3 text-slate-500 dark:text-slate-400">
        <span>{clockLabel(item.startTime)}–{clockLabel(item.endTime)}</span>
        <span aria-hidden="true">·</span>
        <span>持续 {durationLabel(item.duration)}</span>
        {item.kind === 'alarm' ? <><span aria-hidden="true">·</span><span>{item.isActive ? `当前 L${item.currentLevel}` : `当前 L${item.currentLevel} · ${lifecycleLabel(item.lifecycleStatus)}`}</span></> : null}
      </div>
      {item.description ? <div className="mt-1 line-clamp-2 pl-5 text-[10px] leading-4 text-slate-600 dark:text-slate-300">{item.description}</div> : null}
    </>
  );

  const classes = `block w-full border-b border-b-slate-200 border-l-[3px] px-2 py-1.5 text-left dark:border-b-slate-800 ${TONE_CLASSES[tone]}`;
  return onOpen ? (
    <button type="button" className={`${classes} hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600`} onClick={onOpen} aria-label={`查看当前 L${item.currentLevel}、峰值 L${item.peakLevel} 告警事件详情：${item.message}`}>
      {content}
    </button>
  ) : <div className={classes} aria-label={`查看事件：${item.message}`}>{content}</div>;
}

export function MonitoringEventStream({
  items,
  alerts,
  wellName,
  wellKey,
  endpoint,
}: {
  items: MonitoringEventStreamItem[];
  alerts: Alert[];
  wellName: string;
  wellKey: string;
  endpoint: string;
}) {
  const [filter, setFilter] = useState<MonitoringEventFilter>('all');
  const [selectedBackendEventId, setSelectedBackendEventId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<FollowLatestState>({ isFollowing: true, newEventCount: 0, itemCount: items.length });
  const [followState, setFollowState] = useState(followRef.current);
  const visibleItems = useMemo(() => filterMonitoringEvents(items, filter), [filter, items]);
  const selectedItem = selectedBackendEventId == null
    ? null
    : items.find((item) => item.backendEventId === selectedBackendEventId) ?? null;
  const selectedAlert = selectedItem == null
    ? null
    : alerts.find((alert) => alert.id === selectedItem.sourceAlertId)
      ?? alerts.find((alert) => alert.backendEventId === selectedBackendEventId)
      ?? null;

  const counts = useMemo(() => ({
    observation: items.filter((item) => item.kind === 'observation').length,
    2: items.filter((item) => item.kind === 'alarm' && item.currentLevel === 2).length,
    3: items.filter((item) => item.kind === 'alarm' && item.currentLevel === 3).length,
    4: items.filter((item) => item.kind === 'alarm' && item.currentLevel >= 4).length,
  }), [items]);
  const highestActiveLevel = items.reduce((highest, item) => item.kind === 'alarm' && item.isActive ? Math.max(highest, item.currentLevel) : highest, 0);

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  };

  useEffect(() => {
    const update = updateFollowLatestForItems(followRef.current, items.length);
    followRef.current = update.state;
    setFollowState(update.state);
    if (update.shouldScroll) requestAnimationFrame(() => scrollToLatest('auto'));
  }, [items.length]);

  useEffect(() => {
    if (followRef.current.isFollowing) requestAnimationFrame(() => scrollToLatest('auto'));
  }, [filter]);

  useEffect(() => {
    setSelectedBackendEventId(null);
    followRef.current = { isFollowing: true, newEventCount: 0, itemCount: items.length };
    setFollowState(followRef.current);
    requestAnimationFrame(() => scrollToLatest('auto'));
  }, [wellKey]);

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 12;
    const next = updateFollowLatestForScroll(followRef.current, isAtBottom);
    if (next.isFollowing !== followRef.current.isFollowing || next.newEventCount !== followRef.current.newEventCount) {
      followRef.current = next;
      setFollowState(next);
    }
  };

  const resumeFollowing = () => {
    const next = restoreFollowLatest(followRef.current);
    followRef.current = next;
    setFollowState(next);
    scrollToLatest();
  };

  const countBadge = (level: 2 | 3 | 4, className: string) => (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${counts[level] === 0 ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500' : className}`}>L{level} {counts[level]}</span>
  );

  return (
    <section className="monitoring-alert-queue ops-panel-soft flex h-full min-h-0 flex-col overflow-hidden" aria-label={`${wellName} 实时事件流`}>
      <header className="shrink-0 border-b border-slate-200 px-2.5 pb-2 pt-2 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-1.5">
          <Bell className={`h-4 w-4 shrink-0 ${highestActiveLevel >= 4 ? 'text-red-600 dark:text-red-400' : highestActiveLevel === 3 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`} aria-hidden="true" />
          <h2 className="shrink-0 text-xs font-semibold text-slate-900 dark:text-slate-100">实时事件流</h2>
          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500 dark:text-slate-400">{wellName}</span>
          {countBadge(2, 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200')}
          {countBadge(3, 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200')}
          {countBadge(4, 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200')}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex rounded-md bg-slate-100 p-0.5 dark:bg-slate-900" role="group" aria-label="事件流筛选">
            {FILTERS.map((option) => (
              <button key={option.value} type="button" className={`rounded px-2 py-0.5 text-[9px] transition-colors ${filter === option.value ? 'bg-white font-semibold text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
            <span>观察 {counts.observation}</span>
            <span aria-hidden="true">·</span>
            <span className={`truncate font-medium ${highestActiveLevel >= 4 ? 'text-red-700 dark:text-red-300' : highestActiveLevel === 3 ? 'text-orange-700 dark:text-orange-300' : highestActiveLevel === 2 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
              {highestActiveLevel >= 2 ? `当前最高 L${highestActiveLevel}` : '当前无活动告警'}
            </span>
          </div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={viewportRef} className="ops-scroll h-full overflow-y-auto" onScroll={handleScroll} aria-live="polite">
          {visibleItems.length === 0 ? (
            <div className="flex items-center justify-center gap-1.5 px-3 py-5 text-[11px] text-slate-500 dark:text-slate-400">
              {items.length === 0 ? <><Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" aria-hidden="true" />暂无事件 · 持续监测中</> : '当前筛选无事件'}
            </div>
          ) : visibleItems.map((item) => (
            <EventRow key={item.id} item={item} onOpen={item.kind === 'alarm' && item.backendEventId ? () => setSelectedBackendEventId(item.backendEventId!) : undefined} />
          ))}
        </div>
        {!followState.isFollowing && followState.newEventCount > 0 ? (
          <button type="button" className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" onClick={resumeFollowing} aria-label={`滚动到最新的 ${followState.newEventCount} 条事件`}>
            <ArrowDown className="h-3 w-3" aria-hidden="true" />{followState.newEventCount} 条新事件
          </button>
        ) : null}
      </div>

      {selectedAlert ? (
        <EventExplanationDrawer alert={selectedAlert} wellKey={wellKey} endpoint={endpoint} onClose={() => setSelectedBackendEventId(null)} />
      ) : null}
    </section>
  );
}
