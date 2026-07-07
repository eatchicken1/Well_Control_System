import { Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from '../lib/wellboreState';
import { WellSchematic } from './WellSchematic';

export interface WellboreStatusViewProps {
  wellName: string;
  wellDepth?: number;
  bitDepth?: number;
  formation?: string;
  backendLevel: BackendLevel;
  activeSignals: string[];
  pumpState?: string;
  condition?: string;
  cycleInfo?: CycleInfo;
  flowIn: number;
  flowOut: number;
  pitVolume: number;
  spp: number;
  casingPressure: number;
  totalGas: number;
  spm: number;
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
          <h2>井筒状态缩略图</h2>
        </div>
        <button type="button" className="wellbore-ghost-button" onClick={openDetail}><Maximize2 size={14} />点击放大</button>
      </header>

      <button type="button" className="wellbore-thumbnail-figure" onClick={openDetail} aria-label="放大查看井筒状态">
        <WellSchematic
          mode="thumbnail"
          wellDepth={props.wellDepth}
          bitDepth={props.bitDepth}
          flowIn={props.flowIn}
          flowOut={props.flowOut}
          spm={props.spm}
          casingPressure={props.casingPressure}
          drillPipePressure={props.spp}
          pitGain={props.pitVolume}
          returnResponse={0}
          totalGas={props.totalGas}
          backendLevel={props.backendLevel}
          activeSignals={props.activeSignals}
          pumpState={props.pumpState}
          condition={props.condition}
          cycleInfo={props.cycleInfo}
          hasSamples={props.hasSamples}
          isRecovering={props.isRecovering}
          isStopped={props.isStopped}
          compact
          surface="light"
        />
      </button>

      <div className="wellbore-status-line" data-tone={meta.tone}>
        <span>当前工况</span><strong>{conditionLabel}</strong>
        <i aria-hidden="true" />
        <span>状态评估</span><strong>{meta.label}</strong>
      </div>

    </section>
  );
}
