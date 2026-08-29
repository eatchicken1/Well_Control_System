import { useNavigate } from 'react-router';
import { LayoutDashboard, RadioTower, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useWellControl } from '../context/WellControlContext';

function safeLevel(value: unknown) {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level : 0;
}

function statusLabel(status?: string, backendStatus?: string) {
  if (backendStatus === 'Stopped') return '后端已停止';
  if (backendStatus === 'Recovering') return '后端恢复中';
  if (backendStatus === 'Faulted') return '后端故障';
  if (status === 'connected') return '在线';
  if (status === 'connecting') return '接入中';
  if (status === 'reconnecting') return '重连中';
  if (status === 'catchingUp') return '补齐中';
  if (status === 'error') return '离线';
  return '待启动';
}

export interface MonitoringWellTabsExtra {
  id: string;
  label: string;
}

export function MonitoringWellTabs({
  className = '',
  rightSlot,
  extraTabs,
  activeExtraTabId,
  onExtraTabSelect,
  onWellSelect,
}: {
  className?: string;
  rightSlot?: ReactNode;
  /** Page-scoped tabs rendered after the well tabs (e.g. a global settings tab). */
  extraTabs?: MonitoringWellTabsExtra[];
  activeExtraTabId?: string | null;
  onExtraTabSelect?: (id: string) => void;
  /** Called after a well tab is selected, so pages can leave their extra tab. */
  onWellSelect?: (wellId: string) => void;
}) {
  const navigate = useNavigate();
  const { wells, monitoredWellIds, realtimeTabWellIds, selectedWellId, selectWell, wellRuntimeStates } = useWellControl();
  const tabIds = [...new Set([
    ...monitoredWellIds,
    ...realtimeTabWellIds,
    ...(selectedWellId ? [selectedWellId] : []),
  ])];
  const tabs = tabIds
    .map((wellId) => wells.find((well) => well.wellId === wellId))
    .filter((well): well is NonNullable<typeof well> => well !== undefined);
  const hasExtraTabs = Boolean(extraTabs?.length);

  if (tabs.length === 0 && !hasExtraTabs) {
    return (
      <div className={`monitoring-tabbar ${className}`} role="region" aria-label="监测井选择">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">暂无监测井</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">请选择已纳入监测的井</div>
        </div>
        <div className="monitoring-tabbar-actions">
          {rightSlot}
          <button type="button" onClick={() => navigate('/')} className="ops-button-primary px-3 py-2 text-xs" aria-label="返回总览选择监测井">
            <LayoutDashboard className="h-4 w-4" />
            返回总览
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`monitoring-tabbar ${className}`} role="region" aria-label="监测井选择">
      <div className="ops-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {tabs.map((well) => {
          const runtime = wellRuntimeStates[well.wellId];
          const extraActive = Boolean(activeExtraTabId);
          const active = selectedWellId === well.wellId && !extraActive;
          const level = safeLevel(runtime?.backendLevel);
          const status = statusLabel(runtime?.status, runtime?.backendRuntimeStatus);
          // Alarm colours always win over connection state so a well that
          // reached L2+ stays visible; everything else follows the runtime.
          const backendStopped = runtime?.backendRuntimeStatus === 'Stopped' || runtime?.isBackendRunning === false;
          const dot = level >= 4
            ? 'bg-red-500'
            : level === 3
              ? 'bg-orange-500'
              : level === 2
                ? 'bg-amber-500'
                : backendStopped
                  ? 'bg-slate-400'
                  : runtime?.status === 'connected'
                    ? 'bg-emerald-500'
                    : runtime?.status === 'connecting' || runtime?.status === 'reconnecting' || runtime?.status === 'catchingUp'
                      ? 'bg-cyan-500'
                      : 'bg-slate-400';
          return (
            <button
              key={well.wellId}
              type="button"
              onClick={() => {
                selectWell(well.wellId);
                onWellSelect?.(well.wellId);
              }}
              aria-pressed={active}
              aria-label={`切换到 ${well.wellName}，当前状态 ${status}，报警等级 L${level}`}
              className={`monitoring-tab ${active ? 'monitoring-tab-active' : ''}`}
              title={`${well.wellName} · ${status} · L${level}`}
            >
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <span className="truncate">{well.wellName}</span>
              <span className="monitoring-tab-level">L{level}</span>
            </button>
          );
        })}
        {tabs.length === 0 && hasExtraTabs && (
          <span className="flex items-center px-1 text-xs text-slate-500 dark:text-slate-400">暂无监测井</span>
        )}
        {(extraTabs || []).map((extra) => {
          const extraActive = activeExtraTabId === extra.id;
          return (
            <button
              key={extra.id}
              type="button"
              onClick={() => onExtraTabSelect?.(extra.id)}
              aria-pressed={extraActive}
              className={`monitoring-tab ${extraActive ? 'monitoring-tab-active' : ''}`}
              title={extra.label}
            >
              <Settings2 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="truncate">{extra.label}</span>
            </button>
          );
        })}
      </div>
      <div className="monitoring-tabbar-actions">
        <div className="hidden items-center gap-1.5 text-xs text-slate-500 lg:flex">
          <RadioTower className="h-3.5 w-3.5" />
          {tabs.length} 口井
        </div>
        {rightSlot}
      </div>
    </div>
  );
}
