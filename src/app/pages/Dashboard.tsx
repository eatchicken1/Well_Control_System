import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pause,
  PauseCircle,
  Play,
  PlayCircle,
  RadioTower,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useWellControl, type Alert, type BackendLevel, type WellInfo, type WellRuntimeState } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';

function levelTone(level: BackendLevel) {
  if (level >= 4) return 'dashboard-chip-danger';
  if (level >= 2) return 'dashboard-chip-warn';
  return 'dashboard-chip-ok';
}

function levelLabel(level: BackendLevel) {
  return `L${level} ${BACKEND_LEVEL_META[level].shortLabel}`;
}

function statusLabel(runtime?: WellRuntimeState) {
  if (runtime?.status === 'connected') return '监测中';
  if (runtime?.status === 'connecting') return '接入中';
  if (runtime?.status === 'error') return '离线';
  return '待启动';
}

function runtimeDot(runtime?: WellRuntimeState) {
  if (Number(runtime?.backendLevel) >= 4) return 'bg-red-500';
  if (Number(runtime?.backendLevel) >= 2) return 'bg-amber-500';
  if (runtime?.status === 'connected') return 'bg-emerald-500';
  if (runtime?.status === 'connecting') return 'bg-cyan-500';
  return 'bg-slate-400';
}

function formatNumber(value?: number, unit = '') {
  if (!Number.isFinite(value)) return '--';
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}${unit}`;
}

function formatDuration(startedAt?: string | null, running?: boolean, tick = Date.now()) {
  if (!startedAt || !running) return '--';
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return '--';
  const seconds = Math.max(0, Math.floor((tick - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

function formatConnectionHint(runtime?: WellRuntimeState) {
  if (!runtime) return '等待启动';
  if (runtime.status === 'connected') return runtime.message || `已接收 ${runtime.recordCount} 帧`;
  if (runtime.status === 'connecting') return runtime.message || '正在接入检测流';
  if (runtime.status === 'paused') return runtime.message || '已暂停';
  if (runtime.status === 'error') return runtime.message || '连接异常';
  return runtime.message || '待启动';
}

function wellLayer(well: WellInfo) {
  return well.blockName || well.block?.replace(' · MySQL', '') || '实时监测层段';
}

function WellSelector() {
  const { wells, monitoredWellIds, toggleMonitoredWell } = useWellControl();
  const selected = new Set(monitoredWellIds);

  return (
    <section className="ops-panel multiwell-selector p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="ops-eyebrow">井选择</div>
          <h1 className="ops-title">多井监控总览</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
          <RadioTower className="h-3.5 w-3.5 text-teal-700" />
          已选择 {monitoredWellIds.length} / {wells.length}
        </div>
      </div>
      <div className="multiwell-search-row">
        <div className="multiwell-search-box">
          <Search className="h-4 w-4 text-slate-400" />
          <span>选择需要进入监测的井</span>
        </div>
        <div className="ops-scroll multiwell-picker-list">
          {wells.map((well) => (
            <button
              key={well.wellId}
              type="button"
              onClick={() => toggleMonitoredWell(well.wellId)}
              className={`multiwell-picker-item ${selected.has(well.wellId) ? 'multiwell-picker-active' : ''}`}
              title={`${well.wellName} · ${wellLayer(well)}`}
            >
              <span className="truncate">{well.wellName}</span>
              <span className="text-[10px] opacity-65">{well.qualityGrade && well.qualityGrade !== 'UNKNOWN' ? `Q${well.qualityGrade}` : '实时'}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MonitoredWellCard({
  well,
  runtime,
  current,
  alert,
}: {
  well: WellInfo;
  runtime?: WellRuntimeState;
  current: ReturnType<typeof useWellControl>['currentData'];
  alert?: Alert;
}) {
  const navigate = useNavigate();
  const {
    selectedWellId,
    currentSampleTime,
    openRealtimeWell,
    startWellMonitoring,
    stopWellMonitoring,
    resumeWellMonitoring,
    removeMonitoredWell,
  } = useWellControl();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!runtime?.isRunning) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runtime?.isRunning]);
  const isActiveWell = selectedWellId === well.wellId;
  const level = (runtime?.backendLevel ?? (isActiveWell ? current.confidenceLevel : 0)) as BackendLevel;
  const isRunning = Boolean(runtime?.isRunning || (isActiveWell && runtime?.status === 'connected'));
  const isConnecting = runtime?.status === 'connecting';
  const canStop = isRunning || isConnecting;
  const hasStarted = Boolean(runtime?.monitoringStartedAt || runtime?.startedSampleTime || runtime?.recordCount);
  const bitDepth = isActiveWell ? current.bitDepth : alert?.bitDepth ?? well.depth - 28;
  const latestTime = isActiveWell ? currentSampleTime || runtime?.lastRecordAt : runtime?.lastRecordAt || alert?.time;
  const warningText = alert ? '有预警事件' : level >= 2 ? '预警跟踪' : '未见预警';

  const enterRealtime = () => {
    openRealtimeWell(well.wellId);
    navigate('/monitoring');
  };

  const startOrResume = () => {
    startWellMonitoring(well.wellId);
  };

  return (
    <article className={`multiwell-card ${level >= 4 ? 'multiwell-card-critical' : level >= 2 ? 'multiwell-card-warning' : ''}`}>
      <div className="multiwell-card-top">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`ops-led h-2.5 w-2.5 shrink-0 rounded-full ${runtimeDot(runtime)}`} />
            <h2 className="truncate text-lg font-semibold text-slate-950">{well.wellName}</h2>
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">{well.wellId} · {wellLayer(well)}</div>
        </div>
        <div className="multiwell-card-status">
          <span className={`dashboard-chip ${levelTone(level)}`}>{levelLabel(level)}</span>
          <span className="dashboard-chip">{statusLabel(runtime)}</span>
        </div>
        <button type="button" onClick={() => removeMonitoredWell(well.wellId)} className="multiwell-icon-button" title="移出监测">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="multiwell-card-metric">
          <span>最新样本</span>
          <strong>{latestTime || well.sampleStartTime || '--'}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>报警状态</span>
          <strong className={level >= 4 ? 'text-red-700' : level >= 2 ? 'text-amber-700' : 'text-emerald-700'}>{warningText}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>井深</span>
          <strong>{formatNumber(well.depthMaxM || well.depth, ' m')}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>钻头位置</span>
          <strong>{formatNumber(bitDepth, ' m')}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>层位</span>
          <strong>{wellLayer(well)}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>数据量</span>
          <strong>{(runtime?.recordCount || well.recordCount || 0).toLocaleString('zh-CN')}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>监测时长</span>
          <strong>{formatDuration(runtime?.monitoringStartedAt, isRunning, now)}</strong>
        </div>
        <div className="multiwell-card-metric">
          <span>监测起点</span>
          <strong>{runtime?.startedSampleTime || '--'}</strong>
        </div>
      </div>

      <div className={`multiwell-card-progress ${isConnecting ? 'multiwell-card-progress-live' : ''}`}>
        <span className={`ops-led h-2 w-2 rounded-full ${runtimeDot(runtime)}`} />
        <span className="truncate">{formatConnectionHint(runtime)}</span>
      </div>

      <div className="multiwell-card-toolbar">
        <button type="button" onClick={startOrResume} disabled={isRunning} className="ops-button-primary multiwell-card-action multiwell-card-action-primary" title="自动选择现场发现前 1 小时并开始监测">
          {isRunning ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          {isConnecting ? '接入中' : isRunning ? '监测中' : '自动监测'}
        </button>
        <button
          type="button"
          onClick={() => stopWellMonitoring(well.wellId)}
          disabled={!canStop}
          className={`multiwell-card-action multiwell-stop-action ${canStop ? 'multiwell-stop-action-live' : ''}`}
          title={canStop ? '明确停止当前井监测并写入会话状态' : '当前井未接入监测流'}
        >
          <Square className="h-4 w-4" />
          停止监测
        </button>
        <button type="button" onClick={() => resumeWellMonitoring(well.wellId)} disabled={!hasStarted || isRunning} className="ops-button-secondary multiwell-card-action" title={isRunning ? '实时监测进行中，前端不可暂停' : '按上次起点继续监测'}>
          {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isRunning ? '持续监测' : '继续监测'}
        </button>
        <button type="button" onClick={enterRealtime} className="ops-button-secondary multiwell-card-action">
          <ArrowRight className="h-4 w-4" />
          实时监测
        </button>
      </div>
    </article>
  );
}

function EventOverview({ selectedAlerts }: { selectedAlerts: Alert[] }) {
  const navigate = useNavigate();
  const visible = selectedAlerts.slice(0, 8);
  const level4 = selectedAlerts.filter((alert) => alert.backendLevel >= 4).length;
  const level23 = selectedAlerts.filter((alert) => alert.backendLevel >= 2 && alert.backendLevel < 4).length;

  return (
    <aside className="ops-panel multiwell-event-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="ops-eyebrow">事件</div>
          <h2 className="dashboard-section-title">事件总览</h2>
        </div>
        <div className="flex gap-1.5 text-xs">
          <span className="dashboard-chip dashboard-chip-danger">L4 {level4}</span>
          <span className="dashboard-chip dashboard-chip-warn">L2-L3 {level23}</span>
        </div>
      </div>

      <div className="ops-scroll multiwell-event-list">
        {visible.length === 0 ? (
          <div className="ops-empty-state min-h-[220px]">
            <div>
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
              <div className="text-sm text-slate-700">暂无事件</div>
              <div className="mt-1 text-xs text-slate-500">已选井未收到预警事件</div>
            </div>
          </div>
        ) : (
          visible.map((alert) => (
            <button key={alert.id} type="button" onClick={() => navigate('/alerts')} className={`multiwell-event-card ${alert.backendLevel >= 4 ? 'multiwell-event-critical' : 'multiwell-event-warning'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{alert.wellName || alert.wellId || '当前井'}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{alert.date} {alert.time}</div>
                </div>
                <span className={`dashboard-chip ${levelTone(alert.backendLevel)}`}>
                  L{alert.backendLevel}{(alert.peakBackendLevel ?? alert.backendLevel) > alert.backendLevel ? ` / 峰L${alert.peakBackendLevel}` : ''}
                </span>
              </div>
              <div className="mt-2 line-clamp-2 text-xs text-slate-700">{alert.message}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <span>井深 {formatNumber(alert.wellDepth, ' m')}</span>
                <span>钻头 {formatNumber(alert.bitDepth, ' m')}</span>
                <span className="col-span-2 truncate">层位 {alert.formation || alert.wellBlock || '--'}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <button type="button" onClick={() => navigate('/alerts')} className="mt-3 w-full ops-button-secondary px-3 py-2 text-xs">
        查看报警管理
      </button>
    </aside>
  );
}

