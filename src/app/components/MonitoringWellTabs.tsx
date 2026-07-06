import { useNavigate } from 'react-router';
import { LayoutDashboard, RadioTower } from 'lucide-react';
import type { ReactNode } from 'react';
import { useWellControl } from '../context/WellControlContext';

function safeLevel(value: unknown) {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level : 0;
}

function statusLabel(status?: string) {
  if (status === 'connected') return '在线';
  if (status === 'connecting') return '接入中';
  if (status === 'error') return '离线';
  return '待启动';
}

export function MonitoringWellTabs({ className = '', rightSlot }: { className?: string; rightSlot?: ReactNode }) {
  const navigate = useNavigate();
  const { wells, monitoredWellIds, realtimeTabWellIds, selectedWellId, selectWell, wellRuntimeStates } = useWellControl();
  const tabIds = [...new Set([
    ...monitoredWellIds,
    ...realtimeTabWellIds,
    ...(selectedWellId ? [selectedWellId] : []),
  ])];
  const tabs = tabIds.map((wellId) => wells.find((well) => well.wellId === wellId)).filter(Boolean);

  if (tabs.length === 0) {
    return (
      <div className={`monitoring-tabbar ${className}`} role="region" aria-label="监测井选择">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">监测井卡片</div>
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
          const active = selectedWellId === well.wellId;
          const level = safeLevel(runtime?.backendLevel);
          const status = statusLabel(runtime?.status);
          const dot = level >= 4 ? 'bg-red-500' : level >= 2 ? 'bg-amber-500' : runtime?.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400';
          return (
            <button
              key={well.wellId}
              type="button"
              onClick={() => selectWell(well.wellId)}
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
