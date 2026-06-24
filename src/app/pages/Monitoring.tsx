import { Bell, Pause, Play, RotateCcw, ShieldAlert, Volume2 } from 'lucide-react';
import { VerticalCurveDeck } from '../components/VerticalCurveDeck';
import { WellSchematic } from '../components/WellSchematic';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';

function AlertQueueMini({
  alerts,
  onStartShutIn,
  shutInActive,
  alertStatus,
}: {
  alerts: ReturnType<typeof useWellControl>['alerts'];
  onStartShutIn: () => void;
  shutInActive: boolean;
  alertStatus: 'normal' | 'warning' | 'critical';
}) {
  const criticalCount = alerts.filter((alert) => alert.level === 'critical').length;
  const warningCount = alerts.filter((alert) => alert.level === 'warning').length;
  const visibleAlerts = alerts.slice(0, 6);

  return (
      <div className="ops-panel-soft flex min-h-0 flex-col p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Bell className={`h-4 w-4 ${criticalCount > 0 ? 'text-red-600' : 'text-slate-500'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
            <span>报警队列</span>
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">红 {criticalCount}</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">待复核 {warningCount}</span>
          </div>
        </div>
        {alertStatus === 'critical' && !shutInActive && (
          <button onClick={onStartShutIn} className="ops-button-danger px-2 py-1 text-xs">
            关井
          </button>
        )}
      </div>
      <div className="ops-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {visibleAlerts.length === 0 ? (
          <div className="flex h-full min-h-[92px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-[#f6fafc] px-2 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            队列待命
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-md border px-2.5 py-2 text-xs ${
                alert.level === 'critical'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-200'
                  : alert.level === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-100'
                    : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-100'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${alert.level === 'critical' ? 'bg-red-600' : alert.level === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="ops-inline-tile rounded px-1.5 py-0.5 text-[10px] dark:bg-white/10">L{alert.backendLevel}</span>
                <div className="min-w-0 flex-1 truncate">{alert.message}</div>
              <span className="shrink-0 text-[10px] opacity-65">{alert.count && alert.count > 1 ? `${alert.count}帧` : alert.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function signalState(signal: string, level: BackendLevel, activeSignals: string[]) {
  if (!activeSignals.includes(signal) || level < 2) return 'normal' as const;
  return level >= 4 ? 'critical' as const : 'warning' as const;
}

export default function Monitoring() {
  const {
    isRunning,
    setIsRunning,
    handleReset,
    currentData,
    alertStatus,
    backendDetection,
    flowHistory,
    pressureHistory,
    alerts,
    thresholds,
    wellInfo,
    dataSourceState,
    startOptions,
    selectedStartTime,
    shutInActive,
    shutInStartedAt,
    startShutInProcedure,
  } = useWellControl();
  const returnResponse = currentData.returnResponse;
  const returnState = signalState('return_response', backendDetection.publicLevel, backendDetection.activeSignals);
  const pitState = signalState('pit_volume', backendDetection.publicLevel, backendDetection.activeSignals);
  const gasState = signalState('total_gas', backendDetection.publicLevel, backendDetection.activeSignals);
  const sppState = signalState('standpipe_pressure', backendDetection.publicLevel, backendDetection.activeSignals);
  const unacknowledgedCount = alerts.filter((alert) => !alert.acknowledged).length;
  const trackFlowData = flowHistory;
  const trackPressureData = pressureHistory;
  const canStartMonitoring = Boolean(selectedStartTime);
  const startDisabled = !isRunning && !canStartMonitoring;
  const actionLabel = isRunning ? '暂停监测' : canStartMonitoring ? '开始监测' : '先选择时间';
  const actionTone = isRunning ? 'bg-amber-500 hover:bg-amber-600' : startDisabled ? 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-emerald-600 hover:bg-emerald-700';
  const helperText = startDisabled
    ? startOptions.length > 0
      ? '请先在顶部选择开始检测时间，然后启动监测。'
      : '正在加载可选时间索引。'
    : isRunning
      ? '监测流已建立，后端正在持续推送实时数据。'
      : dataSourceState.message;

  return (
    <div className="monitoring-workspace flex h-full min-h-0 flex-col gap-2 overflow-auto lg:overflow-hidden">
      <section className="ops-panel flex-shrink-0 border-t-2 border-t-red-600 px-3 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`ops-led h-2.5 w-2.5 rounded-full ${alertStatus === 'critical' ? 'bg-red-500' : alertStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} data-state={alertStatus} />
            <div className="min-w-0">
              <h1 className="ops-title truncate">{wellInfo.wellName} · 实时井控监测</h1>
              <p className="mt-0.5 text-[11px] ops-muted">
                后端 L{backendDetection.publicLevel} {BACKEND_LEVEL_META[backendDetection.publicLevel].label} · 未确认 {unacknowledgedCount}
              </p>
              <p className="mt-1 text-[11px] ops-muted">{helperText}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {alertStatus === 'critical' && (
              <div className="flex h-7 items-center gap-1.5 rounded-md bg-red-50 px-2 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-200">
                <Volume2 className="h-3.5 w-3.5" />
                声光告警
              </div>
            )}
            {shutInActive ? (
              <div className="flex h-7 items-center rounded-md bg-emerald-50 px-2 text-[11px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                关井启动 {shutInStartedAt || '--:--:--'}
              </div>
            ) : alertStatus === 'critical' ? (
              <button onClick={startShutInProcedure} className="ops-button-danger h-7 px-2 text-[11px]">
                <ShieldAlert className="h-4 w-4" />
                启动关井程序
              </button>
            ) : null}
            <button
              onClick={() => setIsRunning(isRunning ? false : true)}
              disabled={startDisabled}
              className={`flex h-7 items-center gap-2 rounded-md px-2 text-[11px] transition-colors ${actionTone} ${startDisabled ? 'cursor-not-allowed' : 'text-white'}`}
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {actionLabel}
            </button>
            <button onClick={handleReset} className="ops-button-secondary h-7 px-2 text-[11px]">
              <RotateCcw className="h-4 w-4" />
              复位
            </button>
          </div>
        </div>
      </section>

      <div className="monitoring-main-grid grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-visible lg:grid-cols-[minmax(0,2.15fr)_250px] 2xl:grid-cols-[minmax(0,2.35fr)_268px] lg:overflow-hidden">
        <section className="ops-panel monitoring-lane-panel flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 p-1.5">
            <VerticalCurveDeck
              flowData={trackFlowData}
              pressureData={trackPressureData}
              thresholds={thresholds}
              wellDepth={wellInfo.depth}
              currentDepth={currentData.bitDepth}
              pitGain={currentData.pitGain}
              compact
              fillViewport
            />
          </div>
        </section>

        <aside className="monitoring-side-stack grid min-h-0 grid-rows-[minmax(260px,1fr)_minmax(160px,0.62fr)] gap-2 overflow-hidden lg:grid-rows-[minmax(0,0.62fr)_minmax(0,0.38fr)]">
          <div className="min-h-0 overflow-hidden">
            <WellSchematic
              flowIn={currentData.flowIn}
              flowOut={currentData.flowOut}
              casingPressure={currentData.casingPressure}
              drillPipePressure={currentData.drillPipePressure}
              pitGain={currentData.pitGain}
              returnResponse={currentData.returnResponse}
              backendLevel={backendDetection.publicLevel}
              activeSignals={backendDetection.activeSignals}
              compact
              surface="light"
              metrics={[
                { label: '出口流量响应', value: returnResponse.toFixed(1), unit: '%', state: returnState },
                { label: '总池体积变化', value: currentData.pitGain.toFixed(2), unit: 'm3', state: pitState },
                { label: '立压', value: currentData.spp.toFixed(2), unit: 'MPa', state: sppState },
                { label: '全烃', value: currentData.totalGas.toFixed(2), unit: '%', state: gasState },
              ]}
            />
          </div>
          <div className="min-h-0 overflow-hidden">
            <AlertQueueMini alerts={alerts} onStartShutIn={startShutInProcedure} shutInActive={shutInActive} alertStatus={alertStatus} />
          </div>
        </aside>
      </div>
    </div>
  );
}
