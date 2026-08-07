import { Activity, ArrowLeft, Database, Flame, Gauge, RadioTower, ShieldAlert, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { WellboreSchemaFigure } from '../components/WellboreSchemaFigure';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from '../lib/wellboreState';
import { normalizeWellboreStructureSections } from '../lib/wellboreSimulation';
import { fetchWellboreProfile, getCachedWellboreProfile, type WellboreProfile } from '../api/wellboreProfileApi';

const LEVEL_LABELS: Record<BackendLevel, string> = {
  0: '正常',
  1: '异常观察',
  2: '溢流预警',
  3: '疑似溢流',
  4: '溢流确认',
};

const CASING_SHOE_DEPTH = 3200;
const format = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '--';

function diagramWidth(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.max(18, Math.min(76, Number(value) * 0.23)) : fallback;
}

function dataDelaySeconds(lastRecordAt: string | null) {
  if (!lastRecordAt) return null;
  const parsed = Date.parse(lastRecordAt.replace(' ', 'T'));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / 1000);
}

function Sparkline({ values, color = '#0f766e' }: { values: number[]; color?: string }) {
  const finiteValues = values.filter(Number.isFinite).slice(-24);
  const points = finiteValues.length >= 2 ? finiteValues : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 0.0001);
  const d = points.map((value, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 86;
    const y = 24 - ((value - min) / range) * 18;
    return (index === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');

  return (
    <svg className="wellbore-mini-sparkline" viewBox="0 0 86 28" role="img" aria-label="最近窗口趋势">
      <path d="M0 24 H86" stroke="#e2e8f0" strokeWidth="1" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function WellboreStatusDetail() {
  const navigate = useNavigate();
  const {
    selectedWellId,
    selectedWellView,
    selectedWellManuallyStopped,
    wells,
    wellInfo,
    wellRuntimeStates,
    baselineInfo,
    dataSourceState,
    alerts,
    buildRealtimeApiUrl,
  } = useWellControl();

  const wellboreProfileUrl = selectedWellId
    ? buildRealtimeApiUrl(`/wells/${encodeURIComponent(selectedWellId)}/wellbore`)
    : '';
  const cachedWellboreProfile = wellboreProfileUrl ? getCachedWellboreProfile(wellboreProfileUrl) : null;
  const [wellboreProfile, setWellboreProfile] = useState<WellboreProfile | null>(() => cachedWellboreProfile);
  const [wellboreProfileStatus, setWellboreProfileStatus] = useState<'loading' | 'ready' | 'empty' | 'fallback'>(() => {
    if (!cachedWellboreProfile) return 'loading';
    return cachedWellboreProfile.sections.length > 0 || cachedWellboreProfile.trajectory.length > 0 || cachedWellboreProfile.bhaComponents.length > 0
      ? 'ready'
      : 'empty';
  });

  useEffect(() => {
    if (!selectedWellId) {
      setWellboreProfile(null);
      setWellboreProfileStatus('empty');
      return;
    }
    const cached = getCachedWellboreProfile(wellboreProfileUrl);
    if (cached) {
      const hasStructure = cached.sections.length > 0 || cached.trajectory.length > 0 || cached.bhaComponents.length > 0;
      setWellboreProfile(cached);
      setWellboreProfileStatus(hasStructure ? 'ready' : 'empty');
      return;
    }
    const controller = new AbortController();
    setWellboreProfileStatus('loading');
    fetchWellboreProfile(wellboreProfileUrl, controller.signal)
      .then((profile) => {
        if (controller.signal.aborted) return;
        const hasStructure = profile.sections.length > 0 || profile.trajectory.length > 0 || profile.bhaComponents.length > 0;
        setWellboreProfile(profile);
        setWellboreProfileStatus(hasStructure ? 'ready' : 'empty');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        setWellboreProfile(null);
        setWellboreProfileStatus('fallback');
      });
    return () => controller.abort();
  }, [buildRealtimeApiUrl, selectedWellId, wellboreProfileUrl]);

  const well = wells.find((item) => item.wellId === selectedWellId) || wellInfo;
  const data = selectedWellView.currentData;
  const detection = selectedWellView.backendDetection;
  const cycle = selectedWellView.cycleInfo;
  const runtime = wellRuntimeStates[selectedWellId];
  const hasSamples = selectedWellView.flowHistory.length > 0 || selectedWellView.pressureHistory.length > 0;
  const isRecovering = !hasSamples && Boolean(
    runtime?.isRunning
    || runtime?.status === 'connecting'
    || runtime?.status === 'reconnecting'
    || runtime?.status === 'catchingUp',
  );
  const displayData = data;
  const displayDetection = detection;
  const level = displayDetection.publicLevel as BackendLevel;
  const abnormal = level >= 2;
  const watch = level === 1;

  const state = deriveWellboreState({
    backendLevel: level,
    pumpState: displayData.pumpState,
    condition: displayData.condition,
    cycleState: cycle.state,
    flowIn: displayData.flowIn,
    flowOut: displayData.flowOut,
    spm: displayData.spm,
    hasSamples,
    isRecovering,
    isStopped: selectedWellManuallyStopped,
  });

  const meta = getWellboreStateMeta(state);
  const conditionLabel = formatWellboreConditionLabel(displayData.condition, cycle.stateLabel || meta.label);
  const conditionCode = displayData.condition?.trim() || '实时监测';
  const currentWellAlerts = alerts.filter((alert) => !alert.wellId || alert.wellId === selectedWellId);
  const sampleCount = Math.max(dataSourceState.recordCount, selectedWellView.historyRecords.length, selectedWellView.flowHistory.length);
  const delay = dataDelaySeconds(dataSourceState.lastRecordAt || selectedWellView.currentSampleTime || runtime?.lastRecordAt || null);
  const baselineReady = !baselineInfo.isColdStart && baselineInfo.qualityScore >= 60;
  const wellDepth = Math.max(
    selectedWellView.latestWellDepth || 0,
    displayData.wellDepth || 0,
    displayData.bitDepth || 0,
    well.depth || 0,
  );
  const rawProfileSections = wellboreProfile?.sections || [];
  const profileSections = normalizeWellboreStructureSections(rawProfileSections);
  const structureDepth = Math.max(wellDepth, wellboreProfile?.registeredDepthMax || 0, displayData.bitDepth || 0);
  const structureBitDepth = displayData.bitDepth || structureDepth;
  const activeSection = profileSections.find((section) => Number(section.bottomDepthM) >= structureBitDepth) || profileSections[profileSections.length - 1];
  const completedCasingSection = profileSections
    .filter((section) => section.kind !== 'openHole' && Number(section.bottomDepthM) <= structureBitDepth - 120)
    .at(-1);
  const casingShoeDepth = completedCasingSection
    ? Number(completedCasingSection.bottomDepthM)
    : Number.isFinite(displayData.casingShoeDepth) && Number(displayData.casingShoeDepth) > 0
        && Number(displayData.casingShoeDepth) <= structureBitDepth - 120
      ? Number(displayData.casingShoeDepth)
      : Math.min(CASING_SHOE_DEPTH, Math.max(900, structureBitDepth - 320));
  const openHoleLength = Math.max(0, Math.round(wellDepth - casingShoeDepth));
  const activeTrajectory = (wellboreProfile?.trajectory || [])
    .filter((item) => item.measuredDepthM <= structureBitDepth)
    .at(-1) || wellboreProfile?.trajectory.at(-1);
  const activeBhaInterval = (wellboreProfile?.bhaIntervals || []).find((item) => (
    (item.startDepthM === undefined || item.startDepthM <= structureBitDepth)
    && (item.endDepthM === undefined || item.endDepthM >= structureBitDepth)
  ));
  const activeComponents = (wellboreProfile?.bhaComponents || []).filter((item) => (
    !activeBhaInterval || item.bhaIntervalId === activeBhaInterval.bhaIntervalId
  ));
  const bitComponent = activeComponents.find((item) => /钻头|\bbit\b/i.test(`${item.componentName} ${item.specModel}`));
  const drillPipeComponent = activeComponents.find((item) => /钻杆|drill\s*pipe|\bdp\b/i.test(`${item.componentName} ${item.specModel}`));
  const bhaOuterDiameter = activeComponents
    .filter((item) => item !== bitComponent && item !== drillPipeComponent)
    .map((item) => item.outerDiameterMm || 0)
    .reduce((max, value) => Math.max(max, value), 0);
  const structureSourceLabel = wellboreProfileStatus === 'ready' && profileSections.length > 0
    ? `实库井身：有效 ${profileSections.length}/${rawProfileSections.length} 段 · ${wellboreProfile?.trajectory.length || 0} 个测斜点 · ${activeComponents.length} 个钻具`
    : wellboreProfileStatus === 'ready'
      ? `实库资料已读取，但 ${rawProfileSections.length} 段中无可用井身程序；结构按模板补齐`
    : wellboreProfileStatus === 'loading'
      ? '井身结构：正在读取数据库资料'
      : wellboreProfileStatus === 'empty'
        ? '井身结构：数据库暂无资料，当前使用设计模板'
        : '井身结构：接口暂不可用，当前使用设计模板';
  const stateDescription = abnormal ? meta.description : watch ? '参数出现轻微偏离，进入观察窗口但尚未形成溢流证据链。' : '关键参数处于基线范围内，未触发预警证据。';
  const pressureRelation = displayData.mudWeight > 0
      ? `MW ${format(displayData.mudWeight, 2)} g/cm³；PP / ECD 数据不足`
      : '压力关系：数据不足';

  const evidenceDuration = cycle.elapsedSeconds > 0 ? `持续 ${Math.round(cycle.elapsedSeconds)} s` : '当前窗口';
  const outletSemantic = displayData.outletSemantic?.trim() || '';
  const configuredOutletUnit = displayData.outletUnit?.trim() || '';
  const isValveOpening = /valve|opening|开度/i.test(outletSemantic) || outletSemantic === 'ValveOpeningProxy';
  const isTrueFlow = /true(volumetric|return)flow/i.test(outletSemantic) || outletSemantic === 'TrueVolumetricFlow' || outletSemantic === 'TrueReturnFlow';
  const isUnknown = !isValveOpening && !isTrueFlow;
  const outletUnit = isValveOpening
    ? '%'
    : isTrueFlow
      ? (configuredOutletUnit && !/^unknown$/i.test(configuredOutletUnit) ? configuredOutletUnit : 'L/s')
      : (configuredOutletUnit && !/^unknown$/i.test(configuredOutletUnit) ? configuredOutletUnit : '--');
  const outletLabel = isValveOpening
    ? '出口挡板开度'
    : isTrueFlow
      ? '出口流量'
      : '出口信号';
  const outletChangeText = isValveOpening
    ? '当前通道语义：阀门开度'
    : isTrueFlow
      ? '当前通道语义：真实出口流量'
      : '语义未配置';
  const pressureResidual = Number.isFinite(displayData.spp) && Number.isFinite(displayData.sppPredicted)
    ? displayData.spp - displayData.sppPredicted
    : undefined;
  const previousGas = selectedWellView.flowHistory.length > 1
    ? selectedWellView.flowHistory[selectedWellView.flowHistory.length - 2]?.totalGas
    : undefined;
  const gasChange = Number.isFinite(previousGas) && Number.isFinite(displayData.totalGas)
    ? displayData.totalGas - Number(previousGas)
    : undefined;
  const evidence = [
    {
      label: outletLabel,
      value: format(displayData.flowOut, 1),
      unit: outletUnit,
      change: outletChangeText,
      duration: evidenceDuration,
      grade: abnormal && displayDetection.activeSignals.includes('OutletIncreaseResidual') ? '主证据' : '正常',
      tone: abnormal && displayDetection.activeSignals.includes('OutletIncreaseResidual') ? 'critical' : 'normal',
      Icon: Activity,
    },
    {
      label: abnormal ? '池增量' : '池体积漂移',
      value: format(displayData.pitGain, 2),
      unit: 'm³',
      change: `较基线 +${format(displayData.pitGain, 2)} m³`,
      duration: evidenceDuration,
      grade: abnormal && (displayDetection.activeSignals.includes('pit_volume') || displayDetection.activeSignals.includes('pit_gain')) ? '支持证据' : '正常',
      tone: abnormal && (displayDetection.activeSignals.includes('pit_volume') || displayDetection.activeSignals.includes('pit_gain')) ? 'warning' : 'normal',
      Icon: Database,
    },
    {
      label: abnormal ? '立压' : '立压残差',
      value: format(displayData.spp, 2),
      unit: 'MPa',
      change: pressureResidual === undefined
        ? '参考值不可用'
        : `较参考 ${pressureResidual >= 0 ? '+' : ''}${format(pressureResidual, 2)} MPa`,
      duration: evidenceDuration,
      grade: abnormal ? '辅助观察' : '正常',
      tone: abnormal && (displayDetection.activeSignals.includes('standpipe_pressure') || displayDetection.activeSignals.includes('spp_drop')) ? 'warning' : 'normal',
      Icon: Gauge,
    },
    {
      label: '全烃',
      value: format(displayData.totalGas, 2),
      unit: '%',
      change: gasChange === undefined
        ? '等待上一有效样本'
        : `较上一有效样本 ${gasChange >= 0 ? '+' : ''}${format(gasChange, 2)}%`,
      duration: evidenceDuration,
      grade: abnormal && displayDetection.activeSignals.includes('total_gas') ? '支持证据' : '正常',
      tone: abnormal && displayDetection.activeSignals.includes('total_gas') ? 'critical' : 'normal',
      Icon: Flame,
    },
  ] as const;

  const timeline = useMemo(() => {
    const alertEvents = currentWellAlerts.slice(0, 4).map((alert) => ({ time: alert.time, text: alert.message }));
    if (alertEvents.length > 0) return alertEvents;

    return [
      { time: selectedWellView.currentSampleTime?.slice(11, 16) || '--:--', text: level >= 2 ? '返出响应未完全回落' : '进入稳定监测窗口' },
      { time: cycle.tStopPump || cycle.tStable || '--:--', text: level >= 2 ? '池体积开始偏离' : '基线状态保持有效' },
      { time: cycle.tStartPump || '--:--', text: level >= 2 ? `${conditionLabel}窗口持续跟踪` : '无未确认报警' },
    ];
  }, [conditionLabel, currentWellAlerts, cycle.tStable, cycle.tStartPump, cycle.tStopPump, level, selectedWellView.currentSampleTime]);

  const trendSeries = [
    { label: `${outletLabel}${outletUnit === '--' ? '' : `（${outletUnit}）`}`, values: selectedWellView.flowHistory.map((item) => item.flowOut), color: '#dc2626' },
    { label: '池体积', values: selectedWellView.flowHistory.map((item) => item.pitVolume), color: '#d97706' },
    { label: '立压', values: selectedWellView.pressureHistory.map((item) => item.spp), color: '#0f766e' },
    { label: '全烃', values: selectedWellView.pressureHistory.map((item) => item.totalGas), color: '#0891b2' },
  ];

  return (
    <div className="wellbore-detail-page">
      <header className="wellbore-detail-toolbar">
        <button type="button" className="wellbore-back-button" onClick={() => navigate('/monitoring')}>
          <ArrowLeft size={16} />返回监测
        </button>
        <div className="wellbore-detail-title wellbore-detail-title-compact">
          <strong>井筒状态监测</strong>
          <span>{well.wellName}</span>
          <small>工程结构与实时工况</small>
        </div>
        <span className="wellbore-level-source"><RadioTower size={13} />{dataSourceState.status === 'connected' ? '实时数据已接入' : dataSourceState.status === 'connecting' ? '数据流连接中' : dataSourceState.status === 'reconnecting' ? '数据流重连中' : dataSourceState.status === 'catchingUp' ? '数据补齐中' : '数据流待更新'}</span>
      </header>

      <div className="wellbore-detail-grid">
        <section className="wellbore-detail-main">
          <div className="wellbore-detail-figure">
            <WellboreSchemaFigure
              mode="detail"
              backendLevel={level}
              wellDepth={structureDepth}
              bitDepth={displayData.bitDepth ?? structureDepth}
              casingShoeDepth={casingShoeDepth}
              drillPipeOD={diagramWidth(drillPipeComponent?.outerDiameterMm, displayData.drillPipeOD ?? 22)}
              bhaOD={diagramWidth(bhaOuterDiameter || undefined, displayData.bhaOD ?? 34)}
              bitOD={diagramWidth(bitComponent?.outerDiameterMm, displayData.bitOD ?? 50)}
              casingID={displayData.casingID}
              openHoleDiameter={diagramWidth(activeBhaInterval?.holeSizeMm ?? activeSection?.holeSizeMm, displayData.openHoleDiameter ?? 66)}
              formation={activeSection?.formation || selectedWellView.latestFormation || displayData.formation || wellboreProfile?.targetLayer || well.targetLayer}
              wellboreSections={profileSections}
              flowIn={displayData.flowIn}
              flowOut={displayData.flowOut}
              spm={displayData.spm}
              casingPressure={displayData.casingPressure}
              drillPipePressure={displayData.spp}
              pitGain={displayData.pitGain}
              pitVolume={displayData.pitVolume}
              totalGas={displayData.totalGas}
              mudWeight={displayData.mudWeight}
              ecd={displayData.ecd}
              porePressureEquivalent={displayData.porePressureEquivalent}
              fractureGradientEquivalent={displayData.fractureGradientEquivalent}
              inclination={activeTrajectory?.inclinationDeg ?? displayData.inclination}
              highSideDirection={activeTrajectory?.azimuthDeg ?? displayData.highSideDirection}
              activeSignals={displayDetection.activeSignals}
              pumpState={displayData.pumpState}
              condition={displayData.condition}
              cycleInfo={cycle}
              hasSamples={hasSamples}
              isRecovering={isRecovering}
              isStopped={selectedWellManuallyStopped}
            />
          </div>
        </section>

        <aside className="wellbore-detail-side">
          <section className="wellbore-detail-side-card" data-tone={meta.tone}>
            <div className="wellbore-detail-summary-top">
              <div className="wellbore-status-hero"><span>L{level}</span><strong>{LEVEL_LABELS[level]}</strong></div>
              <dl>
                <div><dt>当前工况</dt><dd>{conditionLabel}</dd></div>
                <div><dt>压力关系</dt><dd>{pressureRelation}</dd></div>
                <div><dt>工况码</dt><dd className="wellbore-code-text">{conditionCode}</dd></div>
                <div><dt>井身依据</dt><dd>{structureSourceLabel}</dd></div>
              </dl>
            </div>
            <p className="wellbore-detail-summary-copy">{stateDescription}</p>

            <div className="wellbore-detail-section-head"><h2>{abnormal ? '证据分层' : '运行健康摘要'}</h2><span>{evidenceDuration}</span></div>
            <div className="wellbore-detail-evidence">
              {evidence.map(({ label, value, unit, change, grade, tone, Icon }) => (
                <article key={label} data-tone={tone}>
                  <header><Icon size={16} /><span>{label}</span><em>{grade}</em></header>
                  <strong>{value} <small>{unit}</small></strong>
                  <footer><span>{change}</span></footer>
                </article>
              ))}
            </div>

            <div className="wellbore-detail-insights">
              <section className="wellbore-detail-trend-panel">
                <div className="wellbore-detail-section-head"><h2>{abnormal ? <><TrendingUp size={14} />异常演化</> : '关键参数微趋势'}</h2></div>
                {abnormal ? (
                  <div className="wellbore-timeline">
                    {timeline.map((event, index) => <div key={event.time + '-' + index}><i /><time>{event.time}</time><span>{event.text}</span></div>)}
                  </div>
                ) : (
                  <div className="wellbore-trend-grid">
                    {trendSeries.map((item) => <div key={item.label}><span>{item.label}</span><Sparkline values={item.values} color={item.color} /></div>)}
                  </div>
                )}
              </section>
              <section className="wellbore-detail-events-panel">
                <div className="wellbore-detail-section-head"><h2>{abnormal ? <><ShieldAlert size={14} />处置建议</> : '最近事件'}</h2></div>
                {abnormal ? (
                  <ul className="wellbore-action-list">
                    <li>复核出口/入口流量差异与池体积窗口。</li>
                    <li>按现场规程准备关井并记录压力。</li>
                    <li>持续跟踪气测与侵入前缘变化。</li>
                  </ul>
                ) : (
                  <div className="wellbore-event-list">
                    <span>数据接入正常</span><span>{baselineReady ? '基线更新完成' : '基线持续积累中'}</span>
                    <span>进入稳定监测</span><span>{currentWellAlerts.some((alert) => !alert.acknowledged) ? '存在未确认报警' : '无未确认报警'}</span>
                  </div>
                )}
              </section>
            </div>

            <div className="wellbore-detail-data-strip">
              <div><span>数据连接</span><strong>{dataSourceState.status === 'connected' ? '正常' : dataSourceState.status === 'connecting' ? '连接中' : dataSourceState.status === 'reconnecting' ? '重连中' : dataSourceState.status === 'catchingUp' ? '补齐中' : dataSourceState.status === 'paused' ? '已暂停' : dataSourceState.status}</strong></div>
              <div><span>当前窗口</span><strong>30 min / {sampleCount} 帧</strong></div>
              <div><span>数据延迟</span><strong>{delay === null ? '--' : format(delay, 1) + ' s'}</strong></div>
              <div><span>基线</span><strong>{baselineReady ? `有效 · ${format(baselineInfo.qualityScore, 0)}%` : '积累中'}</strong></div>
            </div>
            <footer className="wellbore-detail-note">{abnormal ? '请按现场井控规程持续复核并记录处置过程。' : `监测建议：关注工况切换后的参数恢复；当前裸眼段约 ${openHoleLength} m。`}</footer>
          </section>
        </aside>
      </div>
    </div>
  );
}

