import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Layers3,
  MapPin,
  Play,
  PlayCircle,
  RadioTower,
  Search,
  Square,
  X,
} from 'lucide-react';
import { REPLAY_SPEED_OPTIONS, useWellControl, type Alert, type BackendLevel, type MonitoringMode, type ReplaySpeed, type WellInfo, type WellRuntimeState } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';

function safeBackendLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

function levelTone(level: unknown) {
  const safeLevel = safeBackendLevel(level);
  if (safeLevel >= 4) return 'dashboard-chip-danger';
  if (safeLevel >= 2) return 'dashboard-chip-warn';
  return 'dashboard-chip-ok';
}

function levelLabel(level: unknown) {
  const safeLevel = safeBackendLevel(level);
  return `L${safeLevel} ${BACKEND_LEVEL_META[safeLevel].shortLabel}`;
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}` : '';
}

function replayDateLabel(value?: string | null) {
  return value ? value.replace('T', ' ') : '请选择时间';
}

function nextReplaySpeed(speed: ReplaySpeed): ReplaySpeed {
  const index = REPLAY_SPEED_OPTIONS.indexOf(speed);
  return REPLAY_SPEED_OPTIONS[(index + 1) % REPLAY_SPEED_OPTIONS.length] || 1;
}

function sampleTimeLabel(value?: string | null) {
  if (!value) return '--';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : value;
}

function statusLabel(runtime?: WellRuntimeState) {
  if (runtime?.status === 'connected') return '监测中';
  if (runtime?.status === 'connecting') return '接入中';
  if (runtime?.status === 'reconnecting') return '重连中';
  if (runtime?.status === 'catchingUp') return '补齐中';
  if (runtime?.status === 'error') return '离线';
  return '待启动';
}

function backendRuntimeLabel(runtime: WellRuntimeState | undefined, stopped: boolean) {
  if (stopped || runtime?.backendRuntimeStatus === 'Stopped' || runtime?.isBackendRunning === false) return '已停止';
  if (runtime?.backendRuntimeStatus === 'Recovering') return '后端恢复中';
  if (runtime?.backendRuntimeStatus === 'Faulted') return '后端故障';
  if (runtime?.backendRuntimeStatus === 'Completed') return '已完成';
  if (runtime?.isBackendRunning || runtime?.isRunning) return '持续监测中';
  return '未启动';
}

function subscriberLabel(runtime: WellRuntimeState | undefined, stopped: boolean) {
  if (stopped || runtime?.connectionStatus === 'paused' || runtime?.status === 'paused') return '前端已暂停';
  if (runtime?.isSubscriberConnected || runtime?.status === 'connected') return '前端已连接';
  if (runtime?.status === 'catchingUp') return '正在补齐';
  if (runtime?.status === 'reconnecting') return '正在重连';
  if (runtime?.status === 'connecting') return '正在接入';
  return '前端未连接';
}

function runtimeStatusTone({
  isRunning,
  isConnecting,
  isStopped,
  hasStarted,
}: {
  isRunning: boolean;
  isConnecting: boolean;
  isStopped: boolean;
  hasStarted: boolean;
}) {
  if (isStopped) return 'dashboard-chip-stopped';
  if (isConnecting) return 'dashboard-chip-connecting';
  if (isRunning) return 'dashboard-chip-live';
  if (hasStarted) return 'dashboard-chip-resume';
  return 'dashboard-chip-idle';
}

function runtimeCardStateTone({
  level,
  isRunning,
  isConnecting,
  isStopped,
}: {
  level: BackendLevel;
  isRunning: boolean;
  isConnecting: boolean;
  isStopped: boolean;
}) {
  if (level >= 4) return 'multiwell-card-critical';
  if (level >= 2) return 'multiwell-card-warning';
  if (isStopped) return 'multiwell-card-stopped';
  if (isConnecting) return 'multiwell-card-connecting';
  if (isRunning) return 'multiwell-card-live';
  return 'multiwell-card-idle';
}

function runtimeProgressTone({
  isRunning,
  isConnecting,
  isStopped,
  hasStarted,
}: {
  isRunning: boolean;
  isConnecting: boolean;
  isStopped: boolean;
  hasStarted: boolean;
}) {
  if (isConnecting) return 'multiwell-card-progress-live';
  if (isStopped) return 'multiwell-card-progress-stopped';
  if (isRunning) return 'multiwell-card-progress-running';
  if (hasStarted) return 'multiwell-card-progress-resume';
  return 'multiwell-card-progress-idle';
}

function runtimeDot(runtime?: WellRuntimeState, isStopped = false) {
  if (isStopped || runtime?.backendRuntimeStatus === 'Stopped' || runtime?.isBackendRunning === false) {
    return 'bg-slate-400';
  }
  const level = safeBackendLevel(runtime?.backendLevel);
  if (level >= 4) return 'bg-red-500';
  if (level >= 2) return 'bg-amber-500';
  if (runtime?.status === 'connected') return 'bg-emerald-500';
  if (runtime?.status === 'connecting' || runtime?.status === 'reconnecting' || runtime?.status === 'catchingUp') return 'bg-cyan-500';
  return 'bg-slate-400';
}

function formatNumber(value?: number | null, unit = '') {
  if (!Number.isFinite(value)) return '--';
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}${unit}`;
}

