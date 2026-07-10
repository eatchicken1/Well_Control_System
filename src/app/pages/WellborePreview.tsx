import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Database, Flame, Gauge, ListChecks, Ruler } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { WellboreSchemaFigure } from '../components/WellboreSchemaFigure';
import type { BackendLevel } from '../context/WellControlContext';

const LEVEL_LABELS: Record<BackendLevel, string> = {
  0: '正常循环',
  1: '异常观察',
  2: '溢流预警',
  3: '疑似溢流',
  4: '溢流确认',
};

function toLevel(value: string | null): BackendLevel {
  const parsed = Number(value);
  return ([0, 1, 2, 3, 4].includes(parsed) ? parsed : 3) as BackendLevel;
}

function previewData(level: BackendLevel) {
  return {
    wellDepth: 4200,
    bitDepth: 4160,
    flowIn: 32.4,
    flowOut: level >= 2 ? 38.8 : level === 1 ? 34.1 : 32.2,
    spm: 62,
    casingPressure: level >= 2 ? 4.6 : 1.1,
    spp: level >= 2 ? 13.7 : 15.2,
    pitGain: level >= 2 ? 1.86 : level === 1 ? 0.42 : 0.04,
    pitVolume: level >= 2 ? 122.6 : 118.2,
    totalGas: level >= 2 ? 1.42 : 0.18,
    activeSignals: level >= 2 ? ['return_response', 'pit_gain', 'pit_volume', 'total_gas', 'casing_pressure'] : level === 1 ? ['return_response'] : [],
    condition: level >= 2 ? '循环异常' : level === 1 ? '循环观察' : '稳定监测',
  };
}

