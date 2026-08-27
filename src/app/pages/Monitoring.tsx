import { Clock3, Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { VerticalCurveDeck } from '../components/VerticalCurveDeck';
import { WellboreStatusThumbnail } from '../components/WellboreStatusThumbnail';
import { MonitoringEventStream } from '../components/MonitoringEventStream';
import { PreprocessingDiagnosticsPanel } from '../components/PreprocessingDiagnosticsPanel';
import { ReferenceExperimentPanel } from '../components/ReferenceExperimentPanel';
import { PumpTopologyGatePanel } from '../components/PumpTopologyGatePanel';
import { PrecursorEligibilityPanel } from '../components/PrecursorEligibilityPanel';
import { OperationContextV2Panel } from '../components/OperationContextV2Panel';
import { useWellControl } from '../context/WellControlContext';
import { fetchWellboreProfile } from '../api/wellboreProfileApi';
import { normalizeWellboreStructureSections, type WellboreStructureSection } from '../lib/wellboreSimulation';
import { mergeMonitoringEvents, projectAlarmEvents, projectL1ObservationWindows } from '../lib/monitoringEventStream';

function formatMetric(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function formatMetricOrPlaceholder(value: number | null, digits: number, active: boolean) {
  if (!active || value === null) return '--';
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
    realtimeEndpoint,
    buildRealtimeApiUrl,
  } = useWellControl();
  const [thumbnailSections, setThumbnailSections] = useState<WellboreStructureSection[]>([]);
  const [thumbnailRegisteredDepth, setThumbnailRegisteredDepth] = useState(0);
  const activeWellIds = monitoredWellIds.length > 0
    ? monitoredWellIds
    : realtimeTabWellIds.length > 0
      ? realtimeTabWellIds
      : selectedWellId
        ? [selectedWellId]
        : [];
  const activeWell = wells.find((well) => well.wellId === selectedWellId) || wells.find((well) => well.wellId === activeWellIds[0]) || wellInfo;

  useEffect(() => {
    if (!activeWell?.wellId) {
      setThumbnailSections([]);
      setThumbnailRegisteredDepth(0);
      return undefined;
    }
    const controller = new AbortController();
    setThumbnailSections([]);
    setThumbnailRegisteredDepth(0);
    fetchWellboreProfile(
      buildRealtimeApiUrl(`/wells/${encodeURIComponent(activeWell.wellId)}/wellbore`),
      controller.signal,
    )
      .then((profile) => {
        if (!controller.signal.aborted) {
          setThumbnailSections(normalizeWellboreStructureSections(profile.sections));
          setThumbnailRegisteredDepth(profile.registeredDepthMax || 0);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setThumbnailSections([]);
      });
    return () => controller.abort();
  }, [activeWell?.wellId, buildRealtimeApiUrl]);
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
      || selectedRuntime?.status === 'reconnecting'
      || selectedRuntime?.status === 'catchingUp'
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
  const currentWellAlerts = useMemo(
    () => alerts.filter((alert) => !alert.wellId || alert.wellId === selectedWellId),
    [alerts, selectedWellId],
  );
  const monitoringEvents = useMemo(() => mergeMonitoringEvents(
    projectL1ObservationWindows(trackFlowData),
    projectAlarmEvents(currentWellAlerts),
  ), [currentWellAlerts, trackFlowData]);
  const isRecovering = !hasSamples && Boolean(
    !selectedWellManuallyStopped && (
    selectedRuntime?.status === 'connecting'
    || selectedRuntime?.status === 'reconnecting'
    || selectedRuntime?.status === 'catchingUp'
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
        <div className="monitoring-main-grid grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-visible lg:overflow-hidden">
          <section className="ops-panel monitoring-primary-panel monitoring-lane-panel flex min-h-0 flex-col overflow-hidden">
            <div className="realtime-kpi-strip">
              <div><span>当前井深</span><strong>{formatMetricOrPlaceholder(selectedWellView.latestWellDepth ?? viewCurrentData.wellDepth ?? activeWell.depth, 0, hasSamples)} m</strong></div>
              <div><span>钻头深度</span><strong>{formatMetricOrPlaceholder(viewCurrentData.bitDepth, 0, hasSamples)} m</strong></div>
              <div><span>地层</span><strong>{selectedWellView.latestFormation || viewCurrentData.formation || activeWell.targetLayer || '--'}</strong></div>
              <div><span>总池体积</span><strong>{formatMetricOrPlaceholder(viewCurrentData.pitVolume, 2, hasSamples)} m³</strong></div>
              <div><span>立压</span><strong>{formatMetricOrPlaceholder(viewCurrentData.spp, 2, hasSamples)} MPa</strong></div>
              <div><span>套压</span><strong>{formatMetricOrPlaceholder(viewCurrentData.casingPressure, 2, hasSamples)} MPa</strong></div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-1.5">
              <div className="min-h-0 flex-1">
                <VerticalCurveDeck
                flowData={trackFlowData}
                pressureData={trackPressureData}
                thresholds={thresholds}
                wellDepth={Math.max(
                  selectedWellView.latestWellDepth ?? viewCurrentData.wellDepth ?? activeWell.depth ?? 0,
                  thumbnailRegisteredDepth,
                )}
                currentDepth={viewCurrentData.bitDepth}
                outletSemantic={viewCurrentData.outletSemantic}
                outletUnit={viewCurrentData.outletUnit}
                isStopped={selectedWellManuallyStopped}
                compact
                fillViewport
                />
              </div>
            </div>
          </section>

          <aside className="monitoring-side-panel monitoring-side-stack min-h-0 min-w-0 gap-2 overflow-hidden">
            <div className="min-h-0 overflow-hidden">
              <WellboreStatusThumbnail
                wellName={activeWell.wellName}
                wellDepth={selectedWellView.latestWellDepth ?? viewCurrentData.wellDepth ?? activeWell.depth}
                bitDepth={selectedWellView.latestBitDepth ?? viewCurrentData.bitDepth}
                formation={selectedWellView.latestFormation || viewCurrentData.formation || activeWell.targetLayer}
                flowIn={viewCurrentData.flowIn}
                flowOut={viewCurrentData.flowOut}
                spm={viewCurrentData.totalSpm}
                casingPressure={viewCurrentData.casingPressure}
                spp={viewCurrentData.spp}
                pitGain={viewCurrentData.pitGain}
                pitVolume={viewCurrentData.pitVolume}
                totalGas={viewCurrentData.totalGas}
                mudWeight={viewCurrentData.mudWeight}
                backendLevel={viewBackendDetection.advisoryLevel}
                eventTitle={viewBackendDetection.eventTitle}
                physicalDescription={viewBackendDetection.physicalDescription}
                activeSignals={viewBackendDetection.activeSignals}
                pumpState={viewCurrentData.pumpState}
                condition={viewCurrentData.condition}
                wellboreSections={thumbnailSections}
                cycleInfo={viewCycleInfo}
                hasSamples={hasSamples}
                isRecovering={isRecovering}
                isStopped={selectedWellManuallyStopped}
              />
            </div>
            <div className="min-h-0 overflow-hidden">
              <MonitoringEventStream
                items={monitoringEvents}
                alerts={currentWellAlerts}
                wellName={activeWell.wellName}
                wellKey={activeWell.wellId}
                endpoint={realtimeEndpoint}
              />
            </div>
            <PreprocessingDiagnosticsPanel snapshot={viewBackendDetection.preprocessing} />
            <ReferenceExperimentPanel snapshot={viewBackendDetection.referenceExperiment} />
            <PumpTopologyGatePanel snapshot={viewBackendDetection.pumpGate} />
            <PrecursorEligibilityPanel snapshot={viewBackendDetection.precursorEligibility} />
            <OperationContextV2Panel snapshot={viewBackendDetection.operationContextV2} v1FineLabel={viewCurrentData.condition} />
          </aside>
        </div>
      )}
    </div>
  );
}