export default function Dashboard() {
  const { wells, monitoredWellIds, wellRuntimeStates, alerts, currentData } = useWellControl();
  const monitoredWells = useMemo(
    () => monitoredWellIds.map((wellId) => wells.find((well) => well.wellId === wellId)).filter(Boolean) as WellInfo[],
    [monitoredWellIds, wells],
  );
  const monitoredSet = useMemo(() => new Set(monitoredWellIds), [monitoredWellIds]);
  const selectedAlerts = useMemo(
    () => alerts.filter((alert) => !alert.wellId || monitoredSet.has(alert.wellId)),
    [alerts, monitoredSet],
  );

  return (
    <div className="ops-page multiwell-dashboard space-y-3">
      <WellSelector />

      <div className="multiwell-dashboard-grid">
        <section className="min-w-0 space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="multiwell-summary-tile">
              <Activity className="h-4 w-4 text-teal-700" />
              <span>已选井</span>
              <strong>{monitoredWells.length}</strong>
            </div>
            <div className="multiwell-summary-tile">
              <RadioTower className="h-4 w-4 text-emerald-700" />
              <span>监测中</span>
              <strong>{Object.values(wellRuntimeStates).filter((item) => monitoredSet.has(item.wellId) && item.isRunning).length}</strong>
            </div>
            <div className="multiwell-summary-tile">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <span>事件</span>
              <strong>{selectedAlerts.length}</strong>
            </div>
          </div>

          {monitoredWells.length === 0 ? (
            <div className="ops-panel ops-empty-state min-h-[340px]">
              <div>
                <RadioTower className="mx-auto mb-3 h-7 w-7 text-slate-400" />
                <div className="text-sm text-slate-700">请选择需要进入监测的井</div>
              </div>
            </div>
          ) : (
            <div className="multiwell-card-grid">
              {monitoredWells.map((well) => {
                const alert = selectedAlerts.find((item) => item.wellId === well.wellId);
                return (
                  <MonitoredWellCard
                    key={well.wellId}
                    well={well}
                    runtime={wellRuntimeStates[well.wellId]}
                    current={currentData}
                    alert={alert}
                  />
                );
              })}
            </div>
          )}
        </section>

        <EventOverview selectedAlerts={selectedAlerts} />
      </div>

    </div>
  );
}
