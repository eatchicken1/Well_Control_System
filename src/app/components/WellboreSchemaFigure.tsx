import baseSvg from '@/assets/wellbore/wellbore-schema-base.svg';
import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { buildWellboreSimulationModel, type WellboreTone } from '../lib/wellboreSimulation';

interface WellboreSchemaFigureProps {
  mode?: 'thumbnail' | 'detail';
  backendLevel: BackendLevel;
  wellDepth?: number;
  bitDepth?: number;
  flowIn: number;
  flowOut: number;
  spm?: number;
  casingPressure: number;
  drillPipePressure: number;
  pitGain: number;
  pitVolume?: number;
  returnResponse?: number;
  totalGas?: number;
  activeSignals?: string[];
  pumpState?: string;
  condition?: string;
  cycleInfo?: CycleInfo;
  hasSamples?: boolean;
  isRecovering?: boolean;
  isStopped?: boolean;
}

const VIEW_BOX = '0 0 420 850';
const TOP_Y = 64;
const BOTTOM_Y = 786;
const CENTER_X = 210;

const LABELS = {
  aria: '\u4e95\u7b52\u72b6\u6001\u5de5\u7a0b\u5256\u9762',
  normal: '\u6b63\u5e38\u5faa\u73af',
  watch: '\u89c2\u5bdf\u8def\u5f84',
  kick: '\u7591\u4f3c\u4e0a\u8fd4\u8def\u5f84',
  influx: '\u5f02\u5e38\u4fb5\u5165\u70b9',
  bit: '\u94bb\u5934',
  shoe: '\u5957\u7ba1\u978b',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function depthToY(depth: number, wellDepth: number) {
  return TOP_Y + (clamp(depth, 0, wellDepth) / wellDepth) * (BOTTOM_Y - TOP_Y);
}

function toneColor(tone: WellboreTone) {
  if (tone === 'critical') return '#dc2626';
  if (tone === 'warning') return '#ef4444';
  if (tone === 'watch') return '#f97316';
  return '#0f766e';
}

function levelColor(level: BackendLevel) {
  if (level >= 4) return '#dc2626';
  if (level >= 2) return '#ef4444';
  if (level === 1) return '#f97316';
  return '#0f766e';
}

function shortText(value: string, max = 14) {
  return value.length > max ? `${value.slice(0, max - 2)}...` : value;
}

function StatusPill({
  x,
  y,
  width,
  title,
  copy,
  color,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  copy: string;
  color: string;
}) {
  return (
    <g className="wellbore-status-breathe" fontFamily="Microsoft YaHei, PingFang SC, Arial" aria-label={title}>
      <rect x={x} y={y} width={width} height="46" rx="7" fill="#ffffff" stroke={color} strokeWidth="1.3" opacity="0.95" />
      <circle cx={x + 16} cy={y + 18} r="4" fill={color} />
      <text x={x + 28} y={y + 19} fill={color} fontSize="11" fontWeight="800">{title}</text>
      <text x={x + 14} y={y + 35} fill="#475569" fontSize="9.2">{shortText(copy)}</text>
    </g>
  );
}

export function WellboreSchemaFigure({
  mode = 'thumbnail',
  backendLevel,
  wellDepth,
  bitDepth,
  flowIn,
  flowOut,
  spm = 0,
  casingPressure,
  drillPipePressure,
  pitGain,
  pitVolume,
  returnResponse = 0,
  totalGas = 0,
  activeSignals = [],
  pumpState,
  condition,
  cycleInfo,
  hasSamples = true,
  isRecovering = false,
  isStopped = false,
}: WellboreSchemaFigureProps) {
  const model = buildWellboreSimulationModel({
    backendLevel,
    flowIn,
    flowOut,
    returnResponse,
    pitGain,
    pitVolume: pitVolume ?? pitGain,
    drillPipePressure,
    casingPressure,
    totalGas,
    spm,
    wellDepth,
    bitDepth,
    activeSignals,
    pumpState,
    condition,
    cycleInfo,
    hasSamples,
    isRecovering,
    isStopped,
  });

  const isDetail = mode === 'detail';
  const color = levelColor(backendLevel);
  const bitY = depthToY(model.bitDepth, model.wellDepth);
  const kickY = depthToY(model.kickPointDepth, model.wellDepth);
  const watchY = depthToY(model.observationDepth, model.wellDepth);
  const shoeY = depthToY(model.casingShoeDepth, model.wellDepth);
  const topReturnY = TOP_Y + 72;
  const returnStartY = Math.max(bitY - 18, shoeY + 28);
  const evidenceNote = model.evidenceNotes[0] || model.statusDescription;

  return (
    <div className={`wellbore-schema-figure wellbore-schema-figure-${mode}`}>
      <img className="wellbore-schema-base" src={baseSvg} alt={LABELS.aria} draggable={false} />
      <svg
        className="wellbore-schema-overlay"
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${LABELS.aria} L${backendLevel} ${model.statusLabel}`}
      >
        {model.evidenceBands.map((band) => {
          const y = depthToY(band.from, model.wellDepth);
          const endY = depthToY(band.to, model.wellDepth);
          const bandColor = toneColor(band.tone);
          const x = band.lane === 'formation' ? CENTER_X + 28 : CENTER_X - 42;
          const width = band.lane === 'formation' ? 58 : 84;
          return <rect key={band.key} x={x} y={y} width={width} height={Math.max(14, endY - y)} rx="8" fill={bandColor} opacity={band.opacity ?? 0.18} />;
        })}

        {model.flowState.showNormalPath ? (
          <g aria-label={LABELS.normal}>
            <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M ${CENTER_X} ${TOP_Y + 8} V ${Math.max(bitY - 20, TOP_Y + 40)}`} />
            <path className="wellbore-flow-path wellbore-flow-path-normal" d={`M ${CENTER_X - 25} ${returnStartY} C ${CENTER_X - 42} ${(returnStartY + topReturnY) / 2} ${CENTER_X - 39} ${topReturnY + 42} ${CENTER_X - 20} ${topReturnY}`} />
            <path className="wellbore-flow-path wellbore-flow-path-normal" d={`M ${CENTER_X + 25} ${returnStartY} C ${CENTER_X + 42} ${(returnStartY + topReturnY) / 2} ${CENTER_X + 39} ${topReturnY + 42} ${CENTER_X + 20} ${topReturnY}`} />
          </g>
        ) : null}

        {model.flowState.showWatchPath ? (
          <g aria-label={LABELS.watch}>
            <path className="wellbore-flow-path wellbore-flow-path-warning" d={`M ${CENTER_X + 27} ${returnStartY} C ${CENTER_X + 47} ${(returnStartY + topReturnY) / 2} ${CENTER_X + 43} ${topReturnY + 46} ${CENTER_X + 21} ${topReturnY}`} />
            <circle className="wellbore-kick-pulse" cx={CENTER_X + 38} cy={watchY} r="15" fill="#f97316" opacity="0.16" />
            <circle cx={CENTER_X + 38} cy={watchY} r="5" fill="#f97316" opacity="0.86" />
          </g>
        ) : null}

        {model.flowState.showKickPath ? (
          <g aria-label={LABELS.kick}>
            <path className="wellbore-flow-path wellbore-flow-path-critical" d={`M ${CENTER_X - 28} ${returnStartY} C ${CENTER_X - 50} ${(returnStartY + topReturnY) / 2} ${CENTER_X - 46} ${topReturnY + 50} ${CENTER_X - 21} ${topReturnY}`} />
            <path className="wellbore-flow-path wellbore-flow-path-critical" d={`M ${CENTER_X + 28} ${returnStartY} C ${CENTER_X + 50} ${(returnStartY + topReturnY) / 2} ${CENTER_X + 46} ${topReturnY + 50} ${CENTER_X + 21} ${topReturnY}`} />
            <path className="wellbore-flow-path wellbore-flow-path-critical wellbore-flow-path-warning-level" d={`M ${CENTER_X + 86} ${kickY + 16} C ${CENTER_X + 66} ${kickY + 4} ${CENTER_X + 49} ${kickY} ${CENTER_X + 31} ${kickY}`} />
            <circle className="wellbore-kick-pulse" cx={CENTER_X + 31} cy={kickY} r="18" fill="#dc2626" opacity="0.2" />
            <circle cx={CENTER_X + 31} cy={kickY} r="6" fill="#dc2626" />
            {isDetail ? (
              <g fontFamily="Microsoft YaHei, PingFang SC, Arial">
                <rect x={CENTER_X + 80} y={kickY - 4} width="126" height="48" rx="7" fill="#fff7f7" stroke="#fca5a5" />
                <text x={CENTER_X + 92} y={kickY + 15} fill="#b91c1c" fontSize="11" fontWeight="800">{LABELS.influx}</text>
                <text x={CENTER_X + 92} y={kickY + 32} fill="#7f1d1d" fontSize="8.8">{shortText(evidenceNote, 15)}</text>
              </g>
            ) : null}
          </g>
        ) : null}

        <g className="wellbore-bit-pulse" aria-label={LABELS.bit}>
          <circle cx={CENTER_X} cy={bitY} r={isDetail ? 18 : 14} fill={color} opacity="0.12" />
          <circle cx={CENTER_X} cy={bitY} r={isDetail ? 5.8 : 4.8} fill={color} opacity="0.82" />
        </g>

        {isDetail ? (
          <g fontFamily="Microsoft YaHei, PingFang SC, Arial">
            <line x1={CENTER_X + 48} y1={shoeY} x2={CENTER_X + 118} y2={shoeY} stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" />
            <text x={CENTER_X + 124} y={shoeY + 4} fontSize="10.5" fill="#334155">{LABELS.shoe} {Math.round(model.casingShoeDepth)} m</text>
            <line x1={CENTER_X + 18} y1={bitY} x2={CENTER_X + 88} y2={bitY} stroke={color} strokeWidth="1" strokeDasharray="4 4" />
            <text x={CENTER_X + 94} y={bitY + 4} fontSize="10.5" fill={color}>{LABELS.bit} {Math.round(model.bitDepth)} m</text>
          </g>
        ) : null}

        <StatusPill
          x={isDetail ? 26 : 18}
          y={isDetail ? 710 : 724}
          width={isDetail ? 170 : 148}
          title={`L${backendLevel} ${model.statusLabel}`}
          copy={model.conditionLabel}
          color={color}
        />
      </svg>
    </div>
  );
}

export default WellboreSchemaFigure;
