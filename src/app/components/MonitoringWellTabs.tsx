import { useNavigate } from 'react-router';
import { LayoutDashboard, RadioTower } from 'lucide-react';
import { useWellControl } from '../context/WellControlContext';

export function MonitoringWellTabs() {
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
      <div className="monitoring-tabbar">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">监测井卡片</div>
          <div className="mt-0.5 text-xs text-slate-500">请选择已纳入监测的井</div>
        </div>
        <button type="button" onClick={() => navigate('/')} className="ops-button-primary px-3 py-2 text-xs">
          <LayoutDashboard className="h-4 w-4" />
          返回总览
        </button>
      </div>
    );
  }

  return (
    <div className="monitoring-tabbar">
      <div className="ops-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {tabs.map((well) => {
          const runtime = wellRuntimeStates[well.wellId];
          const active = selectedWellId === well.wellId;
          const level = runtime?.backendLevel ?? 0;
          const dot = level >= 4 ? 'bg-red-500' : level >= 2 ? 'bg-amber-500' : runtime?.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400';
          return (
            <button
              key={well.wellId}
              type="button"
              onClick={() => selectWell(well.wellId)}
              className={`monitoring-tab ${active ? 'monitoring-tab-active' : ''}`}
              title={`${well.wellName} · L${level}`}
            >
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <span className="truncate">{well.wellName}</span>
              <span className="monitoring-tab-level">L{level}</span>
            </button>
          );
        })}
      </div>
      <div className="hidden items-center gap-1.5 text-xs text-slate-500 lg:flex">
        <RadioTower className="h-3.5 w-3.5" />
        {tabs.length} 口井
      </div>
    </div>
  );
}
