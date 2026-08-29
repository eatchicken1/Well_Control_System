import { NavLink, Outlet } from 'react-router';
import { useLocation } from 'react-router';
import { LayoutDashboard, Activity, Database, Bell, Settings, Droplets, Menu, X, PanelLeftClose, PanelLeftOpen, RadioTower, BarChart3, LogOut, UserCircle, ChevronRight, HardHat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';
import { LEVEL_VISUAL, safeLevel } from '../lib/levelVisual';
import { useAuth } from '../context/AuthContext';
import { AlarmEffectController } from './AlarmEffectController';

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard, end: true },
  { to: '/monitoring', label: '实时监测', icon: Activity },
  { to: '/well-management', label: '井管理', icon: HardHat },
  { to: '/baseline', label: '基线管理', icon: Database },
  { to: '/history', label: '历史复盘', icon: BarChart3 },
  { to: '/alerts', label: '报警管理', icon: Bell },
  { to: '/settings', label: '系统设置', icon: Settings },
];

function safeBackendLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

function backendLevelTone(level: BackendLevel) {
  return {
    dot: LEVEL_VISUAL[level].dot,
    state: level >= 4 ? 'critical' as const : level >= 2 ? 'warning' as const : 'normal' as const,
    text: LEVEL_VISUAL[level].text,
  };
}

function HeaderBackendLevelChip({ detection }: { detection: ReturnType<typeof useWellControl>['backendDetection'] }) {
  const level = safeBackendLevel(detection.advisoryLevel);
  const visual = backendLevelTone(level);
  const meta = BACKEND_LEVEL_META[level];
  return (
    <div className="top-status-chip" title={detection.reason || meta.description}>
      <span className="text-[10px] ops-muted">报警等级</span>
      <span className={`ops-led h-2 w-2 rounded-full ${visual.dot}`} data-state={visual.state} />
      <strong className={visual.text}>L{level}</strong>
      <span>{meta.shortLabel}</span>
    </div>
  );
}

function BackendLevelDots({ level, collapsed }: { level: unknown; collapsed?: boolean }) {
  const safeLevel = safeBackendLevel(level);
  return (
    <div className={`control-tower-level-mini ${collapsed ? 'control-tower-level-mini-collapsed' : 'control-tower-level-inline'}`} title={`L${safeLevel} ${BACKEND_LEVEL_META[safeLevel].label}`}>
      L{safeLevel}
    </div>
  );
}

function DataSourcePill({
  state,
  isStopped = false,
}: {
  state: ReturnType<typeof useWellControl>['dataSourceState'];
  isStopped?: boolean;
}) {
  const effectiveStatus = isStopped ? 'paused' : state.status;
  const tone = isStopped
    ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    : effectiveStatus === 'connected'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-200'
    : effectiveStatus === 'connecting' || effectiveStatus === 'reconnecting' || effectiveStatus === 'catchingUp'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-200'
      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  return (
    <div className={`top-data-source hidden max-w-[230px] items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs md:flex ${tone}`} title={state.endpoint || state.message}>
      <RadioTower className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="truncate">{effectiveStatus === 'connected' ? '真实数据' : '数据源'}</div>
        <div className="truncate text-[10px] opacity-70">{isStopped ? '已停' : effectiveStatus === 'connected' ? '已连接' : effectiveStatus === 'connecting' ? '接入中' : effectiveStatus === 'reconnecting' ? '重连中' : effectiveStatus === 'catchingUp' ? '补齐中' : effectiveStatus === 'paused' ? '待启动' : '离线'} · {state.recordCount}</div>
      </div>
    </div>
  );
}

