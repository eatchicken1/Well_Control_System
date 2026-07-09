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

const DETAIL_VIEW_BOX = '0 0 760 620';
const THUMB_VIEW_BOX = '0 0 420 620';

const DETAIL = {
  top: 64,
  bottom: 556,
  centerX: 358,
  baseX: 224,
  baseY: 38,
  baseW: 268,
  baseH: 540,
  axisX: 94,
  labelX: 536,
};

const THUMB = {
  top: 56,
  bottom: 566,
  centerX: 210,
  baseX: 86,
  baseY: 28,
  baseW: 248,
  baseH: 560,
  axisX: 42,
  labelX: 314,
};

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
  return DETAIL.top + (clamp(depth, 0, wellDepth) / wellDepth) * (DETAIL.bottom - DETAIL.top);
}

function depthToGeometryY(depth: number, wellDepth: number, geometry: typeof DETAIL | typeof THUMB) {
  return geometry.top + (clamp(depth, 0, wellDepth) / wellDepth) * (geometry.bottom - geometry.top);
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
  const geometry = isDetail ? DETAIL : THUMB;
  const color = levelColor(backendLevel);
  const bitY = depthToGeometryY(model.bitDepth, model.wellDepth, geometry);
  const kickY = depthToGeometryY(model.kickPointDepth, model.wellDepth, geometry);
  const watchY = depthToGeometryY(model.observationDepth, model.wellDepth, geometry);
  const shoeY = depthToGeometryY(model.casingShoeDepth, model.wellDepth, geometry);
  const topReturnY = geometry.top + 74;
  const returnStartY = Math.max(bitY - 18, shoeY + 28);
  const evidenceNote = model.evidenceNotes[0] || model.statusDescription;
  const ticks = [0, 1000, 2000, 3000, Math.round(model.wellDepth)].filter((value, index, all) => value <= model.wellDepth && all.indexOf(value) === index);

  return (
    <div className={`wellbore-schema-figure wellbore-schema-figure-${mode}`}>
      <svg
        className="wellbore-schema-overlay"
        viewBox={isDetail ? DETAIL_VIEW_BOX : THUMB_VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${LABELS.aria} L${backendLevel} ${model.statusLabel}`}
      >
        <defs>
          <linearGradient id={`wellborePanel-${mode}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
          <pattern id={`wellboreGrid-${mode}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#e2e8f0" strokeWidth="0.6" opacity="0.55" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill={`url(#wellborePanel-${mode})`} />
        <rect x={isDetail ? 22 : 12} y={isDetail ? 18 : 14} width={isDetail ? 716 : 396} height={isDetail ? 584 : 592} rx="10" fill={`url(#wellboreGrid-${mode})`} opacity="0.38" />
        <rect x={geometry.baseX - 22} y={geometry.baseY - 18} width={geometry.baseW + 44} height={geometry.baseH + 36} rx="10" fill="#ffffff" stroke="#dbe2ea" strokeWidth="1.2" />
        <image href={baseSvg} x={geometry.baseX} y={geometry.baseY} width={geometry.baseW} height={geometry.baseH} preserveAspectRatio="xMidYMid meet" />

        {isDetail ? (
          <g fontFamily="Microsoft YaHei, PingFang SC, Arial">
            <text x="36" y="42" fill="#0f172a" fontSize="15" fontWeight="800">井筒工程剖面</text>
            <text x="36" y="62" fill="#64748b" fontSize="10">wellschematicspy 底图 + 实时状态覆盖</text>
            <rect x="528" y="42" width="176" height="72" rx="8" fill="#ffffff" stroke="#dbe2ea" />
            <text x="544" y="65" fill="#0f172a" fontSize="12" fontWeight="800">结构参数</text>
            <text x="544" y="86" fill="#64748b" fontSize="10">井深 {Math.round(model.wellDepth)} m</text>
            <text x="624" y="86" fill="#64748b" fontSize="10">裸眼 {Math.round(model.openHoleLength)} m</text>
            <text x="544" y="104" fill="#64748b" fontSize="10">当前层位 {shortText(model.currentFormation, 8)}</text>
          </g>
        ) : null}

        <g aria-label="深度轴" fontFamily="Microsoft YaHei, PingFang SC, Arial">
          <line x1={geometry.axisX} y1={geometry.top} x2={geometry.axisX} y2={geometry.bottom} stroke="#94a3b8" strokeWidth="1" />
          {ticks.map((depth) => {
            const y = depthToGeometryY(depth, model.wellDepth, geometry);
            return (
              <g key={depth}>
                <line x1={geometry.axisX - 5} y1={y} x2={geometry.axisX + 5} y2={y} stroke="#94a3b8" strokeWidth="1" />
                <line x1={geometry.axisX + 12} y1={y} x2={geometry.baseX + geometry.baseW + 26} y2={y} stroke="#cbd5e1" strokeWidth="0.7" strokeDasharray="4 7" opacity="0.7" />
                <text x={geometry.axisX - 10} y={y + 4} fill="#64748b" fontSize={isDetail ? '10' : '9'} textAnchor="end">{depth}</text>
              </g>
            );
          })}
        </g>

        {model.evidenceBands.map((band) => {
          const y = depthToGeometryY(band.from, model.wellDepth, geometry);
          const endY = depthToGeometryY(band.to, model.wellDepth, geometry);
          const bandColor = toneColor(band.tone);
          const x = band.lane === 'formation' ? geometry.centerX + 38 : geometry.centerX - 48;
          const width = band.lane === 'formation' ? 66 : 96;
          return <rect key={band.key} x={x} y={y} width={width} height={Math.max(14, endY - y)} rx="8" fill={bandColor} opacity={band.opacity ?? 0.18} />;
        })}

        {model.flowState.showNormalPath ? (
          <g aria-label={LABELS.normal}>
            <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M ${geometry.centerX} ${geometry.top + 8} V ${Math.max(bitY - 20, geometry.top + 40)}`} />
            <path className="wellbore-flow-path wellbore-flow-path-normal" d={`M ${geometry.centerX - 32} ${returnStartY} C ${geometry.centerX - 58} ${(returnStartY + topReturnY) / 2} ${geometry.centerX - 48} ${topReturnY + 42} ${geometry.centerX - 22} ${topReturnY}`} />
            <path className="wellbore-flow-path wellbore-flow-path-normal" d={`M ${geometry.centerX + 32} ${returnStartY} C ${geometry.centerX + 58} ${(returnStartY + topReturnY) / 2} ${geometry.centerX + 48} ${topReturnY + 42} ${geometry.centerX + 22} ${topReturnY}`} />
          </g>
        ) : null}

        {model.flowState.showWatchPath ? (
          <g aria-label={LABELS.watch}>
            <path className="wellbore-flow-path wellbore-flow-path-warning" d={`M ${geometry.centerX + 34} ${returnStartY} C ${geometry.centerX + 58} ${(returnStartY + topReturnY) / 2} ${geometry.centerX + 50} ${topReturnY + 46} ${geometry.centerX + 22} ${topReturnY}`} />
            <circle className="wellbore-kick-pulse" cx={geometry.centerX + 42} cy={watchY} r="15" fill="#f97316" opacity="0.16" />
            <circle cx={geometry.centerX + 42} cy={watchY} r="5" fill="#f97316" opacity="0.86" />
          </g>
        ) : null}

        {model.flowState.showKickPath ? (
          <g aria-label={LABELS.kick}>
            <path className="wellbore-flow-path wellbore-flow-path-critical" d={`M ${geometry.centerX - 34} ${returnStartY} C ${geometry.centerX - 58} ${(returnStartY + topReturnY) / 2} ${geometry.centerX - 52} ${topReturnY + 50} ${geometry.centerX - 22} ${topReturnY}`} />
            <path className="wellbore-flow-path wellbore-flow-path-critical" d={`M ${geometry.centerX + 34} ${returnStartY} C ${geometry.centerX + 58} ${(returnStartY + topReturnY) / 2} ${geometry.centerX + 52} ${topReturnY + 50} ${geometry.centerX + 22} ${topReturnY}`} />
            <path className="wellbore-flow-path wellbore-flow-path-critical wellbore-flow-path-warning-level" d={`M ${geometry.centerX + 118} ${kickY + 16} C ${geometry.centerX + 86} ${kickY + 4} ${geometry.centerX + 62} ${kickY} ${geometry.centerX + 38} ${kickY}`} />
            <circle className="wellbore-kick-pulse" cx={geometry.centerX + 38} cy={kickY} r="18" fill="#dc2626" opacity="0.2" />
            <circle cx={geometry.centerX + 38} cy={kickY} r="6" fill="#dc2626" />
            {isDetail ? (
              <g fontFamily="Microsoft YaHei, PingFang SC, Arial">
                <rect x={geometry.centerX + 112} y={kickY - 6} width="156" height="50" rx="7" fill="#fff7f7" stroke="#fca5a5" />
                <text x={geometry.centerX + 126} y={kickY + 14} fill="#b91c1c" fontSize="11" fontWeight="800">{LABELS.influx}</text>
                <text x={geometry.centerX + 126} y={kickY + 32} fill="#7f1d1d" fontSize="8.8">{shortText(evidenceNote, 18)}</text>
              </g>
            ) : null}
          </g>
        ) : null}

        <g className="wellbore-bit-pulse" aria-label={LABELS.bit}>
          <circle cx={geometry.centerX} cy={bitY} r={isDetail ? 18 : 14} fill={color} opacity="0.12" />
          <circle cx={geometry.centerX} cy={bitY} r={isDetail ? 5.8 : 4.8} fill={color} opacity="0.82" />
        </g>

        {isDetail ? (
          <g fontFamily="Microsoft YaHei, PingFang SC, Arial">
            <line x1={geometry.centerX + 58} y1={shoeY} x2={geometry.labelX} y2={shoeY} stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" />
            <text x={geometry.labelX + 8} y={shoeY + 4} fontSize="10.5" fill="#334155">{LABELS.shoe} {Math.round(model.casingShoeDepth)} m</text>
            <line x1={geometry.centerX + 22} y1={bitY} x2={geometry.labelX} y2={bitY} stroke={color} strokeWidth="1" strokeDasharray="4 4" />
            <text x={geometry.labelX + 8} y={bitY + 4} fontSize="10.5" fill={color}>{LABELS.bit} {Math.round(model.bitDepth)} m</text>
          </g>
        ) : null}

        <StatusPill
          x={isDetail ? 38 : 20}
          y={isDetail ? 500 : 524}
          width={isDetail ? 176 : 148}
          title={`L${backendLevel} ${model.statusLabel}`}
          copy={model.conditionLabel}
          color={color}
        />
      </svg>
    </div>
  );
}

export default WellboreSchemaFigure;