function firstFinite(...values: Array<number | null | undefined>) {
  return values.find((value): value is number => Number.isFinite(value));
}

function cleanLayerLabel(value?: string | null) {
  const text = String(value || '').replace(' · MySQL', '').trim();
  if (!text || text === '实时监测井' || text === '实时监测层段' || text === '实时检测' || text === '等待接入') return '';
  return text;
}

function formatConnectionHint(runtime?: WellRuntimeState) {
  if (!runtime) return '等待启动';
  if (runtime.status === 'connected') return runtime.message || `已接收 ${runtime.recordCount} 帧`;
  if (runtime.status === 'connecting') return runtime.message || '正在接入检测流';
  if (runtime.status === 'reconnecting') return runtime.message || '检测流重连中';
  if (runtime.status === 'catchingUp') return runtime.message || '正在补齐断线期间样本';
  if (runtime.status === 'paused') return runtime.message || '待启动';
  if (runtime.status === 'error') return runtime.message || '连接异常';
  return runtime.message || '待启动';
}

function dataVolumeLabel(runtime?: WellRuntimeState) {
  if (runtime?.recordCount && runtime.recordCount > 0) return '本次采样';
  return '数据库记录';
}

function sampleCountLabel(runtime?: WellRuntimeState, fallback = 0) {
  const runtimeCount = runtime?.recordCount || 0;
  if (runtimeCount > 0) return `${runtimeCount.toLocaleString('zh-CN')} 点`;
  if (fallback > 0) return `${fallback.toLocaleString('zh-CN')} 条`;
  return '--';
}

function wellLayer(well: WellInfo) {
  return cleanLayerLabel(well.targetLayer) || '--';
}

