import { useEffect, useState, type ElementType } from 'react';
import { AlertTriangle, Check, CheckCheck, Clock3, Eye, Filter, ShieldAlert, Siren, X } from 'lucide-react';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { OpsProcedureRail } from '../components/OpsProcedureRail';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';

type BackendLevelFilter = 'all' | '2' | '3' | '4';
type AckFilter = 'all' | 'unacknowledged' | 'acknowledged';

const LEVEL_VISUAL: Record<2 | 3 | 4, {
  tone: string;
  badge: string;
  dot: string;
  icon: ElementType;
}> = {
  2: {
    tone: 'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
  },
  3: {
    tone: 'border-orange-200 bg-orange-50 dark:border-orange-900/70 dark:bg-orange-950/20',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100',
    dot: 'bg-orange-500',
    icon: Siren,
  },
  4: {
    tone: 'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-100',
    dot: 'bg-red-600',
    icon: ShieldAlert,
  },
};

function safeBackendLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

function alertVisualLevel(value: unknown): 2 | 3 | 4 {
  const level = safeBackendLevel(value);
  if (level >= 4) return 4;
  if (level >= 3) return 3;
  return 2;
}

function CounterCard({
  level,
  value,
}: {
  level: 2 | 3 | 4;
  value: number;
}) {
  const visual = LEVEL_VISUAL[level];
  const Icon = visual.icon;
  return (
    <div className={`ops-panel-soft flex min-w-0 items-center gap-2 border p-2.5 ${visual.tone}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${visual.badge}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xl tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
        <div className="truncate text-xs ops-muted">L{level} {BACKEND_LEVEL_META[level].shortLabel}</div>
      </div>
    </div>
  );
}

function responsePriority(level: BackendLevel, acknowledged: boolean) {
  const safeLevel = safeBackendLevel(level);
  if (!acknowledged) return 10 - safeLevel;
  return 20 - safeLevel;
}

function eventStateLabel(value: string) {
  if (value === 'confirmed') return '已确认风险';
  if (value === 'tracking') return '持续跟踪';
  if (value === 'observing') return '异常观察';
  if (value === 'recovering') return '恢复观察';
  if (value === 'normal') return '已恢复';
  return value || '报警事件';
}

function evidenceTitle(alert: ReturnType<typeof useWellControl>['alerts'][number]) {
  const signals = alert.activeSignals.map(backendSignalLabel).filter(Boolean);
  return signals.length ? signals.join('、') : '事件证据';
}

export default function Alerts() {
  const {
    alerts,
    acknowledgeAlert,
    backendDetection,
    wellInfo,
    selectedWellId,
    wells,
  } = useWellControl();
  const [levelFilter, setLevelFilter] = useState<BackendLevelFilter>('all');
  const [ackFilter, setAckFilter] = useState<AckFilter>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  const currentWellId = selectedWellId || wellInfo.wellId;
  const activeWellLabel = wells.find((well) => well.wellId === currentWellId)?.wellName || wellInfo.wellName;
  const wellAlerts = alerts.filter((alert) => !currentWellId || !alert.wellId || alert.wellId === currentWellId);
  const filtered = wellAlerts
    .filter((alert) => {
      if (levelFilter !== 'all' && safeBackendLevel(alert.backendLevel) !== Number(levelFilter)) return false;
      if (ackFilter === 'unacknowledged' && alert.acknowledged) return false;
      if (ackFilter === 'acknowledged' && !alert.acknowledged) return false;
      return true;
    })
    .sort((a, b) => responsePriority(safeBackendLevel(a.backendLevel), a.acknowledged) - responsePriority(safeBackendLevel(b.backendLevel), b.acknowledged));

  const countFor = (level: BackendLevel) => wellAlerts.filter((alert) => safeBackendLevel(alert.backendLevel) === level && !alert.acknowledged).length;
  const l2Count = countFor(2);
  const l3Count = countFor(3);
  const l4Count = countFor(4);
  const unacknowledgedCount = wellAlerts.filter((alert) => !alert.acknowledged).length;
  const visibleUnacknowledgedCount = filtered.filter((alert) => !alert.acknowledged).length;
  const acknowledgedCount = wellAlerts.length - unacknowledgedCount;
  const selectedAlert = selectedAlertId == null ? null : wellAlerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const hasActiveFilters = levelFilter !== 'all' || ackFilter !== 'all';
  const activeScopeLabel = activeWellLabel || wellInfo.wellName;
  const currentDetectionLevel = safeBackendLevel(backendDetection.publicLevel);

  useEffect(() => {
    setSelectedAlertId(null);
  }, [currentWellId]);

  useEffect(() => {
    if (!selectedAlert) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedAlertId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAlert]);

  const acknowledgeVisibleAlerts = () => {
    filtered
      .filter((alert) => !alert.acknowledged)
      .forEach((alert) => acknowledgeAlert(alert.id));
  };

  const queueSteps = [
    {
      code: 'L2',
      label: '预警复核',
      value: l2Count > 0 ? `${l2Count} 条待复核` : '无待复核项',
      state: l2Count > 0 ? 'warning' as const : 'done' as const,
      icon: AlertTriangle,
    },
    {
      code: 'L3',
      label: '处置准备',
      value: l3Count > 0 ? `${l3Count} 条待处置` : '无高度预警',
      state: l3Count > 0 ? 'active' as const : 'done' as const,
      icon: Siren,
    },
    {
      code: 'L4',
      label: '确认处置',
      value: l4Count > 0 ? `${l4Count} 条严重事件` : '无确认事件',
      state: l4Count > 0 ? 'critical' as const : 'done' as const,
      icon: ShieldAlert,
    },
    {
      code: 'ACK',
      label: '确认闭环',
      value: unacknowledgedCount > 0 ? `${unacknowledgedCount} 条未确认` : '队列清空',
      state: unacknowledgedCount > 0 ? 'active' as const : 'done' as const,
      icon: CheckCheck,
    },
  ];

  return (
    <div className="ops-page space-y-4">
      <MonitoringWellTabs />
      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">报警复核</div>
          <h1 className="ops-title">报警事件复核</h1>
          <p className="text-sm ops-muted">
            {activeScopeLabel} · 当前报警等级 L{currentDetectionLevel} {BACKEND_LEVEL_META[currentDetectionLevel].label} · 事件 {wellAlerts.length} 条
          </p>
        </div>
        <div className="ops-page-toolbar">
          {visibleUnacknowledgedCount > 0 && (
            <button
              type="button"
              onClick={acknowledgeVisibleAlerts}
              className="ops-button-primary"
              title={`确认当前井 ${visibleUnacknowledgedCount} 条未确认事件`}
              aria-label={`确认当前井 ${visibleUnacknowledgedCount} 条未确认报警事件`}
            >
              <CheckCheck className="h-4 w-4" />
              全部确认
            </button>
          )}
        </div>
      </div>

      <div className="ops-stat-grid">
        <CounterCard level={2} value={l2Count} />
        <CounterCard level={3} value={l3Count} />
        <CounterCard level={4} value={l4Count} />
        <div className="ops-panel-soft flex min-w-0 items-center gap-2 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xl tabular-nums text-slate-900 dark:text-slate-100">{acknowledgedCount}</div>
            <div className="truncate text-xs ops-muted">已确认记录</div>
          </div>
        </div>
      </div>

      <OpsProcedureRail steps={queueSteps} compact />

      <div className="ops-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <Filter className="h-4 w-4 ops-muted" />
          <div className="ops-segment">
            {(['all', '2', '3', '4'] as BackendLevelFilter[]).map((level) => (
              <button
                key={level}
                type="button"
                data-active={levelFilter === level}
                aria-pressed={levelFilter === level}
                onClick={() => setLevelFilter(level)}
              >
                {level === 'all' ? '全部级别' : `L${level} ${BACKEND_LEVEL_META[Number(level) as 2 | 3 | 4].shortLabel}`}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="ops-segment">
            {(['all', 'unacknowledged', 'acknowledged'] as AckFilter[]).map((ack) => (
              <button
                key={ack}
                type="button"
                data-active={ackFilter === ack}
                aria-pressed={ackFilter === ack}
                onClick={() => setAckFilter(ack)}
              >
                {ack === 'all' ? '全部状态' : ack === 'unacknowledged' ? '未确认' : '已确认'}
              </button>
            ))}
          </div>
        </div>

        <div className="ops-surface-body ops-scroll max-h-[calc(100vh-340px)] divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="ops-empty-state m-3 min-h-[180px]">
              <div>
                <Check className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  {wellAlerts.length === 0 ? '当前没有报警事件' : '当前筛选条件下没有事件'}
                </div>
                {wellAlerts.length > 0 ? (
                  <div className="mt-1 text-xs ops-muted">当前筛选未命中事件，可清空筛选或调整级别/确认状态。</div>
                ) : null}
                {wellAlerts.length > 0 && hasActiveFilters ? (
                  <button
                    type="button"
                    className="ops-button-secondary mx-auto mt-3 px-3 py-1.5 text-xs"
                    onClick={() => {
                      setLevelFilter('all');
                      setAckFilter('all');
                    }}
                    aria-label="清空报警事件筛选条件"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    清空筛选
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            filtered.map((alert) => {
              const currentLevel = safeBackendLevel(alert.backendLevel);
              const peakLevel = alertVisualLevel(alert.peakBackendLevel ?? alert.backendLevel);
              const visualLevel = alertVisualLevel(currentLevel >= 2 ? currentLevel : peakLevel);
              const visual = LEVEL_VISUAL[visualLevel];
              const Icon = visual.icon;
              const currentBadge = currentLevel >= 2
                ? visual.badge
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100';
              return (
                <article
                  key={alert.id}
                  className={`relative flex items-start gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${alert.acknowledged ? 'border-l-slate-300 opacity-55 dark:border-l-slate-700' : `${visual.tone} ${visualLevel === 4 ? 'border-l-red-600' : visualLevel === 3 ? 'border-l-orange-500' : 'border-l-amber-500'}`}`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${currentBadge}`}>
                        当前 L{currentLevel} {BACKEND_LEVEL_META[currentLevel].label}
                      </span>
                      {peakLevel > currentLevel ? (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">
                          峰值 L{peakLevel}
                        </span>
                      ) : null}
                      <span className="rounded bg-black/5 px-2 py-0.5 text-[11px] ops-muted dark:bg-white/10">{eventStateLabel(alert.eventState)}</span>
                      <span className="rounded bg-black/5 px-2 py-0.5 text-[11px] ops-muted dark:bg-white/10">{alert.pumpState}</span>
                      <span className="text-xs ops-muted">
                        {alert.date} {alert.time}{alert.count && alert.count > 1 ? ` · 持续 ${alert.count} 帧` : ''}
                      </span>
                    </div>
                    <div className="ops-break-text mt-2 text-sm text-slate-800 dark:text-slate-100">{alert.message}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {alert.activeSignals.map((signal) => (
                        <span key={signal} className="ops-inline-tile px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200">
                          {backendSignalLabel(signal)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedAlertId(alert.id)}
                      aria-label={`查看 ${alert.wellName || alert.wellId || '当前井'} L${currentLevel} 报警详情`}
                      className="ops-button-secondary px-2.5 py-1 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      详情
                    </button>
                    {!alert.acknowledged && (
                      <button
                        type="button"
                        onClick={() => acknowledgeAlert(alert.id)}
                        aria-label={`确认 ${alert.wellName || alert.wellId || '当前井'} L${currentLevel} 报警`}
                        className="ops-button-secondary px-2.5 py-1 text-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        确认
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setSelectedAlertId(null)}>
          <div
            className="ops-panel w-full max-w-xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-detail-title"
            aria-describedby="alert-detail-summary"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <div className="ops-eyebrow">事件详情</div>
                <h2 id="alert-detail-title" className="text-base text-slate-900 dark:text-slate-100">事件详情</h2>
              </div>
              <button type="button" className="ops-button-secondary px-2 py-1" onClick={() => setSelectedAlertId(null)} title="关闭事件详情" aria-label="关闭事件详情" autoFocus>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="ops-scroll max-h-[calc(100vh-150px)] space-y-3 overflow-auto p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  safeBackendLevel(selectedAlert.backendLevel) >= 2
                    ? LEVEL_VISUAL[alertVisualLevel(selectedAlert.backendLevel)].badge
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100'
                }`}>
                  当前 L{safeBackendLevel(selectedAlert.backendLevel)} {BACKEND_LEVEL_META[safeBackendLevel(selectedAlert.backendLevel)].label}
                </span>
                {safeBackendLevel(selectedAlert.peakBackendLevel ?? selectedAlert.backendLevel) > safeBackendLevel(selectedAlert.backendLevel) ? (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">
                    峰值 L{safeBackendLevel(selectedAlert.peakBackendLevel)}
                  </span>
                ) : null}
                <span className="ops-inline-tile px-2 py-1 text-xs">{eventStateLabel(selectedAlert.eventState)}</span>
                <span className="ops-inline-tile px-2 py-1 text-xs">{selectedAlert.pumpState}</span>
              </div>
              <div id="alert-detail-summary" className="ops-break-text rounded-md bg-slate-50 p-3 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                <div className="mb-1 flex items-center gap-2 text-xs ops-muted">
                  <Clock3 className="h-3.5 w-3.5" />
                  {selectedAlert.date} {selectedAlert.time} 至 {selectedAlert.lastDate || selectedAlert.date} {selectedAlert.lastTime || selectedAlert.time}
                </div>
                {selectedAlert.message}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="ops-inline-tile px-3 py-2">
                  <div className="text-[11px] ops-muted">首次时间</div>
                  <div className="mt-1 tabular-nums">{selectedAlert.date} {selectedAlert.time}</div>
                </div>
                <div className="ops-inline-tile px-3 py-2">
                  <div className="text-[11px] ops-muted">最近时间</div>
                  <div className="mt-1 tabular-nums">{selectedAlert.lastDate || selectedAlert.date} {selectedAlert.lastTime || selectedAlert.time}</div>
                </div>
                <div className="ops-inline-tile px-3 py-2">
                  <div className="text-[11px] ops-muted">持续帧数</div>
                  <div className="mt-1 tabular-nums">{selectedAlert.count || 1}</div>
                </div>
                <div className="ops-inline-tile px-3 py-2">
                  <div className="text-[11px] ops-muted">正式评估等级</div>
                  <div className="mt-1 tabular-nums">
                    L{safeBackendLevel(selectedAlert.formalEvalLevel)}
                    {safeBackendLevel(selectedAlert.peakFormalEvalLevel ?? selectedAlert.formalEvalLevel) > safeBackendLevel(selectedAlert.formalEvalLevel)
                      ? ` / 峰值 L${safeBackendLevel(selectedAlert.peakFormalEvalLevel)}`
                      : ''}
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[11px] ops-muted">证据摘要</div>
                <div className="ops-break-text mt-1 text-sm text-slate-900 dark:text-slate-100">{evidenceTitle(selectedAlert)}</div>
              </div>
              <div>
                <div className="mb-2 text-[11px] ops-muted">活动信号</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAlert.activeSignals.length > 0 ? selectedAlert.activeSignals.map((signal) => (
                    <span key={signal} className="ops-inline-tile px-2 py-1 text-xs">{backendSignalLabel(signal)}</span>
                  )) : <span className="ops-muted">无</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
