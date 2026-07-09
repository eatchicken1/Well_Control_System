import { Activity, AlertTriangle, ArrowLeft, Database, Flame, Gauge } from 'lucide-react';
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
    bitDepth: 3860,
    flowIn: 32.4,
    flowOut: level >= 2 ? 38.8 : level === 1 ? 34.1 : 32.2,
    spm: 62,
    casingPressure: level >= 2 ? 4.6 : 1.1,
    spp: level >= 2 ? 13.7 : 15.2,
    pitGain: level >= 2 ? 1.86 : level === 1 ? 0.42 : 0.04,
    pitVolume: level >= 2 ? 122.6 : 118.2,
    totalGas: level >= 2 ? 1.42 : 0.18,
    activeSignals: level >= 2 ? ['return_response', 'pit_gain', 'pit_volume', 'total_gas', 'casing_pressure'] : level === 1 ? ['return_response'] : [],
    condition: level >= 2 ? 'KickPreview' : level === 1 ? 'WatchPreview' : 'StablePreview',
  };
}

export default function WellborePreview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const level = toLevel(searchParams.get('level'));
  const data = previewData(level);
  const abnormal = level >= 2;

  const setLevel = (next: BackendLevel) => setSearchParams({ level: String(next) });

  return (
    <main className="wellbore-preview-page">
      <header className="wellbore-preview-toolbar">
        <Link to="/monitoring/wellbore-status?preview=1&level=3" className="wellbore-back-button">
          <ArrowLeft size={16} />进入系统页
        </Link>
        <div className="wellbore-preview-title">
          <strong>井筒模拟效果预览</strong>
          <span>wellschematicspy 井筒底图 + React 实时状态覆盖</span>
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
            <p>{abnormal ? '异常侵入点、疑似上返路径、出口流量与池体积证据会在图中同步高亮。' : level === 1 ? '观察路径和浅色证据带用于展示轻微偏离。' : '正常循环路径以绿色虚线展示，井筒结构保持清晰可读。'}</p>
          </section>
          <div className="wellbore-preview-metrics">
            <div><Activity size={18} /><span>出口流量</span><strong>{data.flowOut.toFixed(1)} L/s</strong></div>
            <div><Database size={18} /><span>池增量</span><strong>{data.pitGain.toFixed(2)} m³</strong></div>
            <div><Gauge size={18} /><span>立压</span><strong>{data.spp.toFixed(2)} MPa</strong></div>
            <div><Flame size={18} /><span>全烃</span><strong>{data.totalGas.toFixed(2)}%</strong></div>
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