function WellSelector() {
  const { wells, monitoredWellIds, toggleMonitoredWell } = useWellControl();
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(monitoredWellIds), [monitoredWellIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleWells = normalizedQuery
    ? wells.filter((well) => {
        const searchable = [
          well.wellName,
          well.wellId,
          wellLayer(well),
          well.qualityGrade,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(normalizedQuery);
      })
    : wells;

  return (
    <section className="ops-panel multiwell-selector p-3">
      <div className="multiwell-selector-head">
        <div>
          <div className="ops-eyebrow">井选择</div>
          <h1 className="ops-title">多井监控总览</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <RadioTower className="h-3.5 w-3.5 text-teal-700" />
          已选择 {monitoredWellIds.length} / {wells.length}
        </div>
      </div>
      <div className="multiwell-search-row">
        <label className="multiwell-search-box" aria-label="筛选监测井">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            aria-label="筛选监测井"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按井名 / 井号 / 层位筛选"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} title="清空筛选" aria-label="清空井筛选条件">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <div className="ops-scroll multiwell-picker-list">
          {visibleWells.length === 0 ? (
            <div className="multiwell-picker-empty space-y-2">
              <div>未找到匹配井</div>
              {query ? (
                <button type="button" onClick={() => setQuery('')} className="ops-button-secondary mx-auto px-2.5 py-1 text-xs" aria-label="清空筛选并显示全部井">
                  <X className="h-3.5 w-3.5" />
                  清空筛选
                </button>
              ) : null}
            </div>
          ) : visibleWells.map((well) => (
            <button
              key={well.wellId}
              type="button"
              onClick={() => toggleMonitoredWell(well.wellId)}
              aria-pressed={selected.has(well.wellId)}
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
  alert,
}: {
  well: WellInfo;
  runtime?: WellRuntimeState;
  alert?: Alert;
}) {
  const navigate = useNavigate();
  const {
    selectedWellId,
    currentSampleTime,
    selectedWellView,
    openRealtimeWell,
    startWellMonitoring,
    restartWellMonitoring,
    restartHistoryReplay,
    stopWellMonitoring,
    resumeWellMonitoring,
    removeMonitoredWell,
    updateWellMonitoringMode,
    updateWellReplayStartTime,
    updateWellReplaySpeed,
    isWellManuallyStopped,
  } = useWellControl();
  const replayDateInputRef = useRef<HTMLInputElement>(null);
  const isActiveWell = selectedWellId === well.wellId;
  const activeCurrent = isActiveWell ? selectedWellView.currentData : null;
  const activeSampleTime = isActiveWell ? (selectedWellView.currentSampleTime || currentSampleTime) : currentSampleTime;
  const level = safeBackendLevel(
    runtime?.backendLevel
    ?? (isActiveWell ? selectedWellView.backendDetection.publicLevel : undefined)
    ?? alert?.backendLevel
    ?? 0,
  );
  const isStopped = isWellManuallyStopped(well.wellId);
  const isRunning = !isStopped && Boolean(runtime?.isRunning || (isActiveWell && runtime?.status === 'connected'));
  const isConnecting = !isStopped && (runtime?.status === 'connecting' || runtime?.status === 'reconnecting' || runtime?.status === 'catchingUp');
  const monitoringMode = runtime?.monitoringMode || 'realtime';
  const replaySpeed = runtime?.replaySpeed || 1;
  const replayStartValue = toDatetimeLocalValue(runtime?.selectedReplayStartTime || runtime?.startedSampleTime || well.discoveryTime || well.startTime);
  const replayMin = toDatetimeLocalValue(well.sampleStartTime || well.startTime);
  const replayMax = toDatetimeLocalValue(well.sampleEndTime || well.endTime);
  const canStop = isRunning || isConnecting;
  const canStart = !isRunning && !isConnecting;
  const canRemove = !isRunning && !isConnecting;
  const hasStarted = Boolean(runtime?.monitoringStartedAt || runtime?.startedSampleTime || runtime?.recordCount);
  const isHistoryMode = monitoringMode === 'historyReplay';
  const bitDepth = firstFinite(
    activeCurrent?.bitDepth,
    runtime?.latestBitDepth,
    alert?.bitDepth,
  );
  const wellDepth = firstFinite(
    activeCurrent?.wellDepth,
    runtime?.latestWellDepth,
    alert?.wellDepth,
    well.depthMaxM,
    well.depth,
  );
  const latestLayer = cleanLayerLabel(activeCurrent?.formation ? (selectedWellView.latestFormation || activeCurrent.formation) : undefined)
    || cleanLayerLabel(runtime?.latestFormation)
    || cleanLayerLabel(alert?.formation)
    || wellLayer(well);
  const latestTime = isActiveWell ? activeSampleTime || runtime?.lastRecordAt : runtime?.lastRecordAt || alert?.time;
  const statusText = isStopped ? '已停止' : statusLabel(runtime);
  const statusTone = runtimeStatusTone({ isRunning, isConnecting, isStopped, hasStarted });
  const cardStateTone = runtimeCardStateTone({ level, isRunning, isConnecting, isStopped });
  const progressTone = runtimeProgressTone({ isRunning, isConnecting, isStopped, hasStarted });
  const hintText = isStopped
    ? runtime?.recordCount
      ? `监测已停止 · 保留 ${runtime.recordCount.toLocaleString('zh-CN')} 点`
      : (runtime?.message || '监测已停止，保留历史点位')
    : isRunning
      ? formatConnectionHint(runtime)
      : hasStarted
        ? (isHistoryMode ? '已保留回放进度，可继续回放或重新回放' : '已停止实时监测，可重新监测')
        : formatConnectionHint(runtime);
  const stopButtonText = isStopped ? '监测已停' : canStop ? '停止监测' : '无监测可停';
  const stopButtonTitle = isStopped ? '当前井已停止监测并保留历史点位' : canStop ? '停止当前井监测并记录会话状态' : '当前井未接入监测流';
  const stopButtonLabel = isStopped ? `${well.wellName}已停止监测` : `${well.wellName}${canStop ? '停止监测' : '未接入监测流'}`;
  const startButtonText = isConnecting
    ? '接入中'
    : isRunning
      ? '监测中'
      : monitoringMode === 'historyReplay'
        ? (hasStarted ? '重新回放' : '开始回放')
        : (hasStarted ? '重新监测' : '开始监测');
  const startButtonTitle = isConnecting
    ? '正在接入检测流，请等待连接完成'
    : isRunning
      ? '当前井已在监测中'
      : monitoringMode === 'historyReplay'
        ? '从选择的历史起点创建新的回放会话'
        : (hasStarted ? '清空当前实时曲线并从最新点重新创建监测会话' : '从当前最新数据点创建新的实时监测会话');
  const startButtonLabel = `${well.wellName}${isConnecting ? '正在接入' : isRunning ? '已在监测中' : monitoringMode === 'historyReplay' ? '开始历史回放' : hasStarted ? '重新实时监测' : '开始实时监测'}`;
  const sampleCountText = sampleCountLabel(runtime, well.recordCount || 0);
  const resumeButtonText = '继续回放';
  const hasResumableHistorySession = isHistoryMode && canStart && hasStarted && Boolean(runtime?.sessionCode);
  const showResumeButton = hasResumableHistorySession;
  const showAutoStartButton = canStart && (!isHistoryMode || !hasStarted || !runtime?.sessionCode);
  const showHistoryRestartButton = hasResumableHistorySession;
  const showStopButton = canStop;
  const primaryAction = showResumeButton
    ? {
      text: resumeButtonText,
      Icon: Play,
      onClick: () => resumeWellMonitoring(well.wellId),
      disabled: !hasStarted,
      title: hasStarted ? '按上次进度继续回放' : '当前井还没有可继续的回放进度',
      ariaLabel: well.wellName + (hasStarted ? '按上次进度继续回放' : '没有可继续的回放进度'),
    }
    : {
      text: startButtonText,
      Icon: PlayCircle,
      onClick: () => (isHistoryMode ? startWellMonitoring(well.wellId) : (hasStarted ? restartWellMonitoring(well.wellId) : startWellMonitoring(well.wellId))),
      disabled: !canStart || isRunning || isConnecting,
      title: startButtonTitle,
      ariaLabel: startButtonLabel,
    };
  const PrimaryActionIcon = primaryAction.Icon;
  const metricItems = [
    { label: '井深', value: formatNumber(wellDepth, ' m'), Icon: Activity, emphasis: true },
    { label: '钻头位置', value: formatNumber(bitDepth, ' m'), Icon: MapPin },
    { label: '层位', value: latestLayer, Icon: Layers3 },
    { label: dataVolumeLabel(runtime), value: sampleCountText, Icon: Database, emphasis: true },
  ];

  const enterRealtime = () => {
    openRealtimeWell(well.wellId);
    navigate('/monitoring');
  };

  const changeMode = (value: string) => {
    updateWellMonitoringMode(well.wellId, value as MonitoringMode);
  };

  const openReplayDatePicker = () => {
    const input = replayDateInputRef.current;
    if (!input || input.disabled) return;
    input.focus();
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    try {
      pickerInput.showPicker?.();
    } catch {
      // Browsers that do not allow showPicker still open the control on focus.
    }
  };

  const cycleReplaySpeed = () => {
    updateWellReplaySpeed(well.wellId, nextReplaySpeed(replaySpeed));
  };

  return (
    <article className={`multiwell-card ${cardStateTone}`}>
      <div className="multiwell-card-top">
        <div className="multiwell-card-identity min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`multiwell-card-led ${runtimeDot(runtime, isStopped)}`} />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{well.wellName}</h2>
          </div>
          <div className="multiwell-card-subtitle mt-1 text-xs text-slate-500 dark:text-slate-400">{well.wellId} · {wellLayer(well)}</div>
        </div>
        <div className="multiwell-card-status">
          <span className={`dashboard-chip ${levelTone(level)}`}>{levelLabel(level)}</span>
          <span className={`dashboard-chip ${statusTone}`}>{statusText}</span>
        </div>
        <button
          type="button"
          onClick={() => removeMonitoredWell(well.wellId)}
          className="multiwell-icon-button"
          disabled={!canRemove}
          title={canRemove ? '移出监测列表' : '请先停止监测再移出'}
          aria-label={`${well.wellName}${canRemove ? '移出监测列表' : '正在监测，需先停止后再移出'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="multiwell-card-metrics">
        {metricItems.map(({ label, value, Icon, emphasis }) => (
          <div key={label} className="multiwell-card-metric" data-emphasis={emphasis ? 'true' : undefined}>
            <div className="multiwell-card-metric-head">
              <span>{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="multiwell-card-sample">
        <Clock3 className="h-3.5 w-3.5" />
        <span>最新样本</span>
        <strong>{sampleTimeLabel(latestTime)}</strong>
      </div>

      <div className="multiwell-card-runtime-row" aria-label={`${well.wellName}运行态`}>
        <span><i className="multiwell-card-runtime-dot bg-emerald-500" />后端 {backendRuntimeLabel(runtime, isStopped)}</span>
        <span><i className={`multiwell-card-runtime-dot ${isStopped ? 'bg-slate-400' : runtime?.status === 'connected' ? 'bg-cyan-500' : 'bg-amber-500'}`} />{subscriberLabel(runtime, isStopped)}</span>
      </div>

      <div
        className={`multiwell-mode-panel multiwell-mode-panel-compact${isHistoryMode ? ' multiwell-mode-panel-history' : ''}`}
        data-mode={monitoringMode}
        role="group"
        aria-label={`${well.wellName}监测模式设置`}
      >
        <div className={`multiwell-mode-heading${isHistoryMode ? ' is-history' : ''}`}>
          <span className="multiwell-mode-title">
            <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
            监测模式
          </span>
          {isHistoryMode && <span className="multiwell-replay-heading">回放起点</span>}
          <span className={`multiwell-mode-state ${isHistoryMode ? 'is-history' : 'is-realtime'}`}>
            <i aria-hidden="true" />
            {isHistoryMode ? '历史回放' : '实时数据'}
          </span>
        </div>

        <div className="multiwell-mode-body">
          <div className="multiwell-mode-switch" role="group" aria-label={`${well.wellName}监测模式`}>
            <button
              type="button"
              className={`multiwell-mode-option${!isHistoryMode ? ' is-active' : ''}`}
              onClick={() => changeMode('realtime')}
              disabled={isRunning || isConnecting}
              aria-pressed={!isHistoryMode}
            >
              <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
              实时监测
            </button>
            <button
              type="button"
              className={`multiwell-mode-option${isHistoryMode ? ' is-active' : ''}`}
              onClick={() => changeMode('historyReplay')}
              disabled={isRunning || isConnecting}
              aria-pressed={isHistoryMode}
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              历史回放
            </button>
          </div>

          {isHistoryMode ? (
            <div className="multiwell-mode-field multiwell-replay-field" aria-label="回放起点">
              <div className="multiwell-history-controls">
                <div className="multiwell-date-control">
                  <input
                    ref={replayDateInputRef}
                    type="datetime-local"
                    step="1"
                    min={replayMin || undefined}
                    max={replayMax || undefined}
                    value={replayStartValue}
                    disabled={isRunning || isConnecting}
                    onChange={(event) => updateWellReplayStartTime(well.wellId, event.target.value)}
                    className="multiwell-date-input"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="multiwell-date-picker-button multiwell-date-display"
                    onClick={openReplayDatePicker}
                    disabled={isRunning || isConnecting}
                    aria-label={`${well.wellName}打开回放起点选择器`}
                  >
                    <span>{replayDateLabel(replayStartValue)}</span>
                    <CalendarDays className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="multiwell-replay-speed"
                  onClick={cycleReplaySpeed}
                  aria-label={`${well.wellName}回放速度 x${replaySpeed}，点击切换`}
                  title="点击切换回放速度：x1、x2、x5、x10"
                >
                  x{replaySpeed}
                </button>
              </div>
            </div>
          ) : (
            <span className="multiwell-mode-realtime-copy">
              <i aria-hidden="true" />
              从最新数据点接入
            </span>
          )}
        </div>
      </div>

      <div className={`multiwell-card-progress ${progressTone}`}>
        <span className={`ops-led h-2 w-2 rounded-full ${runtimeDot(runtime, isStopped)}`} />
        <span className="truncate">{hintText}</span>
      </div>

      <div className="multiwell-card-toolbar">
        {(showResumeButton || showAutoStartButton) ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="ops-button-primary multiwell-card-action multiwell-card-action-primary"
            title={primaryAction.title}
            aria-label={primaryAction.ariaLabel}
          >
            <PrimaryActionIcon className="h-5 w-5" />
            {primaryAction.text}
          </button>
        ) : null}
        {showHistoryRestartButton ? (
          <button
            type="button"
            onClick={() => restartHistoryReplay(well.wellId)}
            className="ops-button-secondary multiwell-card-action"
            title="从选择的历史起点创建新的回放会话"
            aria-label={`${well.wellName}重新历史回放`}
          >
            <PlayCircle className="h-5 w-5" />
            重新回放
          </button>
        ) : null}
        <button type="button" onClick={enterRealtime} className="ops-button-secondary multiwell-card-action" aria-label={`进入 ${well.wellName} 实时监测`}>
          <ArrowRight className="h-5 w-5" />
          查看监测
        </button>
        {showStopButton ? (
            <button
              type="button"
              onClick={() => stopWellMonitoring(well.wellId)}
              disabled={!canStop}
              className={`multiwell-card-action multiwell-stop-action ${canStop ? 'multiwell-stop-action-live' : ''}`}
              title={stopButtonTitle}
              aria-label={stopButtonLabel}
            >
              <Square className="h-4 w-4" />
              {stopButtonText}
            </button>
          ) : null}
      </div>
    </article>
  );
}

function EventOverview({ selectedAlerts }: { selectedAlerts: Alert[] }) {
  const navigate = useNavigate();
  const visible = selectedAlerts.slice(0, 8);
  const level4 = selectedAlerts.filter((alert) => safeBackendLevel(alert.backendLevel) >= 4).length;
  const level23 = selectedAlerts.filter((alert) => safeBackendLevel(alert.backendLevel) >= 2 && safeBackendLevel(alert.backendLevel) < 4).length;

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
              <div className="text-sm text-slate-700 dark:text-slate-200">暂无事件</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">已选井未收到预警事件</div>
            </div>
          </div>
        ) : (
          visible.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => navigate('/alerts')}
              className={`multiwell-event-card ${safeBackendLevel(alert.backendLevel) >= 4 ? 'multiwell-event-critical' : 'multiwell-event-warning'}`}
              aria-label={`查看 ${alert.wellName || alert.wellId || '当前井'} L${safeBackendLevel(alert.backendLevel)} 报警事件`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{alert.wellName || alert.wellId || '当前井'}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{alert.date} {alert.time}</div>
                </div>
                <span className={`dashboard-chip ${levelTone(alert.backendLevel)}`}>
                  L{safeBackendLevel(alert.backendLevel)}
                  {safeBackendLevel(alert.peakBackendLevel ?? alert.backendLevel) > safeBackendLevel(alert.backendLevel) ? ` / 峰L${safeBackendLevel(alert.peakBackendLevel)}` : ''}
                </span>
              </div>
              <div className="mt-2 line-clamp-2 text-xs text-slate-700 dark:text-slate-200">{alert.message}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <span>井深 {formatNumber(alert.wellDepth, ' m')}</span>
                <span>钻头 {formatNumber(alert.bitDepth, ' m')}</span>
                <span className="col-span-2 truncate">层位 {cleanLayerLabel(alert.formation) || '--'}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <button type="button" onClick={() => navigate('/alerts')} className="mt-3 w-full ops-button-secondary px-3 py-2 text-xs" aria-label="进入报警管理查看全部事件">
        查看报警管理
      </button>
    </aside>
  );
}

export default function Dashboard() {
  const { wells, monitoredWellIds, wellRuntimeStates, alerts, isWellManuallyStopped } = useWellControl();
  const monitoredSet = useMemo(() => new Set(monitoredWellIds), [monitoredWellIds]);
  const monitoredWells = useMemo(
    // Always retain the source/default well order. Runtime state must never affect card placement.
    () => wells.filter((well) => monitoredSet.has(well.wellId)),
    [monitoredSet, wells],
  );
  const activeMonitoringCount = useMemo(
    () => Object.values(wellRuntimeStates).filter(
      (item) => monitoredSet.has(item.wellId)
        && !isWellManuallyStopped(item.wellId)
        && (item.isRunning || item.status === 'connected' || item.status === 'connecting' || item.status === 'reconnecting' || item.status === 'catchingUp'),
    ).length,
    [isWellManuallyStopped, monitoredSet, wellRuntimeStates],
  );
  const selectedAlerts = useMemo(
    () => alerts.filter((alert) => !alert.wellId || monitoredSet.has(alert.wellId)),
    [alerts, monitoredSet],
  );

  return (
    <div className="ops-page multiwell-dashboard space-y-3">
      <WellSelector />

      <div className="multiwell-dashboard-grid">
          <section className="multiwell-card-section min-w-0 space-y-3">
          <div className="ops-stat-grid">
            <div className="multiwell-summary-tile">
              <Activity className="h-4 w-4 text-teal-700" />
              <span>已选井</span>
              <strong>{monitoredWells.length}</strong>
            </div>
            <div className="multiwell-summary-tile">
              <RadioTower className="h-4 w-4 text-emerald-700" />
              <span>监测中</span>
              <strong>{activeMonitoringCount}</strong>
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
                <div className="text-sm text-slate-700 dark:text-slate-200">请选择需要进入监测的井</div>
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
