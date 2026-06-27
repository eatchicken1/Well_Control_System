import { NavLink, Outlet } from 'react-router';
import { useLocation } from 'react-router';
import { LayoutDashboard, Activity, Database, Bell, Settings, Droplets, Menu, X, PanelLeftClose, PanelLeftOpen, Gauge, Clock3, RadioTower, BarChart3, Play, Pause, RotateCcw, LogOut, UserCircle, MapPinned, ChevronRight, SignalHigh, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard, end: true },
  { to: '/monitoring', label: '实时监测', icon: Activity },
  { to: '/baseline', label: '基线管理', icon: Database },
  { to: '/history', label: '历史复盘', icon: BarChart3 },
  { to: '/alerts', label: '报警管理', icon: Bell },
  { to: '/settings', label: '系统设置', icon: Settings },
];

function MobileTelemetry({
  returnResponse,
  pitGain,
  totalGas,
  backendLevel,
  activeSignals,
}: {
  returnResponse: number;
  pitGain: number;
  totalGas: number;
  backendLevel: BackendLevel;
  activeSignals: string[];
}) {
  const signalTone = (signal: string) => {
    if (!activeSignals.includes(signal) || backendLevel < 2) return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
    return backendLevel >= 4
      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200'
      : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
  };
  const items = [
    {
      label: '出口流量响应',
      value: returnResponse.toFixed(1),
      unit: '%',
      tone: signalTone('return_response'),
    },
    {
      label: '总池体积变化',
      value: pitGain.toFixed(2),
      unit: 'm3',
      tone: signalTone('pit_volume'),
    },
    {
      label: '全烃',
      value: totalGas.toFixed(2),
      unit: '%',
      tone: signalTone('total_gas'),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5 border-b border-slate-200 bg-white/95 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
      {items.map((item) => (
        <div key={item.label} className={`ops-inline-tile min-w-0 px-2 py-1.5 ${item.tone}`}>
        <div className="truncate text-[9px] opacity-60">{item.label}</div>
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-sm tabular-nums">{item.value}</span>
            <span className="text-[9px] opacity-60">{item.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function backendLevelTone(level: BackendLevel) {
  if (level >= 4) return { dot: 'bg-red-500', state: 'critical' as const, text: 'text-red-700 dark:text-red-200' };
  if (level >= 2) return { dot: level === 3 ? 'bg-orange-500' : 'bg-amber-500', state: 'warning' as const, text: 'text-amber-700 dark:text-amber-200' };
  if (level === 1) return { dot: 'bg-cyan-500', state: 'normal' as const, text: 'text-cyan-700 dark:text-cyan-200' };
  return { dot: 'bg-emerald-500', state: 'normal' as const, text: 'text-emerald-700 dark:text-emerald-200' };
}

function HeaderBackendLevelChip({ detection }: { detection: ReturnType<typeof useWellControl>['backendDetection'] }) {
  const visual = backendLevelTone(detection.publicLevel);
  const meta = BACKEND_LEVEL_META[detection.publicLevel];
  return (
    <div className="top-status-chip" title={detection.reason || meta.description}>
      <span className="text-[10px] ops-muted">报警等级</span>
      <span className={`ops-led h-2 w-2 rounded-full ${visual.dot}`} data-state={visual.state} />
      <strong className={visual.text}>L{detection.publicLevel}</strong>
      <span>{meta.shortLabel}</span>
    </div>
  );
}

function BackendLevelDots({ level, collapsed }: { level: BackendLevel; collapsed?: boolean }) {
  return (
    <div className={`control-tower-level-mini ${collapsed ? 'control-tower-level-mini-collapsed' : 'control-tower-level-inline'}`} title={`L${level} ${BACKEND_LEVEL_META[level].label}`}>
      L{level}
    </div>
  );
}

function DataSourcePill({
  state,
}: {
  state: ReturnType<typeof useWellControl>['dataSourceState'];
}) {
  const tone = state.status === 'connected'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-200'
    : state.status === 'connecting'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-200'
      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  return (
    <div className={`top-data-source hidden max-w-[230px] items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs md:flex ${tone}`} title={state.endpoint || state.message}>
      <RadioTower className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="truncate">{state.status === 'connected' ? '真实数据' : '数据源'}</div>
        <div className="truncate text-[10px] opacity-70">{state.status === 'connected' ? '已连接' : state.status === 'connecting' ? '接入中' : state.status === 'paused' ? '待启动' : '离线'} · {state.recordCount}</div>
      </div>
    </div>
  );
}

function qualityTone(grade?: string) {
  const normalized = String(grade || '').toUpperCase();
  if (normalized === 'A') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200';
  if (normalized === 'B') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200';
  if (normalized === 'C') return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/20 dark:text-orange-200';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
}

function statusLabel(status: string) {
  if (status === 'connected') return '在线';
  if (status === 'connecting') return '接入中';
  if (status === 'paused') return '待启动';
  if (status === 'error') return '离线';
  return '未知';
}

function WellFleetStrip() {
  const { wells, wellRuntimeStates, selectedWellId, selectWell } = useWellControl();
  const fleetStats = useMemo(() => {
    const total = wells.length;
    const running = Object.values(wellRuntimeStates).filter((item) => item.isRunning).length;
    const connected = Object.values(wellRuntimeStates).filter((item) => item.status === 'connected').length;
    const warnings = Object.values(wellRuntimeStates).filter((item) => Number(item.backendLevel) >= 2).length;
    return { total, running, connected, warnings };
  }, [wellRuntimeStates, wells.length]);

  return (
    <div className="hidden border-b border-slate-200 bg-white/90 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/90 lg:block">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <MapPinned className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
          井群
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{fleetStats.total}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200">
          <SignalHigh className="h-3.5 w-3.5" />
          在线 {fleetStats.connected}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          运行 {fleetStats.running}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          预警 {fleetStats.warnings}
        </div>
        <div className="ops-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {wells.map((well) => {
            const runtime = wellRuntimeStates[well.wellId];
            const selected = selectedWellId === well.wellId;
            const backendLevel = runtime?.backendLevel ?? 0;
            const dotTone = backendLevel >= 4 ? 'bg-red-500' : backendLevel >= 2 ? 'bg-amber-500' : runtime?.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400';
            const gradeTone = qualityTone(well.qualityGrade);
            return (
              <button
                key={well.wellId}
                type="button"
                onClick={() => selectWell(well.wellId)}
                className={`flex min-w-[210px] items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${selected ? 'border-cyan-300 bg-cyan-50/80 text-slate-900 dark:border-cyan-700/70 dark:bg-cyan-950/25 dark:text-slate-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'}`}
                title={`${well.wellName} · ${well.block || '实时监测井'} · ${statusLabel(runtime?.status || 'paused')}`}
              >
                <span className={`ops-led h-2.5 w-2.5 shrink-0 rounded-full ${dotTone}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{well.wellName}</span>
                  <span className="block truncate text-[10px] ops-muted">{well.block || '实时监测井'} · {well.recordCount?.toLocaleString('zh-CN') || runtime?.recordCount?.toLocaleString('zh-CN') || 0} 条</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${gradeTone}`}>Q{well.qualityGrade || 'UNK'}</span>
                  <span className="text-[10px] ops-muted">{statusLabel(runtime?.status || 'paused')}</span>
                </span>
                {selected && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-300" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OperationsStrip({
  alertStatus,
  isRunning,
  unacknowledgedCount,
  latestSampleTime,
  flowPointCount,
  historyCount,
  wellLabel,
  baselineQuality,
}: {
  alertStatus: 'normal' | 'warning' | 'critical';
  isRunning: boolean;
  unacknowledgedCount: number;
  latestSampleTime: string | null;
  flowPointCount: number;
  historyCount: number;
  wellLabel: string;
  baselineQuality: number;
}) {
  const riskText = alertStatus === 'critical' ? '红色风险' : alertStatus === 'warning' ? '预警复核' : '监测稳定';
  const sampleText = latestSampleTime ? `${latestSampleTime} · ${flowPointCount} 点` : '建立中 · 0 点';
  const collectorText = isRunning ? `采集中 · ${sampleText}` : `已暂停 · ${sampleText}`;
  const riskTone = alertStatus === 'critical'
    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-200'
    : alertStatus === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200';

  const items = [
    { label: '井场', value: wellLabel, icon: Gauge, tone: '', width: 'min-w-[150px] flex-[1.1]' },
    { label: '采集', value: collectorText, icon: RadioTower, tone: isRunning ? 'text-emerald-700 dark:text-emerald-200' : 'text-amber-700 dark:text-amber-200', width: 'min-w-[176px] flex-[1.35]' },
    { label: '基线', value: `${baselineQuality.toFixed(0)}% · ${historyCount} 条`, icon: Database, tone: historyCount > 0 ? '' : 'text-slate-500 dark:text-slate-400', width: 'min-w-[116px] flex-[0.72]' },
    { label: '未确认', value: `${unacknowledgedCount} 条`, icon: Bell, tone: unacknowledgedCount > 0 ? 'text-red-700 dark:text-red-200' : '', width: 'min-w-[96px] flex-[0.62]' },
    { label: '报警等级', value: riskText, icon: Clock3, tone: alertStatus === 'critical' ? 'text-red-700 dark:text-red-200' : '', width: 'min-w-[112px] flex-[0.76]' },
  ];

  return (
    <div className="hidden min-w-0 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-950/95 lg:block">
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${riskTone}`}>
          <span className={`ops-led h-2 w-2 rounded-full ${
            alertStatus === 'critical' ? 'bg-red-500' : alertStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
          }`} data-state={alertStatus} />
          {riskText}
        </div>
        <div className="ops-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto xl:overflow-hidden">
          {items.map(({ label, value, icon: Icon, tone, width }) => (
            <div key={label} className={`ops-inline-tile flex ${width} min-w-0 items-center gap-1.5 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200`}>
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
              <span className={`ml-auto truncate tabular-nums text-slate-900 dark:text-slate-100 ${tone}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('wcs-sidebar-collapsed') === 'true');
  const {
    alertStatus,
    alerts,
    isRunning,
    setIsRunning,
    handleReset,
    currentData,
    backendDetection,
    shutInActive,
    shutInStartedAt,
    flowHistory,
    historyRecords,
    wells,
    selectedWellId,
    selectWell,
    wellInfo,
    baselineInfo,
    dataSourceState,
    startOptions,
    selectedStartFrame,
    selectedStartTime,
    currentSampleTime,
    timeBounds,
    selectStartFrame,
    updateSelectedStartTime,
  } = useWellControl();
  const currentWellAlerts = alerts.filter((a) => !a.wellId || a.wellId === selectedWellId);
  const unacknowledgedCount = currentWellAlerts.filter((a) => !a.acknowledged && (a.level === 'critical' || a.level === 'warning')).length;
  const latestSampleTime = flowHistory.at(-1)?.time ?? historyRecords.at(-1)?.time ?? null;

  const statusColors = {
    normal: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  };
  const backendMeta = BACKEND_LEVEL_META[backendDetection.publicLevel];
  const sidebarWidth = sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[232px]';
  const isMonitoringRoute = location.pathname === '/monitoring';
  const startSelectValue = startOptions.some((item) => item.frame === selectedStartFrame) ? String(selectedStartFrame) : '';
  const selectedStartOption = startOptions.find((item) => item.frame === selectedStartFrame);
  const mobileStartLabel = selectedStartOption?.label || (selectedStartTime ? selectedStartTime.replace('T', ' ') : '选择起点');
  const canStartMonitoring = Boolean(selectedStartTime);
  const startDisabled = !isRunning && !canStartMonitoring;
  const actionLabel = isRunning ? '暂停监测' : canStartMonitoring ? '开始监测' : '先选时间';
  const actionTone = isRunning ? 'ops-button-secondary' : startDisabled ? 'ops-button-disabled' : 'ops-button-primary';
  const currentWellBadge = `${wellInfo.wellName} · ${wellInfo.block || '实时监测井'}`;

  useEffect(() => {
    localStorage.setItem('wcs-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileControlsOpen(false);
  }, [location.pathname]);

  return (
    <div className="ops-shell">
    <div className="ops-stage flex h-screen overflow-hidden text-slate-900 transition-colors">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        data-collapsed={sidebarCollapsed ? 'true' : undefined}
        className={`control-tower-sidebar fixed lg:static inset-y-0 left-0 z-30 w-64 ${sidebarWidth} flex flex-col transition-[width,transform] duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
          <div className={`control-tower-logo-row relative z-10 flex items-center gap-3 border-b ${sidebarCollapsed ? 'control-tower-logo-row-collapsed px-3 py-3.5 justify-center' : 'px-4 py-3.5'}`}>
          <div className="control-tower-logo flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div className={`min-w-0 ${sidebarCollapsed ? 'hidden' : ''}`}>
            <div className="truncate text-sm font-semibold tracking-[0.02em]">井控溢流监测</div>
            <div className="text-[11px] text-cyan-100/72">实时报警判级</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status badge */}
        <div className={`control-tower-status-wrap relative z-10 border-b ${sidebarCollapsed ? 'px-3 py-3' : 'px-3 py-3'}`}>
          <div className={`control-tower-status-card rounded-md border p-2 shadow-inner ${sidebarCollapsed ? 'control-tower-status-card-collapsed flex justify-center' : ''}`}>
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className={`ops-led h-2.5 w-2.5 rounded-full ${statusColors[alertStatus]}`} data-state={alertStatus} />
              <span className={`text-xs text-slate-700 ${sidebarCollapsed ? 'hidden' : ''}`}>L{backendDetection.publicLevel} {backendMeta.shortLabel}</span>
              {!isRunning && !sidebarCollapsed && <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">暂停</span>}
            </div>
            <BackendLevelDots level={backendDetection.publicLevel} collapsed={sidebarCollapsed} />
          </div>
          {shutInActive && !sidebarCollapsed && (
            <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
              处置记录 {shutInStartedAt || '--:--:--'}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`control-tower-nav relative z-10 flex-1 px-2.5 py-4 ${sidebarCollapsed ? 'control-tower-nav-collapsed' : ''}`}>
          <div className={`control-tower-section-label mb-2 text-[10px] uppercase tracking-[0.18em] ${sidebarCollapsed ? 'hidden' : 'px-2'}`}>
            控制模块
          </div>
          <div className={`control-tower-nav-stack relative space-y-2 ${sidebarCollapsed ? 'space-y-3' : ''}`}>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `control-tower-nav-link group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors relative ${sidebarCollapsed ? 'control-tower-nav-link-collapsed justify-center' : ''} ${isActive ? 'control-tower-active' : ''} ${
                    isActive ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
              title={sidebarCollapsed ? label : undefined}
            >
              {({ isActive }) => (
                <div className="contents" data-active={isActive}>
                  <span className={`control-tower-nav-icon relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border ${
                    isActive ? 'border-red-300 bg-red-500 text-white' : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-900'
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={`min-w-0 flex-1 ${sidebarCollapsed ? 'hidden' : ''}`}>
                    <span className="flex items-center gap-2">
                      <span className="block truncate">{label}</span>
                    </span>
                  </span>
                  {label === '报警管理' && unacknowledgedCount > 0 && (
                    <span className={`control-tower-nav-badge ${sidebarCollapsed ? 'control-tower-nav-badge-collapsed absolute right-0.5 top-0.5' : ''} flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white`}>
                      {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
          </div>
        </nav>

        <div className={`control-tower-footer relative z-10 border-t text-xs ${sidebarCollapsed ? 'px-3 py-4 text-center' : 'px-4 py-3'}`}>
          {sidebarCollapsed ? 'WCS' : (
            <div className="flex items-center justify-between gap-2">
              <span>WCS v1.0</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="app-topbar flex flex-shrink-0 items-center gap-3">
          <button className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setSidebarOpen(true)} title="打开导航">
            <Menu className="w-5 h-5" />
          </button>
          <button
            className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? '展开导航' : '收缩导航'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">井控溢流监测系统</div>
            <div className="truncate text-[11px] text-slate-500">{wellInfo.wellName} · {location.pathname === '/' ? '多井总览' : navItems.find((item) => item.to === location.pathname)?.label || '业务页面'}</div>
          </div>
          <div className="flex-1" />
          <div className="top-user-chip hidden items-center gap-2 md:flex" title={user?.username || '当前用户'}>
            <UserCircle className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">{user?.displayName || user?.username || 'operator'}</span>
          </div>
          <button onClick={() => void logout()} className="ops-button-secondary topbar-icon-action" title="退出登录">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page content */}
        <main className={`ops-scroll flex-1 p-3 lg:p-4 ${isMonitoringRoute ? 'overflow-auto lg:overflow-hidden' : 'overflow-auto'}`} data-current-sample-time={currentSampleTime}>
          <Outlet />
        </main>
      </div>
    </div>
    </div>
  );
}
