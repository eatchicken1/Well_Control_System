import { Activity, ArrowLeft, Database, Flame, Gauge, RadioTower, ShieldAlert, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { WellboreSchemaFigure } from '../components/WellboreSchemaFigure';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from '../lib/wellboreState';

const LEVEL_LABELS: Record<BackendLevel, string> = {
  0: '正常',
  1: '异常观察',
  2: '溢流预警',
  3: '疑似溢流',
  4: '溢流确认',
};

const CASING_SHOE_DEPTH = 3200;
const format = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '--';

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  } = useWellControl();

  const well = wells.find((item) => item.wellId === selectedWellId) || wellInfo;
  const data = selectedWellView.currentData;
  const detection = selectedWellView.backendDetection;
  const cycle = selectedWellView.cycleInfo;
  const runtime = wellRuntimeStates[selectedWellId];
  const hasSamples = selectedWellView.flowHistory.length > 0 || selectedWellView.pressureHistory.length > 0;
  const isRecovering = !hasSamples && Boolean(runtime?.isRunning || runtime?.status === 'connecting');
  const previewLevelParam = Number(searchParams.get('level'));
  const previewLevel = ([0, 1, 2, 3, 4].includes(previewLevelParam) ? previewLevelParam : 3) as BackendLevel;
  const previewActive = searchParams.get('preview') === '1' || searchParams.get('preview') === 'kick' || (!selectedWellId && !hasSamples);
  const displayData = previewActive
    ? {
        ...data,
        wellDepth: 4200,
        bitDepth: 4160,
        flowIn: 32.4,
        flowOut: previewLevel >= 2 ? 38.8 : previewLevel === 1 ? 34.1 : 32.2,
        spm: 62,
        casingPressure: previewLevel >= 2 ? 4.6 : 1.1,
        spp: previewLevel >= 2 ? 13.7 : 15.2,
        pitGain: previewLevel >= 2 ? 1.86 : previewLevel === 1 ? 0.42 : 0.04,
        pitVolume: previewLevel >= 2 ? 122.6 : 118.2,
        totalGas: previewLevel >= 2 ? 1.42 : 0.18,
        returnResponse: previewLevel >= 2 ? 19.8 : previewLevel === 1 ? 5.2 : 0.6,
        mudWeight: 1.22,
        pumpState: 'running',
        condition: previewLevel >= 2 ? '循环异常' : previewLevel === 1 ? '循环观察' : '稳定监测',
      }
    : data;
  const displayDetection = previewActive
    ? {
        ...detection,
        publicLevel: previewLevel,
        activeSignals: previewLevel >= 2 ? ['return_response', 'pit_gain', 'pit_volume', 'total_gas', 'casing_pressure'] : previewLevel === 1 ? ['return_response'] : [],
      }
    : detection;
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
    hasSamples: previewActive || hasSamples,
    isRecovering,
    isStopped: selectedWellManuallyStopped,
  });

  const meta = getWellboreStateMeta(state);
  const conditionLabel = previewActive ? (level >= 2 ? '井筒效果预览：疑似溢流' : level === 1 ? '井筒效果预览：观察' : '井筒效果预览：正常循环') : formatWellboreConditionLabel(displayData.condition, cycle.stateLabel || meta.label);
  const conditionCode = previewActive ? (level >= 2 ? '循环异常' : level === 1 ? '循环观察' : '稳定监测') : (displayData.condition?.trim() || '实时监测');
  const currentWellAlerts = alerts.filter((alert) => !alert.wellId || alert.wellId === selectedWellId);
  const sampleCount = Math.max(dataSourceState.recordCount, selectedWellView.historyRecords.length, selectedWellView.flowHistory.length);
  const delay = dataDelaySeconds(dataSourceState.lastRecordAt || selectedWellView.currentSampleTime || runtime?.lastRecordAt || null);
  const baselineReady = !baselineInfo.isColdStart && baselineInfo.qualityScore >= 60;
  const wellDepth = previewActive ? 4200 : selectedWellView.latestWellDepth ?? displayData.wellDepth ?? well.depth;
  const openHoleLength = Math.max(0, Math.round(wellDepth - CASING_SHOE_DEPTH));
  const stateDescription = abnormal ? meta.description : watch ? '参数出现轻微偏离，进入观察窗口但尚未形成溢流证据链。' : '关键参数处于基线范围内，未触发预警证据。';
  const pressureRelation = previewActive
    ? '示意预览：MW 已设定，PP / ECD 未接入'
    : displayData.mudWeight > 0
      ? `MW ${format(displayData.mudWeight, 2)} g/cm³；PP / ECD 数据不足`
      : '压力关系：数据不足';

  const evidenceDuration = previewActive ? (level >= 2 ? '持续 58 s' : level === 1 ? '持续 24 s' : '当前窗口') : cycle.elapsedSeconds > 0 ? `持续 ${Math.round(cycle.elapsedSeconds)} s` : '当前窗口';
  const flowDelta = displayData.flowOut - displayData.flowIn;
  const evidence = [
    {
      label: abnormal ? '出口流量' : '出口/入口差值',
      value: abnormal ? format(displayData.flowOut, 1) : format(flowDelta, 1),
      unit: 'L/s',
      change: abnormal ? `较入口 ${flowDelta >= 0 ? '+' : ''}${format(flowDelta, 1)} L/s` : `较平衡点 ${flowDelta >= 0 ? '+' : ''}${format(flowDelta, 1)} L/s`,
      duration: evidenceDuration,
      grade: abnormal && displayDetection.activeSignals.includes('return_response') ? '主证据' : '正常',
      tone: abnormal && displayDetection.activeSignals.includes('return_response') ? 'critical' : 'normal',
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
      change: abnormal ? '较基线 -0.10 MPa' : '较基线 +0.00 MPa',
      duration: evidenceDuration,
      grade: abnormal ? '辅助观察' : '正常',
      tone: abnormal && (displayDetection.activeSignals.includes('standpipe_pressure') || displayDetection.activeSignals.includes('spp_drop')) ? 'warning' : 'normal',
      Icon: Gauge,
    },
    {
      label: '全烃',
      value: format(displayData.totalGas, 2),
      unit: '%',
      change: abnormal ? '较基线 +1.24%' : '处于基线范围',
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
    { label: '出口流量', values: selectedWellView.flowHistory.map((item) => item.flowOut), color: '#dc2626' },
    { label: '池体积', values: selectedWellView.flowHistory.map((item) => item.pitVolume), color: '#d97706' },
    { label: '立压', values: selectedWellView.pressureHistory.map((item) => item.spp), color: '#0f766e' },
    { label: '全烃', values: selectedWellView.pressureHistory.map((item) => item.totalGas), color: '#0891b2' },
  ];

  return (
    <div className="wellbore-detail-page">
      <header className="wellbore-detail-toolbar">
        <button type="button" className="wellbore-back-button" onClick={() => navigate('/monitoring')}>
          <ArrowLeft size={16} />返回实时监测
        </button>
        <div className="wellbore-detail-title">
          <strong>井筒状态监测</strong>
          <span>当前井号：{well.wellName}</span>
          {previewActive ? <span>示意预览数据</span> : <span>现场实时数据</span>}
          <b className="wellbore-state-badge" data-tone={meta.tone}>L{level} {LEVEL_LABELS[level]}</b>
        </div>
        <div className="wellbore-preview-levels" aria-label="井筒预览等级">
          {[0, 1, 2, 3, 4].map((item) => (
            <button
              key={item}
              type="button"
              className={previewActive && level === item ? 'is-active' : ''}
              onClick={() => setSearchParams({ preview: '1', level: String(item) })}
            >
              L{item}
            </button>
          ))}
        </div>
      </header>

      <div className="wellbore-detail-grid">
        <section className="wellbore-detail-main">
          <div className="wellbore-detail-figure">
            <WellboreSchemaFigure
              mode="detail"
              backendLevel={level}
              wellDepth={wellDepth}
              bitDepth={displayData.bitDepth ?? wellDepth}
              flowIn={displayData.flowIn}
              flowOut={displayData.flowOut}
              spm={displayData.spm}
              casingPressure={displayData.casingPressure}
              drillPipePressure={displayData.spp}
              pitGain={displayData.pitGain}
              pitVolume={displayData.pitVolume}
              returnResponse={displayData.returnResponse}
              totalGas={displayData.totalGas}
              mudWeight={displayData.mudWeight}
              influxSource={previewActive && abnormal ? 'estimated' : undefined}
              influxConfidence={previewActive && abnormal ? (level >= 4 ? 0.68 : level === 3 ? 0.56 : 0.42) : undefined}
              influxSide={previewActive && abnormal ? 'right' : undefined}
              gasFrontDepth={previewActive && abnormal ? (level >= 4 ? 3460 : level === 3 ? 3580 : 3740) : undefined}
              gasColumnBottomDepth={previewActive && abnormal ? 4080 : undefined}
              gasFraction={previewActive && abnormal ? (level >= 4 ? 0.48 : level === 3 ? 0.34 : 0.2) : undefined}
              activeSignals={displayDetection.activeSignals}
              pumpState={displayData.pumpState}
              condition={displayData.condition}
              cycleInfo={cycle}
              hasSamples={previewActive || hasSamples}
              isRecovering={isRecovering}
              isStopped={selectedWellManuallyStopped}
            />
          </div>
        </section>

        <aside className="wellbore-detail-side">
          <section className="wellbore-detail-card wellbore-current-state-card" data-tone={meta.tone}>
            <h2>当前状态</h2>
            <div className="wellbore-status-hero"><span>L{level}</span><strong>{LEVEL_LABELS[level]}</strong></div>
            <dl>
              <div><dt>状态评级</dt><dd>{LEVEL_LABELS[level]}</dd></div>
              <div><dt>当前工况</dt><dd>{conditionLabel}</dd></div>
              <div><dt>压力关系</dt><dd>{pressureRelation}</dd></div>
              <div><dt>工况码</dt><dd className="wellbore-code-text">{conditionCode}</dd></div>
            </dl>
            <p>{stateDescription}</p>
          </section>

          <section className="wellbore-detail-card">
            <h2>{abnormal ? '证据分层' : '运行健康摘要'}</h2>
            <div className="wellbore-detail-evidence">
              {evidence.map(({ label, value, unit, change, duration, grade, tone, Icon }) => (
                <article key={label} data-tone={tone}>
                  <header><Icon size={17} /><span>{label}</span><em>{grade}</em></header>
                  <strong>{value} <small>{unit}</small></strong>
                  <footer><span>{change}</span><span>{duration}</span></footer>
                </article>
              ))}
            </div>
          </section>

          {abnormal ? (
            <section className="wellbore-detail-card">
              <h2><TrendingUp size={15} />异常演化</h2>
              <div className="wellbore-timeline">
                {timeline.map((event, index) => <div key={event.time + '-' + index}><i /><time>{event.time}</time><span>{event.text}</span></div>)}
              </div>
            </section>
          ) : (
            <section className="wellbore-detail-card">
              <h2>关键参数微趋势</h2>
              <div className="wellbore-trend-grid">
                {trendSeries.map((item) => <div key={item.label}><span>{item.label}</span><Sparkline values={item.values} color={item.color} /></div>)}
              </div>
            </section>
          )}

          {abnormal ? (
            <section className="wellbore-detail-card">
              <h2><ShieldAlert size={16} />处置建议</h2>
              <ul>
                <li>持续复核出口流量与入口流量差异。</li>
                <li>确认流量、池体积、气测和压力窗口是否同步支持侵入。</li>
                <li>按现场规程准备关井，记录 SIDPP / SICP 和关井时间。</li>
                <li>复算压井液密度，并持续跟踪气侵前缘上移。</li>
              </ul>
            </section>
          ) : (
            <section className="wellbore-detail-card">
              <h2>最近事件</h2>
              <div className="wellbore-event-list">
                <span>数据接入正常</span>
                <span>{baselineReady ? '基线更新完成' : '基线持续积累中'}</span>
                <span>进入稳定监测</span>
                <span>{currentWellAlerts.some((alert) => !alert.acknowledged) ? '存在未确认报警' : '无未确认报警'}</span>
              </div>
            </section>
          )}

          <section className="wellbore-detail-card">
            <h2><RadioTower size={15} />数据与基线状态</h2>
            <dl>
              <div><dt>数据连接</dt><dd>{dataSourceState.status === 'connected' ? '正常' : dataSourceState.status === 'connecting' ? '连接中' : dataSourceState.status === 'paused' ? '已暂停' : dataSourceState.status}</dd></div>
              <div><dt>当前窗口</dt><dd>30 min / {sampleCount} 帧</dd></div>
              <div><dt>数据延迟</dt><dd>{delay === null ? '--' : format(delay, 1) + ' s'}</dd></div>
              <div><dt>基线状态</dt><dd>{baselineReady ? '有效' : '积累中'}</dd></div>
              <div><dt>基线质量</dt><dd>{format(baselineInfo.qualityScore, 0)}%</dd></div>
            </dl>
          </section>

          {!abnormal ? <section className="wellbore-detail-note">监测建议：保持实时监测，定期复核基线状态，并关注工况切换后的参数恢复。当前裸眼段长度约 {openHoleLength} m。</section> : null}
        </aside>
      </div>
    </div>
  );
}

