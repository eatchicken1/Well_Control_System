import { Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from '../lib/wellboreState';
import type { WellboreStructureSection } from '../lib/wellboreSimulation';
import { WellboreSchemaFigure } from './WellboreSchemaFigure';

function formatDepth(value?: number | null) {
  return Number.isFinite(value) ? `${Math.round(value as number).toLocaleString('zh-CN')} m` : '--';
}

export interface WellboreStatusViewProps {
  wellName: string;
  wellDepth?: number | null;
  bitDepth?: number | null;
  formation?: string;
  backendLevel: BackendLevel;
  activeSignals: string[];
  pumpState?: string;
  condition?: string;
  wellboreSections?: WellboreStructureSection[];
  cycleInfo?: CycleInfo;
  flowIn: number | null;
  flowOut: number | null;
  pitGain: number | null;
  pitVolume: number | null;
  spp: number | null;
  casingPressure: number | null;
  totalGas: number | null;
  mudWeight: number | null;
  spm: number | null;
  hasSamples: boolean;
  isRecovering: boolean;
  isStopped: boolean;
}

export function WellboreStatusThumbnail(props: WellboreStatusViewProps) {
  const navigate = useNavigate();
  const state = deriveWellboreState({
    backendLevel: props.backendLevel,
    pumpState: props.pumpState,
    condition: props.condition,
    cycleState: props.cycleInfo?.state,
    flowIn: props.flowIn,
    flowOut: props.flowOut,
    spm: props.spm,
    hasSamples: props.hasSamples,
    isRecovering: props.isRecovering,
    isStopped: props.isStopped,
  });
  const meta = getWellboreStateMeta(state);
  const conditionLabel = formatWellboreConditionLabel(props.condition);
  const openDetail = () => navigate('/monitoring/wellbore-status');

  return (
    <section className="wellbore-thumbnail-card">
      <header className="wellbore-thumbnail-head">
        <div>
          <div className="wellbore-eyebrow">{props.wellName} · {props.formation || '层位待定'}</div>
          <div className="wellbore-thumbnail-title-row">
            <h2>井筒状态缩略图</h2>
            <span className="wellbore-thumbnail-level" data-tone={meta.tone}>L{props.backendLevel}</span>
          </div>
        </div>
        <button type="button" className="wellbore-ghost-button" onClick={openDetail}><Maximize2 size={14} />点击放大</button>
      </header>

      <button type="button" className="wellbore-thumbnail-figure" onClick={openDetail} aria-label="放大查看井筒状态">
        <WellboreSchemaFigure
          mode="thumbnail"
          wellboreSections={props.wellboreSections}
          wellDepth={props.wellDepth}
          bitDepth={props.bitDepth}
          flowIn={props.flowIn}
          flowOut={props.flowOut}
          spm={props.spm}
          casingPressure={props.casingPressure}
          drillPipePressure={props.spp}
          pitGain={props.pitGain}
          pitVolume={props.pitVolume}
          totalGas={props.totalGas}
          mudWeight={props.mudWeight}
          backendLevel={props.backendLevel}
          activeSignals={props.activeSignals}
          pumpState={props.pumpState}
          condition={props.condition}
          cycleInfo={props.cycleInfo}
          hasSamples={props.hasSamples}
          isRecovering={props.isRecovering}
          isStopped={props.isStopped}
        />
      </button>

      <div className="wellbore-thumbnail-readouts">
        <div><span>井深</span><strong>{formatDepth(props.wellDepth)}</strong></div>
        <div><span>钻头</span><strong>{formatDepth(props.bitDepth)}</strong></div>
        <div><span>当前工况</span><strong>{conditionLabel || meta.label}</strong></div>
      </div>
    </section>
  );
}
