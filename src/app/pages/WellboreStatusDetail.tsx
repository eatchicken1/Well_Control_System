import { Activity, ArrowLeft, Database, Flame, Gauge, RadioTower, ShieldAlert, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
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
  const level = detection.publicLevel as BackendLevel;
  const abnormal = level > 0;

  const state = deriveWellboreState({
    backendLevel: level,
    pumpState: data.pumpState,
    condition: data.condition,
    cycleState: cycle.state,
    flowIn: data.flowIn,
    flowOut: data.flowOut,
    spm: data.spm,
    hasSamples,
    isRecovering,
    isStopped: selectedWellManuallyStopped,
  });

  const meta = getWellboreStateMeta(state);
  const conditionLabel = formatWellboreConditionLabel(data.condition, cycle.stateLabel || meta.label);
  const englishConditionCode = data.condition?.trim() || 'RealtimeMonitoring';
  const currentWellAlerts = alerts.filter((alert) => !alert.wellId || alert.wellId === selectedWellId);
  const sampleCount = Math.max(dataSourceState.recordCount, selectedWellView.historyRecords.length, selectedWellView.flowHistory.length);
  const delay = dataDelaySeconds(dataSourceState.lastRecordAt || selectedWellView.currentSampleTime || runtime?.lastRecordAt || null);
  const baselineReady = !baselineInfo.isColdStart && baselineInfo.qualityScore >= 60;
  const wellDepth = selectedWellView.latestWellDepth ?? data.wellDepth ?? well.depth;
  const openHoleLength = Math.max(0, Math.round(wellDepth - CASING_SHOE_DEPTH));
  const stateDescription = abnormal ? meta.description : '关键参数处于基线范围内，未触发预警证据。';

  const evidence = [
    {
      label: abnormal ? '出口流量' : '出口/入口差值',
      value: abnormal ? format(data.flowOut, 1) : format(data.flowOut - data.flowIn, 1),
      unit: 'L/s',
      status: abnormal && detection.activeSignals.includes('return_response') ? '超过阈值' : '正常',
      tone: abnormal && detection.activeSignals.includes('return_response') ? 'critical' : 'normal',
      Icon: Activity,
    },
    {
      label: abnormal ? '总池体积' : '池体积漂移',
      value: format(abnormal ? data.pitVolume : data.pitGain, 2),
      unit: 'm³',
      status: abnormal && (detection.activeSignals.includes('pit_volume') || detection.activeSignals.includes('pit_gain')) ? '超过阈值' : '正常',
      tone: abnormal && (detection.activeSignals.includes('pit_volume') || detection.activeSignals.includes('pit_gain')) ? 'warning' : 'normal',
      Icon: Database,
    },
    {
      label: abnormal ? '立压' : '立压残差',
      value: format(data.spp, 2),
      unit: 'MPa',
      status: abnormal && (detection.activeSignals.includes('standpipe_pressure') || detection.activeSignals.includes('spp_drop')) ? '持续跟踪' : '正常',
      tone: abnormal && (detection.activeSignals.includes('standpipe_pressure') || detection.activeSignals.includes('spp_drop')) ? 'warning' : 'normal',
      Icon: Gauge,
    },
    {
      label: '全烃',
      value: format(data.totalGas, 2),
      unit: '%',
      status: abnormal && detection.activeSignals.includes('total_gas') ? '持续跟踪' : '正常',
      tone: abnormal && detection.activeSignals.includes('total_gas') ? 'critical' : 'normal',
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
          <b className="wellbore-state-badge" data-tone={meta.tone}>L{level} {LEVEL_LABELS[level]}</b>
        </div>
      </header>

      <div className="wellbore-detail-grid">
        <section className="wellbore-detail-main">
          <div className="wellbore-detail-figure">
            <WellboreSchemaFigure
              mode="detail"
              backendLevel={level}
              wellDepth={wellDepth}
              bitDepth={data.bitDepth ?? wellDepth}
              flowIn={data.flowIn}
              flowOut={data.flowOut}
              spm={data.spm}
              casingPressure={data.casingPressure}
              drillPipePressure={data.spp}
              pitGain={data.pitGain}
              pitVolume={data.pitVolume}
              returnResponse={0}
              totalGas={data.totalGas}
              activeSignals={detection.activeSignals}
              pumpState={data.pumpState}
              condition={data.condition}
              cycleInfo={cycle}
              hasSamples={hasSamples}
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
              <div><dt>英文工况码</dt><dd className="wellbore-code-text">{englishConditionCode}</dd></div>
            </dl>
            <p>{stateDescription}</p>
          </section>

          <section className="wellbore-detail-card">
            <h2>{abnormal ? '触发证据' : '运行健康摘要'}</h2>
            <div className="wellbore-detail-evidence">
              {evidence.map(({ label, value, unit, status, tone, Icon }) => (
                <div key={label} data-tone={tone}>
                  <Icon size={18} />
                  <span>{label}</span>
                  <strong>{value} <small>{unit}</small></strong>
                  <small>{status}</small>
                </div>
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
                <li>关注池体积、立压和套压的恢复趋势。</li>
                <li>必要时按现场规程人工复核报警并准备处置。</li>
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

