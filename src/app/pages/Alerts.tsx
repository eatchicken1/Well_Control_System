import { useState, type ElementType } from 'react';
import { AlertTriangle, Check, CheckCheck, Clock3, Filter, ShieldAlert, Siren, X } from 'lucide-react';
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
  if (!acknowledged) return 10 - level;
  return 20 - level;
}

function eventStateLabel(value: string) {
  if (value === 'confirmed') return '已确认风险';
  if (value === 'tracking') return '持续跟踪';
  if (value === 'observing') return '异常观察';
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
    acknowledgeAll,
    backendDetection,
    wellInfo,
    selectedWellId,
    monitoredWellIds,
    realtimeTabWellIds,
    wells,
  } = useWellControl();
  const [levelFilter, setLevelFilter] = useState<BackendLevelFilter>('all');
  const [ackFilter, setAckFilter] = useState<AckFilter>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);

  const activeWellIds = [...new Set([
    ...monitoredWellIds,
    ...realtimeTabWellIds,
    ...(selectedWellId ? [selectedWellId] : []),
  ])];
  const activeWellLabel = wells.find((well) => well.wellId === selectedWellId)?.wellName || wells.find((well) => well.wellId === activeWellIds[0])?.wellName || wellInfo.wellName;
  const wellAlerts = alerts.filter((alert) => !alert.wellId || activeWellIds.length === 0 || activeWellIds.includes(alert.wellId));
  const filtered = wellAlerts
    .filter((alert) => {
      if (levelFilter !== 'all' && alert.backendLevel !== Number(levelFilter)) return false;
      if (ackFilter === 'unacknowledged' && alert.acknowledged) return false;
      if (ackFilter === 'acknowledged' && !alert.acknowledged) return false;
      return true;
    })
    .sort((a, b) => responsePriority(a.backendLevel, a.acknowledged) - responsePriority(b.backendLevel, b.acknowledged));

  const countFor = (level: BackendLevel) => wellAlerts.filter((alert) => alert.backendLevel === level && !alert.acknowledged).length;
  const l2Count = countFor(2);
  const l3Count = countFor(3);
  const l4Count = countFor(4);
  const unacknowledgedCount = wellAlerts.filter((alert) => !alert.acknowledged).length;
  const acknowledgedCount = wellAlerts.length - unacknowledgedCount;
  const selectedAlert = selectedAlertId == null ? null : wellAlerts.find((alert) => alert.id === selectedAlertId) ?? null;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ops-eyebrow !text-slate-500">报警复核</div>
          <h1 className="ops-title !text-slate-900">报警事件复核</h1>
          <p className="text-sm !text-slate-600">
            {activeWellIds.length > 0 ? `${activeWellLabel} 等 ${activeWellIds.length} 口` : wellInfo.wellName} · 当前报警等级 L{backendDetection.publicLevel} {BACKEND_LEVEL_META[backendDetection.publicLevel].label} · 事件 {wellAlerts.length} 条
          </p>
        </div>
        <div className="flex gap-2">
          {unacknowledgedCount > 0 && (
            <button onClick={acknowledgeAll} className="ops-button-primary">
              <CheckCheck className="h-4 w-4" />
              全部确认
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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

      <div className="ops-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <Filter className="h-4 w-4 ops-muted" />
          <div className="ops-segment">
            {(['all', '2', '3', '4'] as BackendLevelFilter[]).map((level) => (
              <button key={level} data-active={levelFilter === level} onClick={() => setLevelFilter(level)}>
                {level === 'all' ? '全部级别' : `L${level} ${BACKEND_LEVEL_META[Number(level) as 2 | 3 | 4].shortLabel}`}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="ops-segment">
            {(['all', 'unacknowledged', 'acknowledged'] as AckFilter[]).map((ack) => (
              <button key={ack} data-active={ackFilter === ack} onClick={() => setAckFilter(ack)}>
                {ack === 'all' ? '全部状态' : ack === 'unacknowledged' ? '未确认' : '已确认'}
              </button>
            ))}
          </div>
        </div>

        <div className="ops-scroll max-h-[calc(100vh-340px)] divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="ops-empty-state m-3 min-h-[180px]">
              <div>
                <Check className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
                <div className="text-sm text-slate-700 dark:text-slate-200">当前没有报警事件</div>
              </div>
            </div>
          ) : (
            filtered.map((alert) => {
              const backendLevel = Math.max(2, alert.backendLevel) as 2 | 3 | 4;
              const visual = LEVEL_VISUAL[backendLevel];
              const Icon = visual.icon;
              return (
                <div
                  key={alert.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAlertId(alert.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedAlertId(alert.id);
                  }}
                  className={`relative flex cursor-pointer items-start gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${alert.acknowledged ? 'border-l-slate-300 opacity-55 dark:border-l-slate-700' : `${visual.tone} ${backendLevel === 4 ? 'border-l-red-600' : backendLevel === 3 ? 'border-l-orange-500' : 'border-l-amber-500'}`}`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${visual.badge}`}>
                        L{backendLevel} {BACKEND_LEVEL_META[backendLevel].label}
                      </span>
                      <span className="rounded bg-black/5 px-2 py-0.5 text-[11px] ops-muted dark:bg-white/10">{eventStateLabel(alert.eventState)}</span>
                      <span className="rounded bg-black/5 px-2 py-0.5 text-[11px] ops-muted dark:bg-white/10">{alert.pumpState}</span>
                      <span className="text-xs ops-muted">
                        {alert.date} {alert.time}{alert.count && alert.count > 1 ? ` · 持续 ${alert.count} 帧` : ''}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-800 dark:text-slate-100">{alert.message}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {alert.activeSignals.map((signal) => (
                        <span key={signal} className="ops-inline-tile px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200">
                          {backendSignalLabel(signal)}
                        </span>
                      ))}
                      {alert.count && alert.count > 1 ? <span className="px-1 py-1 text-[10px] ops-muted">持续 {alert.count} 帧</span> : null}
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        acknowledgeAlert(alert.id);
                      }}
                      className="ops-button-secondary shrink-0 px-2.5 py-1 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      确认
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setSelectedAlertId(null)}>
          <div className="ops-panel w-full max-w-xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <div className="ops-eyebrow">事件详情</div>
                <h2 className="text-base text-slate-900 dark:text-slate-100">事件详情</h2>
              </div>
              <button className="ops-button-secondary px-2 py-1" onClick={() => setSelectedAlertId(null)} title="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_VISUAL[Math.max(2, selectedAlert.backendLevel) as 2 | 3 | 4].badge}`}>
                  L{selectedAlert.backendLevel} {BACKEND_LEVEL_META[selectedAlert.backendLevel].label}
                </span>
                <span className="ops-inline-tile px-2 py-1 text-xs">{eventStateLabel(selectedAlert.eventState)}</span>
                <span className="ops-inline-tile px-2 py-1 text-xs">{selectedAlert.pumpState}</span>
              </div>
              <div className="rounded-md bg-slate-50 p-3 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
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
                  <div className="mt-1 tabular-nums">L{selectedAlert.formalEvalLevel}</div>
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-[11px] ops-muted">证据摘要</div>
                <div className="mt-1 text-sm text-slate-900">{evidenceTitle(selectedAlert)}</div>
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