function MonitoringStatusChip({
  alertStatus,
  isRunning,
  isStopped,
}: {
  alertStatus: 'normal' | 'warning' | 'critical';
  isRunning: boolean;
  isStopped: boolean;
}) {
  const isWaiting = !isStopped && !isRunning;
  const label = isStopped
    ? '监测已停'
    : isWaiting
      ? '等待接入'
      : alertStatus === 'critical'
        ? '红色风险'
        : alertStatus === 'warning'
          ? '预警复核'
          : '监测稳定';
  const tone = isStopped || isWaiting
    ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    : alertStatus === 'critical'
      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-200'
      : alertStatus === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-200'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200';
  const led = isStopped || isWaiting
    ? 'bg-slate-400'
    : alertStatus === 'critical'
      ? 'bg-red-500'
      : alertStatus === 'warning'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className={`top-monitoring-status hidden shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs xl:flex ${tone}`} title="当前监测状态">
      <span className={`ops-led h-2 w-2 rounded-full ${led}`} data-state={isStopped ? 'stopped' : isWaiting ? 'waiting' : alertStatus} />
      <span className="hidden text-[10px] text-slate-500 dark:text-slate-400 2xl:inline">监测状态</span>
      <strong>{label}</strong>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('wcs-sidebar-collapsed') === 'true');
  const {
    alertStatus,
    alerts,
    shutInActive,
    shutInStartedAt,
    wells,
    selectedWellId,
    selectWell,
    wellInfo,
    dataSourceState,
    currentSampleTime,
    wellRuntimeStates,
    selectedWellView,
    selectedWellManuallyStopped,
  } = useWellControl();
  // Sidebar badge counts every unacknowledged L2+ event across wells: the
  // alarm queue is a fleet-wide duty list, not a per-well one.
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged && safeLevel(a.backendLevel) >= 2).length;
  const backendDetection = selectedWellView.backendDetection;
  const selectedWellRuntime = wellRuntimeStates[selectedWellId] || wellRuntimeStates[wellInfo.wellId];
  const selectedWellIsRunning = Boolean(
    !selectedWellManuallyStopped && (
    selectedWellRuntime?.isRunning
    || selectedWellRuntime?.status === 'connected'
    || selectedWellRuntime?.status === 'connecting'
    || selectedWellRuntime?.status === 'reconnecting'
    || selectedWellRuntime?.status === 'catchingUp'
    || dataSourceState.status === 'connected'
    || dataSourceState.status === 'connecting'
    || dataSourceState.status === 'reconnecting'
    || dataSourceState.status === 'catchingUp')
  );
  const backendLevel = safeLevel(backendDetection.advisoryLevel);
  const displayAlertStatus = backendLevel >= 4 ? 'critical' : backendLevel >= 2 ? 'warning' : 'normal';
  const backendMeta = BACKEND_LEVEL_META[backendLevel];
  const sidebarWidth = sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[232px]';
  const isMonitoringRoute = location.pathname === '/monitoring';
  const topbarBackendChip = <HeaderBackendLevelChip detection={backendDetection} />;
  const topbarDataChip = <DataSourcePill state={dataSourceState} isStopped={selectedWellManuallyStopped} />;

  useEffect(() => {
    localStorage.setItem('wcs-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="ops-shell">
      <AlarmEffectController alerts={alerts} />
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
          <button type="button" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)} title="关闭导航" aria-label="关闭导航">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status badge */}
        <div className={`control-tower-status-wrap relative z-10 border-b ${sidebarCollapsed ? 'px-3 py-3' : 'px-3 py-3'}`}>
          <div className={`control-tower-status-card rounded-md border p-2 shadow-inner ${sidebarCollapsed ? 'control-tower-status-card-collapsed flex justify-center' : ''}`}>
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className={`ops-led h-2.5 w-2.5 rounded-full ${LEVEL_VISUAL[backendLevel].dot}`} data-state={displayAlertStatus} />
              <span className={`text-xs text-slate-700 dark:text-slate-200 ${sidebarCollapsed ? 'hidden' : ''}`}>L{backendLevel} {backendMeta.shortLabel}</span>
              {!selectedWellIsRunning && !sidebarCollapsed && <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">{selectedWellManuallyStopped ? '已停' : '待启动'}</span>}
            </div>
            <BackendLevelDots level={backendLevel} collapsed={sidebarCollapsed} />
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
                    isActive ? 'bg-cyan-50 text-cyan-900 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-900/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                  }`
                }
                title={sidebarCollapsed ? label : undefined}
                aria-label={sidebarCollapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <div className="contents" data-active={isActive}>
                    <span className={`control-tower-nav-icon relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border ${
                      isActive ? 'border-cyan-600 bg-cyan-600 text-white dark:border-cyan-500' : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:group-hover:border-slate-600 dark:group-hover:text-slate-100'
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
        <header className={`app-topbar ${isMonitoringRoute ? 'app-topbar-monitoring' : ''} flex flex-shrink-0 flex-wrap items-center gap-3`}>
          <button type="button" className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setSidebarOpen(true)} title="打开导航" aria-label="打开导航">
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? '展开导航' : '收缩导航'}
            aria-label={sidebarCollapsed ? '展开导航' : '收缩导航'}
            aria-pressed={sidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <div className="topbar-title min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">井控溢流监测系统</div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{wellInfo.wellName} · {location.pathname === '/' ? '多井总览' : navItems.find((item) => item.to !== '/' && location.pathname.startsWith(item.to))?.label || '多井总览'}</div>
          </div>
          <div className="flex-1 min-w-0" />
          <div className="hidden min-w-0 items-center gap-2 xl:flex">
            {isMonitoringRoute && (
              <MonitoringStatusChip
                alertStatus={alertStatus}
                isRunning={selectedWellIsRunning}
                isStopped={selectedWellManuallyStopped}
              />
            )}
            {topbarDataChip}
            {topbarBackendChip}
          </div>
          <div className="top-user-chip hidden items-center gap-2 md:flex" title={user?.username || '当前用户'}>
            <UserCircle className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">{user?.displayName || user?.username || 'operator'}</span>
          </div>
          <button type="button" onClick={() => void logout()} className="ops-button-secondary topbar-icon-action" title="退出登录" aria-label="退出登录">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page content */}
        <main className={`ops-scroll flex-1 min-h-0 ${isMonitoringRoute ? 'monitoring-route-main overflow-auto lg:overflow-hidden' : 'overflow-auto p-3 lg:p-4'}`} data-current-sample-time={currentSampleTime}>
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
}
