import { Bell, Clock3, Square, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { VerticalCurveDeck } from '../components/VerticalCurveDeck';
import { WellSchematic } from '../components/WellSchematic';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';

function safeBackendLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

function AlertQueueMini({
  alerts,
  wellName,
}: {
  alerts: ReturnType<typeof useWellControl>['alerts'];
  wellName: string;
}) {
  const criticalCount = alerts.filter((alert) => alert.level === 'critical').length;
  const warningCount = alerts.filter((alert) => alert.level === 'warning').length;
  const visibleAlerts = alerts.slice(0, 6);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const selectedAlert = selectedAlertId == null ? null : alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const selectedBackendLevel = safeBackendLevel(selectedAlert?.backendLevel);

  useEffect(() => {
    setSelectedAlertId(null);
  }, [wellName]);

  useEffect(() => {
    if (!selectedAlert) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedAlertId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAlert]);

  useEffect(() => {
    setSelectedAlertId(null);
  }, [wellName]);

  return (
    <div className="ops-panel-soft flex min-h-0 flex-col p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Bell className={`h-4 w-4 ${criticalCount > 0 ? 'text-red-600' : 'text-slate-500'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
            <span>报警队列</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-200">{wellName}</span>
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">红 {criticalCount}</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">待复核 {warningCount}</span>
          </div>
        </div>
      </div>
      <div className="ops-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {visibleAlerts.length === 0 ? (
          <div className="flex h-full min-h-[92px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-[#f6fafc] px-2 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            当前井队列待命
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => setSelectedAlertId(alert.id)}
              aria-label={`查看 ${wellName} L${safeBackendLevel(alert.backendLevel)} 事件详情`}
              className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:bg-white dark:hover:bg-slate-900 ${
                alert.level === 'critical'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-200'
                  : alert.level === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-100'
                    : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-100'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${alert.level === 'critical' ? 'bg-red-600' : alert.level === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="ops-inline-tile rounded px-1.5 py-0.5 text-[10px] dark:bg-white/10">L{safeBackendLevel(alert.backendLevel)}</span>
                {safeBackendLevel(alert.peakBackendLevel ?? alert.backendLevel) > safeBackendLevel(alert.backendLevel) ? (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">峰L{safeBackendLevel(alert.peakBackendLevel)}</span>
                ) : null}
                <div className="min-w-0 flex-1 truncate">{alert.message}</div>
                <span className="shrink-0 text-[10px] opacity-65">{alert.count && alert.count > 1 ? `${alert.count}帧` : alert.time}</span>
              </div>
            </button>
          ))
        )}
      </div>
      {selectedAlert ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedAlertId(null)}>
          <div
            className="ops-panel w-full max-w-xl overflow-hidden shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="monitoring-alert-detail-title"
            aria-describedby="monitoring-alert-detail-summary"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <div className="ops-eyebrow">事件详情</div>
                <h2 id="monitoring-alert-detail-title" className="text-base text-slate-900 dark:text-slate-100">事件详情</h2>
              </div>
              <button type="button" className="ops-button-secondary px-2 py-1" onClick={() => setSelectedAlertId(null)} title="关闭事件详情" aria-label="关闭事件详情" autoFocus>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="ops-scroll max-h-[calc(100vh-150px)] space-y-3 overflow-auto p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  selectedBackendLevel >= 4
                    ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-100'
                    : selectedBackendLevel >= 2
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100'
                }`}>
                  当前 L{selectedBackendLevel} {BACKEND_LEVEL_META[selectedBackendLevel].label}
                </span>
                {safeBackendLevel(selectedAlert.peakBackendLevel ?? selectedBackendLevel) > selectedBackendLevel ? (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">
                    峰值 L{safeBackendLevel(selectedAlert.peakBackendLevel)}
                  </span>
                ) : null}
                <span className="ops-inline-tile px-2 py-1 text-xs">{selectedAlert.pumpState}</span>
                <span className="ops-inline-tile px-2 py-1 text-xs">持续 {selectedAlert.count || 1} 帧</span>
              </div>
              <div id="monitoring-alert-detail-summary" className="ops-break-text rounded-md bg-slate-50 p-3 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                <div className="mb-1 flex items-center gap-2 text-xs ops-muted">
                  <Clock3 className="h-3.5 w-3.5" />
                  {selectedAlert.date} {selectedAlert.time} 至 {selectedAlert.lastDate || selectedAlert.date} {selectedAlert.lastTime || selectedAlert.time}
                </div>
                {selectedAlert.message}
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
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function signalState(signal: string, level: BackendLevel, activeSignals: string[]) {
  if (!activeSignals.includes(signal) || level < 2) return 'normal' as const;
  return level >= 4 ? 'critical' as const : 'warning' as const;
}

function formatMetric(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function formatMetricOrPlaceholder(value: number, digits: number, active: boolean) {
  if (!active) return '--';
  return formatMetric(value, digits);
}

export default function Monitoring() {
  const {
    isRunning,
    alerts,
    thresholds,
    wellInfo,
    monitoredWellIds,
    realtimeTabWellIds,
    selectedWellId,
    stopWellMonitoring,
    wells,
    wellRuntimeStates,
    selectedWellView,
    selectedWellManuallyStopped,
  } = useWellControl();
  const activeWellIds = monitoredWellIds.length > 0
    ? monitoredWellIds
    : realtimeTabWellIds.length > 0
      ? realtimeTabWellIds
      : selectedWellId
        ? [selectedWellId]
        : [];
  const activeWell = wells.find((well) => well.wellId === selectedWellId) || wells.find((well) => well.wellId === activeWellIds[0]) || wellInfo;
  const selectedRuntime = wellRuntimeStates[selectedWellId] || wellRuntimeStates[activeWell?.wellId || ''];
  const viewCurrentData = selectedWellView.currentData;
  const viewBackendDetection = selectedWellView.backendDetection;
  const viewCycleInfo = selectedWellView.cycleInfo;
  const trackFlowData = selectedWellView.flowHistory;
  const trackPressureData = selectedWellView.pressureHistory;
  const viewHistoryRecords = selectedWellView.historyRecords;
  const viewCurrentSampleTime = selectedWellView.currentSampleTime;
  const hasSamples = trackFlowData.length > 0 || trackPressureData.length > 0 || viewHistoryRecords.length > 0;
  const canStopMonitoring = Boolean(
    selectedWellId && (
      isRunning
      || selectedRuntime?.isRunning
      || selectedRuntime?.status === 'connected'
      || selectedRuntime?.status === 'connecting'
    ),
  );
  const stopButtonText = selectedWellManuallyStopped
    ? '监测已停'
    : canStopMonitoring
      ? '停止监测'
      : '无监测可停';
  const stopButtonTitle = selectedWellManuallyStopped
    ? '当前井已停止监测'
    : canStopMonitoring
      ? '停止当前井监测'
      : '当前没有运行中的监测井';
  const stopButtonAriaLabel = selectedWellManuallyStopped
    ? `${activeWell?.wellName || selectedWellId} 已停止监测`
    : canStopMonitoring
      ? `停止 ${activeWell?.wellName || selectedWellId} 监测`
      : '当前没有运行中的监测井';
  const returnResponse = viewCurrentData.returnResponse;
  const returnState = signalState('return_response', viewBackendDetection.publicLevel, viewBackendDetection.activeSignals);
  const pitState = signalState('pit_volume', viewBackendDetection.publicLevel, viewBackendDetection.activeSignals);
  const gasState = signalState('total_gas', viewBackendDetection.publicLevel, viewBackendDetection.activeSignals);
  const sppState = signalState('standpipe_pressure', viewBackendDetection.publicLevel, viewBackendDetection.activeSignals);
  const currentWellAlerts = alerts.filter((alert) => !alert.wellId || alert.wellId === selectedWellId);
  const isRecovering = !hasSamples && Boolean(
    !selectedWellManuallyStopped && (
    selectedRuntime?.status === 'connecting'
    || selectedRuntime?.isRunning
    || selectedRuntime?.startedSampleTime
    || selectedRuntime?.lastRecordAt)
  );

  return (
    <div className="monitoring-workspace flex h-full min-h-0 flex-col gap-2 overflow-auto lg:overflow-hidden">
      <MonitoringWellTabs
        rightSlot={
          <button
            type="button"
            className="ops-button-secondary monitoring-stop-action px-3 py-2 text-xs"
            disabled={!canStopMonitoring}
            title={stopButtonTitle}
            aria-label={stopButtonAriaLabel}
            onClick={() => selectedWellId && stopWellMonitoring(selectedWellId)}
          >
            <Square className="h-4 w-4" />
            {stopButtonText}
          </button>
        }
      />
      {activeWellIds.length === 0 ? (
        <div className="ops-panel ops-empty-state min-h-[420px] flex-1">
          <div>
            <Clock3 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <div className="text-sm text-slate-700 dark:text-slate-200">从总览页选择井后开始监测</div>
          </div>
        </div>
      ) : (
        <div className="monitoring-main-grid grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-visible lg:grid-cols-[minmax(0,2fr)_minmax(260px,0.52fr)] lg:overflow-hidden 2xl:grid-cols-[minmax(0,2.08fr)_minmax(280px,0.54fr)]">
          <section className="ops-panel monitoring-lane-panel flex min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 p-1.5">
              <VerticalCurveDeck
                flowData={trackFlowData}
                pressureData={trackPressureData}
                thresholds={thresholds}
                wellDepth={selectedWellView.latestWellDepth ?? viewCurrentData.wellDepth ?? activeWell.depth}
                currentDepth={viewCurrentData.bitDepth}
                pitGain={viewCurrentData.pitGain}
                isStopped={selectedWellManuallyStopped}
                compact
                fillViewport
              />
            </div>
          </section>

          <aside className="monitoring-side-stack grid min-h-0 min-w-0 grid-rows-[minmax(288px,1fr)_minmax(170px,0.46fr)] gap-2 overflow-hidden lg:grid-rows-[minmax(0,0.58fr)_minmax(0,0.42fr)]">
            <div className="min-h-0 overflow-hidden">
              <WellSchematic
                flowIn={viewCurrentData.flowIn}
                flowOut={viewCurrentData.flowOut}
                spm={viewCurrentData.spm}
                casingPressure={viewCurrentData.casingPressure}
                drillPipePressure={viewCurrentData.drillPipePressure}
                pitGain={viewCurrentData.pitGain}
                returnResponse={viewCurrentData.returnResponse}
                backendLevel={viewBackendDetection.publicLevel}
                activeSignals={viewBackendDetection.activeSignals}
                pumpState={viewCurrentData.pumpState}
                condition={viewCurrentData.condition}
                cycleInfo={viewCycleInfo}
                hasSamples={hasSamples}
                isRecovering={isRecovering}
                isStopped={selectedWellManuallyStopped}
                compact
                surface="light"
                metrics={[
                  { label: '出口流量响应', value: formatMetricOrPlaceholder(returnResponse, 1, hasSamples), unit: '%', state: returnState },
                  { label: '总池体积变化', value: formatMetricOrPlaceholder(viewCurrentData.pitGain, 2, hasSamples), unit: 'm3', state: pitState },
                  { label: '立压', value: formatMetricOrPlaceholder(viewCurrentData.spp, 2, hasSamples), unit: 'MPa', state: sppState },
                  { label: '全烃', value: formatMetricOrPlaceholder(viewCurrentData.totalGas, 2, hasSamples), unit: '%', state: gasState },
                ]}
              />
            </div>
            <div className="min-h-0 overflow-hidden">
              <AlertQueueMini alerts={currentWellAlerts} wellName={activeWell.wellName} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