export default function WellborePreview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const level = toLevel(searchParams.get('level'));
  const data = previewData(level);
  const abnormal = level >= 2;
  const watch = level === 1;
  const deltaQ = data.flowOut - data.flowIn;
  const porePressure = level >= 4 ? 1.32 : level >= 2 ? 1.28 : level === 1 ? 1.21 : 1.18;
  const mudWeight = level >= 2 ? 1.18 : level === 1 ? 1.22 : 1.26;
  const evidenceRows = abnormal
    ? [
        { label: '流量差', value: `ΔQ +${deltaQ.toFixed(1)} L/s`, tone: 'critical' },
        { label: '池体积', value: `池增 ${data.pitGain.toFixed(2)} m³`, tone: 'warning' },
        { label: '气侵段', value: '前缘 3482 m / 上移 54 m/min', tone: 'critical' },
        { label: '压力窗', value: `PP ${porePressure.toFixed(2)} > MW ${mudWeight.toFixed(2)}`, tone: 'critical' },
      ]
    : [
        { label: '流量差', value: `ΔQ ${deltaQ.toFixed(1)} L/s`, tone: watch ? 'warning' : 'normal' },
        { label: '池体积', value: `池增 ${data.pitGain.toFixed(2)} m³`, tone: watch ? 'warning' : 'normal' },
        { label: '气测', value: `全烃 ${data.totalGas.toFixed(2)}%`, tone: 'normal' },
        { label: '压力窗', value: `MW ${mudWeight.toFixed(2)} > PP ${porePressure.toFixed(2)}`, tone: 'normal' },
      ];
  const actionSteps = abnormal
    ? [
        { label: '确认', value: '核实流量计 / 池体积 / 气测同步异常', tone: 'critical' },
        { label: '隔离', value: '保持井口监测，准备关井程序', tone: 'critical' },
        { label: '计算', value: '记录 SIDPP / SICP，复算压井液密度', tone: 'warning' },
      ]
    : [
        { label: '监测', value: '维持循环，观察入口/返出差值', tone: watch ? 'warning' : 'normal' },
        { label: '校核', value: '复核池面、泵冲和压力传感器零漂', tone: 'normal' },
        { label: '记录', value: '保留当前正常循环基线', tone: 'normal' },
      ];

  const setLevel = (next: BackendLevel) => setSearchParams({ level: String(next) });

  return (
    <main className="wellbore-preview-page">
      <header className="wellbore-preview-toolbar">
        <Link to={`/monitoring/wellbore-status?preview=1&level=${level}`} className="wellbore-back-button">
          <ArrowLeft size={16} />进入系统页
        </Link>
        <div className="wellbore-preview-title">
          <strong>井筒工程状态预览</strong>
          <span>结构化井筒模型 + React 实时状态覆盖</span>
        </div>
        <div className="wellbore-preview-levels" aria-label="切换预警等级">
          {([0, 1, 2, 3, 4] as BackendLevel[]).map((item) => (
            <button key={item} type="button" className={item === level ? 'is-active' : ''} onClick={() => setLevel(item)}>
              L{item}
            </button>
          ))}
        </div>
      </header>

      <section className="wellbore-preview-shell" data-tone={abnormal ? 'critical' : level === 1 ? 'warning' : 'normal'}>
        <div className="wellbore-preview-stage">
          <WellboreSchemaFigure
            mode="detail"
            backendLevel={level}
            wellDepth={data.wellDepth}
            bitDepth={data.bitDepth}
            flowIn={data.flowIn}
            flowOut={data.flowOut}
            spm={data.spm}
            casingPressure={data.casingPressure}
            drillPipePressure={data.spp}
            pitGain={data.pitGain}
            pitVolume={data.pitVolume}
            returnResponse={abnormal ? 38 : level === 1 ? 12 : 0}
            totalGas={data.totalGas}
            activeSignals={data.activeSignals}
            pumpState="running"
            condition={data.condition}
            hasSamples
          />
        </div>

        <aside className="wellbore-preview-side">
          <section>
            <h1>L{level} {LEVEL_LABELS[level]}</h1>
            <p>{abnormal ? '侧壁侵入、右环空上返、气侵柱前缘与流量/池增证据同步映射。' : level === 1 ? '观察路径和浅色证据带用于展示轻微偏离。' : '正常循环路径以绿色虚线展示，井筒结构保持清晰可读。'}</p>
          </section>
          <div className="wellbore-preview-metrics">
            <div data-tone={abnormal ? 'critical' : watch ? 'warning' : 'normal'}><Activity size={18} /><span>出口流量</span><strong>{data.flowOut.toFixed(1)} L/s</strong></div>
            <div data-tone={abnormal ? 'warning' : watch ? 'warning' : 'normal'}><Database size={18} /><span>池增量</span><strong>{data.pitGain.toFixed(2)} m³</strong></div>
            <div data-tone={abnormal ? 'warning' : 'normal'}><Gauge size={18} /><span>立压</span><strong>{data.spp.toFixed(2)} MPa</strong></div>
            <div data-tone={abnormal ? 'critical' : 'normal'}><Flame size={18} /><span>全烃</span><strong>{data.totalGas.toFixed(2)}%</strong></div>
          </div>
          <div className="wellbore-preview-evidence">
            <h2><ListChecks size={16} />判据链</h2>
            {evidenceRows.map((row) => (
              <div key={row.label} data-tone={row.tone}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="wellbore-preview-actions">
            <h2><CheckCircle2 size={16} />处置流程</h2>
            {actionSteps.map((step, index) => (
              <div key={step.label} data-tone={step.tone}>
                <i>{index + 1}</i>
                <span>{step.label}</span>
                <strong>{step.value}</strong>
              </div>
            ))}
          </div>
          <div className="wellbore-preview-audit">
            <h2><Ruler size={16} />准确性核查</h2>
            <span><CheckCircle2 size={14} />深度轴按 0-{data.wellDepth} m 线性比例映射</span>
            <span><CheckCircle2 size={14} />套管鞋固定标注在 3200 m，以下进入裸眼段</span>
            <span><CheckCircle2 size={14} />钻头/BHA 位于 {data.bitDepth} m{abnormal ? '，异常侵入点贴近井底裸眼段' : '，当前未绘制异常侵入点'}</span>
          </div>
          <div className="wellbore-preview-note">
            <AlertTriangle size={16} />
            <span>这个页面不依赖数据库选井，专门用于检查井筒视觉效果。</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
