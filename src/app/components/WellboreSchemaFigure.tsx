import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { buildWellboreSimulationModel, type WellboreSimulationModel, type WellboreTone } from '../lib/wellboreSimulation';

interface WellboreSchemaFigureProps {
  mode?: 'thumbnail' | 'detail';
  backendLevel: BackendLevel;
  wellDepth?: number;
  bitDepth?: number;
  drillPipeOD?: number;
  bhaOD?: number;
  bitOD?: number;
  casingID?: number;
  openHoleDiameter?: number;
  flowIn: number;
  flowOut: number;
  spm?: number;
  casingPressure: number;
  drillPipePressure: number;
  pitGain: number;
  pitVolume?: number;
  returnResponse?: number;
  totalGas?: number;
  mudWeight?: number;
  ecd?: number;
  porePressureEquivalent?: number;
  fractureGradientEquivalent?: number;
  influxFromDepth?: number;
  influxToDepth?: number;
  influxConfidence?: number;
  influxSource?: 'measured' | 'estimated' | 'unknown';
  influxSide?: 'left' | 'right' | 'highSide' | 'unknown';
  gasFrontDepth?: number;
  gasColumnBottomDepth?: number;
  gasFraction?: number;
  inclination?: number;
  highSideDirection?: number;
  activeSignals?: string[];
  pumpState?: string;
  condition?: string;
  cycleInfo?: CycleInfo;
  hasSamples?: boolean;
  isRecovering?: boolean;
  isStopped?: boolean;
}

type Geometry = {
  viewBox: string;
  width: number;
  height: number;
  top: number;
  bottom: number;
  centerX: number;
  axisX: number;
  labelX: number;
  formationX: number;
  formationW: number;
  scale: number;
};

type WellboreVisualState = {
  downflowColor: string;
  returnFlowColor: string;
  returnFlowOpacity: number;
  showObservationBand: boolean;
  showInfluxSource: boolean;
  showMigrationPath: boolean;
  showTwoPhaseZone: boolean;
  animationIntensity: 'none' | 'low' | 'medium' | 'high';
};

const DETAIL: Geometry = { viewBox: '0 0 660 640', width: 660, height: 640, top: 78, bottom: 584, centerX: 282, axisX: 38, labelX: 418, formationX: 536, formationW: 46, scale: 1.68 };
const THUMB: Geometry = { viewBox: '0 0 520 640', width: 520, height: 640, top: 70, bottom: 584, centerX: 246, axisX: 48, labelX: 354, formationX: 416, formationW: 44, scale: 0.64 };

const LEVEL_LABEL: Record<BackendLevel, string> = { 0: '正常循环', 1: '异常观察', 2: '溢流预警', 3: '疑似溢流', 4: '溢流确认' };
const TEXT = { aria: '井筒状态工程剖面', bit: '钻头', shoe: '套管鞋', influx: '推测侵入区', openHole: '裸眼段', casing: '套管', cement: '水泥环', drill: '钻柱 / BHA' };
const VISUAL_STATES: Record<BackendLevel, WellboreVisualState> = {
  0: { downflowColor: '#2563eb', returnFlowColor: '#0f766e', returnFlowOpacity: 0.76, showObservationBand: false, showInfluxSource: false, showMigrationPath: false, showTwoPhaseZone: false, animationIntensity: 'low' },
  1: { downflowColor: '#2563eb', returnFlowColor: '#f97316', returnFlowOpacity: 0.7, showObservationBand: true, showInfluxSource: false, showMigrationPath: false, showTwoPhaseZone: false, animationIntensity: 'low' },
  2: { downflowColor: '#2563eb', returnFlowColor: '#0f766e', returnFlowOpacity: 0.72, showObservationBand: true, showInfluxSource: true, showMigrationPath: false, showTwoPhaseZone: false, animationIntensity: 'medium' },
  3: { downflowColor: '#2563eb', returnFlowColor: '#ea580c', returnFlowOpacity: 0.78, showObservationBand: true, showInfluxSource: true, showMigrationPath: true, showTwoPhaseZone: true, animationIntensity: 'medium' },
  4: { downflowColor: '#2563eb', returnFlowColor: '#dc2626', returnFlowOpacity: 0.86, showObservationBand: true, showInfluxSource: true, showMigrationPath: true, showTwoPhaseZone: true, animationIntensity: 'high' },
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function yOf(depth: number, model: WellboreSimulationModel, g: Geometry) { return g.top + (clamp(depth, 0, model.wellDepth) / model.wellDepth) * (g.bottom - g.top); }
function wOf(width: number, g: Geometry) { return Math.max(10, width * g.scale); }
function hydraulicWidth(width: number, g: Geometry, kind: 'bore' | 'pipe' | 'bha' | 'bit') {
  const minimum = kind === 'bore' ? 22 : kind === 'pipe' ? 7 : kind === 'bha' ? 12 : 22;
  const visualScale = g.scale * (kind === 'bore' ? 0.88 : 0.94);
  return Math.max(minimum, width * visualScale);
}
function depth(value: number) { return `${Math.round(value)} m`; }
function short(value: string, max = 18) { return value.length > max ? `${value.slice(0, max - 2)}...` : value; }
function levelColor(level: BackendLevel) { if (level >= 4) return '#dc2626'; if (level >= 2) return '#ef4444'; if (level === 1) return '#f97316'; return '#0f766e'; }
function toneColor(tone: WellboreTone) { if (tone === 'critical') return '#dc2626'; if (tone === 'warning') return '#ef4444'; if (tone === 'watch') return '#f97316'; return '#0f766e'; }

function sectionLanes(model: WellboreSimulationModel, g: Geometry) {
  return model.sectionGeometry.map((section) => {
    const toolKind = section.sectionType === 'bit' ? 'bit' : section.sectionType === 'bha' ? 'bha' : 'pipe';
    const boreWidth = hydraulicWidth(section.boreInnerWidth, g, 'bore');
    const drillWidth = hydraulicWidth(section.drillOuterWidth, g, toolKind);
    const annulusGap = Math.max(3.2, (boreWidth - drillWidth) / 2);
    const laneOffset = drillWidth / 2 + annulusGap / 2;
    return {
      ...section,
      boreWidth,
      drillWidth,
      annulusGap,
      topY: yOf(section.fromDepth, model, g),
      bottomY: yOf(section.toDepth, model, g),
      leftX: g.centerX - laneOffset,
      rightX: g.centerX + laneOffset,
      laneWidth: Math.max(3.2, Math.min(7.5, annulusGap * 0.34)),
    };
  });
}

function annulusPath(model: WellboreSimulationModel, g: Geometry, side: 'left' | 'right') {
  const sections = sectionLanes(model, g).slice().reverse();
  if (!sections.length) return '';
  const xOf = (section: (typeof sections)[number]) => side === 'left' ? section.leftX : section.rightX;
  let path = `M ${xOf(sections[0])} ${sections[0].bottomY}`;
  sections.forEach((section, index) => {
    const x = xOf(section);
    const next = sections[index + 1];
    if (!next) {
      path += ` L ${x} ${section.topY}`;
      return;
    }
    const nextX = xOf(next);
    const transition = Math.min(7, Math.max(3, (section.bottomY - section.topY) * 0.08));
    path += ` L ${x} ${section.topY + transition}`;
    path += ` C ${x} ${section.topY + transition * 0.35} ${nextX} ${section.topY - transition * 0.35} ${nextX} ${section.topY - transition}`;
  });
  return path;
}

function laneAtDepth(model: WellboreSimulationModel, g: Geometry, depthValue: number, side: 'left' | 'right') {
  const sections = sectionLanes(model, g);
  const section = sections.find((item) => depthValue >= item.fromDepth && depthValue <= item.toDepth) ?? sections[sections.length - 1];
  return side === 'left' ? section.leftX : section.rightX;
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`panel-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#f8fafc" /></linearGradient>
      <linearGradient id={`steel-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#64748b" /><stop offset="42%" stopColor="#334155" /><stop offset="58%" stopColor="#94a3b8" /><stop offset="100%" stopColor="#475569" /></linearGradient>
      <linearGradient id={`drill-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#bfdbfe" /><stop offset="48%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#dbeafe" /></linearGradient>
      <linearGradient id={`mud-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.28" /><stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.12" /></linearGradient>
      <linearGradient id={`slug-${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#f97316" stopOpacity="0.18" /><stop offset="48%" stopColor="#dc2626" stopOpacity="0.46" /><stop offset="100%" stopColor="#b91c1c" stopOpacity="0.18" /></linearGradient>
      <radialGradient id={`influx-${id}`} cx="45%" cy="50%" r="70%"><stop offset="0%" stopColor="#dc2626" stopOpacity="0.42" /><stop offset="48%" stopColor="#f97316" stopOpacity="0.24" /><stop offset="100%" stopColor="#dc2626" stopOpacity="0" /></radialGradient>
      <pattern id={`grid-${id}`} width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0 L0 0 0 22" fill="none" stroke="#e2e8f0" strokeWidth="0.6" opacity="0.58" /></pattern>
      <pattern id={`cement-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#dbeafe" /><line x1="0" y1="0" x2="0" y2="8" stroke="#60a5fa" strokeWidth="1" opacity="0.62" /></pattern>
      <pattern id={`sand-${id}`} width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="0.8" fill="#a16207" opacity="0.32" /><circle cx="10" cy="9" r="0.65" fill="#a16207" opacity="0.22" /></pattern>
      <pattern id={`shale-${id}`} width="18" height="9" patternUnits="userSpaceOnUse"><path d="M0 5 Q4 2 9 5 T18 5" fill="none" stroke="#64748b" strokeWidth="0.55" opacity="0.36" /></pattern>
      <filter id={`soft-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.12" /></filter>
    </defs>
  );
}

function Header() {
  return (
    <g fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <text x="38" y="42" fill="#0f172a" fontSize="15" fontWeight="800">井筒工程剖面</text>
      <text x="38" y="61" fill="#64748b" fontSize="9.5">固定井身结构底图 · 状态仅通过流动与风险覆盖层表达</text>
    </g>
  );
}

function Axis({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  const ticks = Array.from(new Set([...Array.from({ length: Math.floor(model.wellDepth / 1000) + 1 }, (_, i) => i * 1000), Math.round(model.wellDepth)])).filter((v) => v <= model.wellDepth).sort((a, b) => a - b);
  return <g fontFamily="Microsoft YaHei, PingFang SC, Arial" aria-label="深度轴"><line x1={g.axisX} y1={g.top} x2={g.axisX} y2={g.bottom} stroke="#64748b" strokeWidth="1.2" />{ticks.map((d) => { const y = yOf(d, model, g); return <g key={d}><line x1={g.axisX - 6} y1={y} x2={g.axisX + 6} y2={y} stroke="#64748b" /><line x1={g.axisX + 16} y1={y} x2={g.formationX + g.formationW + 12} y2={y} stroke="#cbd5e1" strokeWidth="0.7" strokeDasharray="4 7" opacity="0.68" />{!compact ? <text x={g.axisX - 10} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">{d}</text> : null}</g>; })}</g>;
}

function Formations({ model, g, compact, id }: { model: WellboreSimulationModel; g: Geometry; compact: boolean; id: string }) {
  return <g aria-label="地层柱" fontFamily="Microsoft YaHei, PingFang SC, Arial"><rect x={g.formationX} y={g.top} width={g.formationW} height={g.bottom - g.top} fill="#fff" stroke="#cbd5e1" />{model.formationBands.map((band) => { const y = yOf(band.from, model, g); const h = Math.max(8, yOf(band.to, model, g) - y); return <g key={band.key}><rect x={g.formationX} y={y} width={g.formationW} height={h} fill={band.fill} /><rect x={g.formationX} y={y} width={g.formationW} height={h} fill={band.key === 'mudstone' ? `url(#shale-${id})` : `url(#sand-${id})`} opacity="0.62" />{!compact && h > 34 ? <text x={g.formationX + g.formationW / 2} y={y + Math.min(h / 2 + 4, h - 8)} fill={band.accent} fontSize="9" fontWeight="700" textAnchor="middle">{band.label}</text> : null}</g>; })}</g>;
}

function Tubulars({ model, g, id }: { model: WellboreSimulationModel; g: Geometry; id: string }) {
  return <g aria-label="套管与水泥环">{model.tubularStrings.map((item) => { const y1 = yOf(item.topDepth, model, g); const y2 = yOf(item.bottomDepth, model, g); const outer = wOf(item.outerWidth, g); const inner = wOf(item.innerWidth, g); const cementOuter = wOf(item.cementOuterWidth, g); const wall = Math.max(3.5, (outer - inner) / 2); const ol = g.centerX - outer / 2; const or = g.centerX + outer / 2; const il = g.centerX - inner / 2; const ir = g.centerX + inner / 2; const cl = g.centerX - cementOuter / 2; const cr = g.centerX + cementOuter / 2; return <g key={item.key}><path d={`M ${cl} ${y1} H ${ol} V ${y2} H ${cl} Z M ${or} ${y1} H ${cr} V ${y2} H ${or} Z`} fill={`url(#cement-${id})`} opacity="0.74" /><rect x={ol} y={y1} width={wall} height={Math.max(1, y2 - y1)} fill={`url(#steel-${id})`} stroke={item.stroke} strokeWidth="0.9" /><rect x={ir} y={y1} width={wall} height={Math.max(1, y2 - y1)} fill={`url(#steel-${id})`} stroke={item.stroke} strokeWidth="0.9" /><path d={`M ${ol} ${y2} L ${il} ${y2 + 11} L ${il} ${y2 + 15} L ${ol} ${y2 + 4} Z`} fill={item.stroke} /><path d={`M ${or} ${y2} L ${ir} ${y2 + 11} L ${ir} ${y2 + 15} L ${or} ${y2 + 4} Z`} fill={item.stroke} /></g>; })}</g>;
}

function FluidColumn({ model, g, id, level }: { model: WellboreSimulationModel; g: Geometry; id: string; level: BackendLevel }) {
  const kickTone = level >= 2;
  const sections = sectionLanes(model, g);
  return (
    <g aria-label="双侧环空钻井液通道底色">
      <rect x={g.centerX - 3} y={g.top + 7} width="6" height={Math.max(20, yOf(model.bitDepth, model, g) - g.top - 9)} rx="3" fill={`url(#mud-${id})`} />
      {sections.map((section) => (
        <g key={section.sectionType + section.fromDepth}>
          <rect x={section.leftX - section.laneWidth / 2} y={section.topY} width={section.laneWidth} height={Math.max(2, section.bottomY - section.topY)} rx="4" fill={kickTone ? "#fff1ed" : "#ccfbf1"} opacity={kickTone ? 0.2 : 0.17} />
          <rect x={section.rightX - section.laneWidth / 2} y={section.topY} width={section.laneWidth} height={Math.max(2, section.bottomY - section.topY)} rx="4" fill={kickTone ? "#fff1ed" : "#ccfbf1"} opacity={kickTone ? 0.2 : 0.17} />
        </g>
      ))}
      <path d={annulusPath(model, g, "left")} fill="none" stroke={kickTone ? "#fed7aa" : "#99f6e4"} strokeWidth="0.75" strokeDasharray="2 8" strokeDashoffset="1" opacity="0.54" />
      <path d={annulusPath(model, g, "right")} fill="none" stroke={kickTone ? "#fed7aa" : "#99f6e4"} strokeWidth="0.75" strokeDasharray="2 8" strokeDashoffset="1" opacity="0.54" />
    </g>
  );
}

function TubularJointMarks({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  if (compact) return null;
  return (
    <g aria-label="套管接箍示意" opacity="0.55">
      {model.tubularStrings.map((item) => {
        const outer = wOf(item.outerWidth, g);
        const inner = wOf(item.innerWidth, g);
        const wall = Math.max(3.5, (outer - inner) / 2);
        const ol = g.centerX - outer / 2;
        const ir = g.centerX + inner / 2;
        const depths = [0.22, 0.46, 0.7].map((p) => item.topDepth + (item.bottomDepth - item.topDepth) * p).filter((d) => d > item.topDepth + 80 && d < item.bottomDepth - 80);
        return depths.map((d) => {
          const y = yOf(d, model, g);
          return <g key={`${item.key}-${d}`}><line x1={ol - 3} y1={y} x2={ol + wall + 3} y2={y} stroke="#0f172a" strokeWidth="0.8" /><line x1={ir - 3} y1={y} x2={ir + wall + 3} y2={y} stroke="#0f172a" strokeWidth="0.8" /></g>;
        });
      })}
    </g>
  );
}

function OpenHole({ model, g }: { model: WellboreSimulationModel; g: Geometry }) {
  const y1 = yOf(model.openHoleStartDepth, model, g) + 10; const y2 = yOf(model.wellDepth, model, g); const half = hydraulicWidth(model.hydraulicGeometry.openHoleDiameter, g, 'bore') / 2; const left = g.centerX - half; const right = g.centerX + half; const mid = y1 + (y2 - y1) * 0.52;
  const leftWall = `M ${left} ${y1} C ${left - 3} ${y1 + 58} ${left - 5} ${mid - 32} ${left - 4} ${mid} C ${left - 2} ${mid + 48} ${left - 4} ${y2 - 44} ${left - 1} ${y2 - 12}`;
  const rightWall = `M ${right} ${y1} C ${right + 3} ${y1 + 58} ${right + 5} ${mid - 32} ${right + 4} ${mid} C ${right + 2} ${mid + 48} ${right + 4} ${y2 - 44} ${right + 1} ${y2 - 12}`;
  const fill = `M ${left} ${y1} C ${left - 3} ${y1 + 58} ${left - 5} ${mid - 32} ${left - 4} ${mid} C ${left - 2} ${mid + 48} ${left - 4} ${y2 - 44} ${left - 1} ${y2 - 12} Q ${g.centerX} ${y2 + 1} ${right + 1} ${y2 - 12} C ${right + 4} ${y2 - 44} ${right + 2} ${mid + 48} ${right + 4} ${mid} C ${right + 5} ${mid - 32} ${right + 3} ${y1 + 58} ${right} ${y1} Z`;
  const rugosity = [0.16, 0.28, 0.4, 0.55, 0.68, 0.82].map((p, index) => ({ y: y1 + (y2 - y1 - 28) * p, len: index % 2 === 0 ? 7 : 5 }));
  const bottomDots = [-16, -8, 1, 10, 18].map((dx, index) => ({ x: g.centerX + dx, y: y2 - 8 - (index % 2) * 3 }));
  return (
    <g aria-label={TEXT.openHole}>
      <path d={fill} fill="#fff7ed" opacity="0.2" />
      {rugosity.map((item, index) => (
        <g key={item.y} className="wellbore-openhole-detail">
          <line x1={left - 1} y1={item.y} x2={left - item.len} y2={item.y + (index % 2 ? 2 : -2)} stroke="#94a3b8" strokeWidth="0.75" strokeLinecap="round" opacity="0.55" />
          <line x1={right + 1} y1={item.y + 8} x2={right + item.len} y2={item.y + 7 + (index % 2 ? -2 : 2)} stroke="#94a3b8" strokeWidth="0.75" strokeLinecap="round" opacity="0.55" />
        </g>
      ))}
      <path d={leftWall} fill="none" stroke="#475569" strokeWidth="1.65" strokeLinecap="round" />
      <path d={rightWall} fill="none" stroke="#475569" strokeWidth="1.65" strokeLinecap="round" />
      <path d={`M ${left - 1} ${y2 - 12} Q ${g.centerX} ${y2 + 1} ${right + 1} ${y2 - 12}`} fill="none" stroke="#475569" strokeWidth="1.15" opacity="0.72" />
      <g opacity="0.72">
        {bottomDots.map((dot) => <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="1.1" fill="#64748b" />)}
      </g>
    </g>
  );
}

function Surface({ g }: { g: Geometry }) {
  return <g aria-label="井口简化示意"><path d={`M ${g.centerX - 66} ${g.top} H ${g.centerX + 66}`} stroke="#94a3b8" strokeWidth="1.1" /><rect x={g.centerX - 18} y={g.top - 8} width="36" height="8" rx="1.5" fill="#e2e8f0" stroke="#64748b" /></g>;
}

function DrillString({ model, g, id }: { model: WellboreSimulationModel; g: Geometry; id: string }) {
  const bitY = yOf(model.bitDepth, model, g);
  const bhaSection = model.sectionGeometry.find((section) => section.sectionType === 'bha');
  const bitSection = model.sectionGeometry.find((section) => section.sectionType === 'bit');
  const bhaTop = bhaSection ? yOf(bhaSection.fromDepth, model, g) : Math.max(bitY - 86, g.top + 50);
  const bitTop = bitSection ? yOf(bitSection.fromDepth, model, g) : bitY - 26;
  const assemblyHeight = Math.max(22, bitTop - bhaTop);
  const hwdpBottom = bhaTop + assemblyHeight * 0.28;
  const collarTop = bhaTop + assemblyHeight * 0.38;
  const stabilizerY = bhaTop + assemblyHeight * 0.66;
  const pipeWidth = hydraulicWidth(model.hydraulicGeometry.drillPipeOD, g, 'pipe');
  const hwdpWidth = Math.min(hydraulicWidth(model.hydraulicGeometry.bhaOD, g, 'bha') * 0.72, pipeWidth + 8);
  const bhaWidth = hydraulicWidth(model.hydraulicGeometry.bhaOD, g, 'bha');
  const stabilizerWidth = Math.min(hydraulicWidth(model.hydraulicGeometry.openHoleDiameter, g, 'bore') - 8, bhaWidth + 12);
  const bitWidth = hydraulicWidth(model.hydraulicGeometry.bitOD, g, 'bit');
  const bitBodyTop = Math.max(bitTop, bitY - Math.max(13, bitWidth * 0.3));
  const pipeJointYs = [0.23, 0.48, 0.73].map((p) => g.top + (bhaTop - g.top) * p);
  return (
    <g aria-label={TEXT.drill}>
      <rect x={g.centerX - pipeWidth / 2} y={g.top} width={pipeWidth} height={Math.max(24, bhaTop - g.top)} fill={`url(#drill-${id})`} stroke="#2563eb" strokeWidth="1.15" />
      {pipeJointYs.map((y) => <line key={y} x1={g.centerX - pipeWidth / 2 - 1.5} y1={y} x2={g.centerX + pipeWidth / 2 + 1.5} y2={y} stroke="#1d4ed8" strokeWidth="0.85" opacity="0.58" />)}
      <path d={`M ${g.centerX - pipeWidth / 2} ${bhaTop} L ${g.centerX - hwdpWidth / 2} ${bhaTop + 7} V ${hwdpBottom} H ${g.centerX + hwdpWidth / 2} V ${bhaTop + 7} L ${g.centerX + pipeWidth / 2} ${bhaTop} Z`} fill={`url(#drill-${id})`} stroke="#1d4ed8" strokeWidth="1.05" />
      <rect x={g.centerX - bhaWidth / 2} y={collarTop} width={bhaWidth} height={Math.max(12, bitBodyTop - collarTop)} rx="2" fill={`url(#drill-${id})`} stroke="#1d4ed8" strokeWidth="1.15" />
      <rect x={g.centerX - stabilizerWidth / 2} y={stabilizerY - 3} width={stabilizerWidth} height="6" rx="2" fill="#1e40af" opacity="0.78" />
      <line x1={g.centerX - bhaWidth / 2 - 1} y1={collarTop + 8} x2={g.centerX + bhaWidth / 2 + 1} y2={collarTop + 8} stroke="#1e40af" strokeWidth="1" opacity="0.48" />
      <path d={`M ${g.centerX - bitWidth / 2} ${bitBodyTop} H ${g.centerX + bitWidth / 2} L ${g.centerX + bitWidth * 0.31} ${bitY - 4} L ${g.centerX + bitWidth * 0.08} ${bitY + 2} H ${g.centerX - bitWidth * 0.08} L ${g.centerX - bitWidth * 0.31} ${bitY - 4} Z`} fill="#64748b" stroke="#334155" strokeWidth="1.25" />
      <path d={`M ${g.centerX - bitWidth * 0.3} ${bitY - 3} L ${g.centerX - bitWidth * 0.43} ${bitY + 3} M ${g.centerX} ${bitY - 1} V ${bitY + 6} M ${g.centerX + bitWidth * 0.3} ${bitY - 3} L ${g.centerX + bitWidth * 0.43} ${bitY + 3}`} fill="none" stroke="#334155" strokeWidth="1.55" strokeLinecap="round" />
    </g>
  );
}
function BitHydraulics({ model, g, level }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel }) {
  const bitY = yOf(model.bitDepth, model, g);
  const bottomY = Math.min(bitY + 9, g.bottom - 3);
  const annulusRightX = laneAtDepth(model, g, model.bitDepth, "right");
  const annulusLeftX = laneAtDepth(model, g, model.bitDepth, "left");
  const returnColor = level >= 2 ? "#f97316" : "#0f766e";
  return (
    <g className="wellbore-bit-hydraulics" aria-label="钻头喷嘴向左右环空分流">
      <path className="wellbore-bit-nozzle-flow" d={`M ${g.centerX - 7} ${bitY - 4} C ${g.centerX - 12} ${bitY + 3} ${g.centerX - 18} ${bottomY + 3} ${annulusLeftX} ${bottomY - 1}`} />
      <path className="wellbore-bit-nozzle-flow" d={`M ${g.centerX} ${bitY - 2} V ${bottomY + 4}`} />
      <path className="wellbore-bit-nozzle-flow" d={`M ${g.centerX + 7} ${bitY - 4} C ${g.centerX + 12} ${bitY + 3} ${g.centerX + 18} ${bottomY + 3} ${annulusRightX} ${bottomY - 1}`} />
      <path className="wellbore-bit-bottom-sweep" d={`M ${annulusLeftX} ${bottomY - 2} C ${g.centerX - 18} ${bottomY + 11} ${g.centerX + 18} ${bottomY + 11} ${annulusRightX} ${bottomY - 2}`} stroke={returnColor} opacity="0.5" />
    </g>
  );
}

function Flow({ model, g, level, id, visual }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel; id: string; visual: WellboreVisualState }) {
  const bitY = yOf(model.bitDepth, model, g);
  const localization = model.influxLocalization;
  const sourceDepth = (localization.fromDepth + localization.toDepth) / 2;
  const sourceY = yOf(sourceDepth, model, g);
  const leftPath = annulusPath(model, g, "left");
  const rightPath = annulusPath(model, g, "right");
  const drillPath = `M ${g.centerX} ${g.top + 4} V ${Math.min(bitY - 16, g.bottom - 18)}`;
  const sourceSide = localization.side === "left" ? "left" : "right";
  const sourceLaneX = laneAtDepth(model, g, sourceDepth, sourceSide);
  const sourceDirection = sourceSide === "left" ? -1 : 1;
  const formationX = sourceLaneX + sourceDirection * wOf(30, g);
  const sourcePath = `M ${formationX} ${sourceY} C ${formationX - sourceDirection * 10} ${sourceY - 5} ${sourceLaneX + sourceDirection * 9} ${sourceY - 2} ${sourceLaneX} ${sourceY + 2}`;
  const phaseFrontDepth = model.annulusPhaseState.gasFrontDepth;
  const phaseBottomDepth = model.annulusPhaseState.gasColumnBottomDepth;
  const phaseTopY = phaseFrontDepth === undefined ? sourceY : yOf(phaseFrontDepth, model, g);
  const phaseBottomY = phaseBottomDepth === undefined ? sourceY : yOf(phaseBottomDepth, model, g);
  const mixingDepth = Math.max(model.openHoleStartDepth + 80, sourceDepth - Math.max(120, model.openHoleLength * 0.18));
  const mixingY = yOf(mixingDepth, model, g);
  const laneDepth = Math.max(phaseFrontDepth ?? sourceDepth, model.openHoleStartDepth + 20);
  const leftPhaseX = laneAtDepth(model, g, laneDepth, "left");
  const rightPhaseX = laneAtDepth(model, g, laneDepth, "right");
  const returnClass = level >= 4 ? "wellbore-flow-path wellbore-flow-path-critical" : level === 1 || level === 3 ? "wellbore-flow-path wellbore-flow-path-warning" : "wellbore-flow-path wellbore-flow-path-normal";
  const flowSections = sectionLanes(model, g);
  const ReturnSegments = ({ side }: { side: 'left' | 'right' }) => (
    <g className="wellbore-return-segments">
      {flowSections.flatMap((section) => {
        const height = section.bottomY - section.topY;
        const margin = Math.min(15, Math.max(7, height * 0.2));
        const usable = Math.max(0, height - margin * 2);
        const count = height > 92 ? 2 : height > 34 ? 1 : 0;
        return Array.from({ length: count }, (_, index) => {
          const x = side === 'left' ? section.leftX : section.rightX;
          const y = section.topY + margin + usable * ((index + 1) / (count + 1));
          const arrowHalf = Math.min(3.7, Math.max(2.6, section.laneWidth * 0.46));
          const arrowPath = `M ${x - arrowHalf} ${y + 3.8} L ${x} ${y - 3.8} L ${x + arrowHalf} ${y + 3.8}`;
          return (
            <g key={`${side}-${section.sectionType}-${index}`} className="wellbore-return-chevron">
              <path d={arrowPath} fill="none" stroke="#ffffff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
              <path d={arrowPath} fill="none" stroke={visual.returnFlowColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" />
            </g>
          );
        });
      })}
    </g>
  );
  const DownSegments = () => (
    <g className="wellbore-down-segments">
      {[0.18, 0.4, 0.62, 0.84].map((ratio) => {
        const y = g.top + (bitY - g.top - 22) * ratio;
        return <path key={ratio} d={`M ${g.centerX - 4} ${y - 4} L ${g.centerX} ${y + 4} L ${g.centerX + 4} ${y - 4}`} fill="none" stroke={visual.downflowColor} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />;
      })}
    </g>
  );
  const MovingParticle = ({ path, color, delay, r = 2 }: { path: string; color: string; delay: string; r?: number }) => (
    <circle className="wellbore-flow-particle" r={r} fill={color}>
      <animateMotion dur="3.2s" begin={delay} repeatCount="indefinite" path={path} />
    </circle>
  );
  return (
    <g aria-label="钻柱下行与双侧环空返出闭环">
      <path className="wellbore-flow-path wellbore-flow-path-drill wellbore-flow-motion-guide" d={drillPath} />
      <path className={`${returnClass} wellbore-flow-motion-guide`} d={leftPath} opacity={visual.returnFlowOpacity} />
      <path className={`${returnClass} wellbore-flow-motion-guide`} d={rightPath} opacity={visual.returnFlowOpacity} />
      <DownSegments />
      <ReturnSegments side="left" />
      <ReturnSegments side="right" />
      <MovingParticle path={drillPath} color={visual.downflowColor} delay="0s" />
      <MovingParticle path={leftPath} color={visual.returnFlowColor} delay="-0.45s" r={2.05} />
      <MovingParticle path={leftPath} color={visual.returnFlowColor} delay="-2s" r={1.55} />
      <MovingParticle path={rightPath} color={visual.returnFlowColor} delay="-1.05s" r={2.05} />
      <MovingParticle path={rightPath} color={visual.returnFlowColor} delay="-2.6s" r={1.55} />
      {level === 1 ? (
        <g aria-label="异常观察带">
          <rect x={leftPhaseX - 5} y={yOf(model.observationDepth - 80, model, g)} width="10" height="28" rx="5" fill="#f97316" opacity="0.1" />
          <rect x={rightPhaseX - 5} y={yOf(model.observationDepth - 80, model, g)} width="10" height="28" rx="5" fill="#f97316" opacity="0.1" />
        </g>
      ) : null}
      {visual.showInfluxSource ? (
        <g aria-label="推测侵入源">
          <rect x={sourceLaneX - 4} y={yOf(localization.fromDepth, model, g)} width="8" height={Math.max(18, yOf(localization.toDepth, model, g) - yOf(localization.fromDepth, model, g))} rx="4" fill="#f97316" opacity="0.2" />
          <path className="wellbore-influx-plume" d={sourcePath} fill="none" stroke="#f97316" strokeWidth="2" markerEnd="url(#arrow-influx)" />
          <circle cx={sourceLaneX} cy={sourceY + 2} r="4" fill="#ea580c" />
        </g>
      ) : null}
      {visual.showTwoPhaseZone && phaseFrontDepth !== undefined && phaseBottomDepth !== undefined ? (
        <g aria-label="两相区和气侵前缘">
          <rect x={sourceSide === "left" ? leftPhaseX - 5 : rightPhaseX - 5} y={Math.min(mixingY, phaseBottomY)} width="10" height={Math.max(20, phaseBottomY - Math.min(mixingY, phaseBottomY))} rx="5" fill={`url(#slug-${id})`} opacity="0.5" />
          <rect x={leftPhaseX - 4} y={phaseTopY} width="8" height={Math.max(18, mixingY - phaseTopY)} rx="4" fill={`url(#slug-${id})`} opacity="0.26" />
          <rect x={rightPhaseX - 4} y={phaseTopY} width="8" height={Math.max(18, mixingY - phaseTopY)} rx="4" fill={`url(#slug-${id})`} opacity="0.34" />
          <line x1={leftPhaseX - 7} y1={phaseTopY} x2={rightPhaseX + 7} y2={phaseTopY} stroke="#dc2626" strokeWidth="1.2" strokeDasharray="4 4" />
          <text x={rightPhaseX + 12} y={phaseTopY + 3} fill="#b91c1c" fontSize="6.8" fontWeight="700">气侵前缘约 {Math.round(phaseFrontDepth)} m</text>
        </g>
      ) : null}
      {visual.showInfluxSource ? (
        <g className="wellbore-kick-tag" fontFamily="Microsoft YaHei, PingFang SC, Arial">
          <path d={`M ${sourceLaneX + sourceDirection * 6} ${sourceY + 2} L ${g.labelX - 6} ${sourceY - 4}`} stroke="#ea580c" strokeDasharray="3 5" opacity="0.32" />
          <rect x={g.labelX} y={sourceY - 22} width="116" height="38" rx="6" fill="#fffaf5" stroke="#fdba74" />
          <text x={g.labelX + 8} y={sourceY - 8} fill="#c2410c" fontSize="8" fontWeight="800">推测侵入区</text>
          <text x={g.labelX + 8} y={sourceY + 4} fill="#7c2d12" fontSize="6.8">{Math.round(localization.fromDepth)}–{Math.round(localization.toDepth)} m · 置信度 {Math.round(localization.confidence * 100)}%</text>
        </g>
      ) : null}
    </g>
  );
}

function EngineeringCallouts({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  if (compact) return null;
  const shoeY = yOf(model.casingShoeDepth, model, g);
  const bitY = yOf(model.bitDepth, model, g);
  const tdY = yOf(model.wellDepth, model, g);
  const right = g.centerX + wOf(52, g);
  return (
    <g className="wellbore-engineering-callouts" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <path d={`M ${g.centerX + wOf(43, g)} ${shoeY} H ${right - 6}`} stroke="#475569" strokeWidth="1" />
      <text x={right} y={shoeY + 3} fill="#475569" fontSize="8.5" fontWeight="700">技术套管鞋 {depth(model.casingShoeDepth)}</text>
      <text x={right} y={shoeY + 18} fill="#64748b" fontSize="8">裸眼起点</text>
      <path d={`M ${g.centerX - 26} ${bitY} H ${g.centerX - 76}`} stroke="#475569" strokeWidth="1" />
      <text x={g.centerX - 80} y={bitY + 3} fill="#334155" fontSize="8.5" fontWeight="700" textAnchor="end">钻头 {depth(model.bitDepth)}</text>
      <path d={`M ${g.centerX + 16} ${tdY} H ${g.centerX + 60}`} stroke="#94a3b8" strokeWidth="1" />
      <text x={g.centerX + 66} y={tdY - 2} fill="#64748b" fontSize="8.5">TD {depth(model.wellDepth)}</text>
    </g>
  );
}

function Status({ model, g, level, color, compact }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel; color: string; compact: boolean }) {
  if (!compact) return null;
  const x = compact ? 22 : 34; const y = compact ? 528 : 505; return <g className="wellbore-status-breathe" fontFamily="Microsoft YaHei, PingFang SC, Arial"><rect x={x} y={y} width={compact ? 150 : 198} height={compact ? 50 : 58} rx="8" fill="#fff" stroke={color} strokeWidth="1.3" /><circle cx={x + 17} cy={y + 20} r="4.6" fill={color} /><text x={x + 31} y={y + 21} fill={color} fontSize={compact ? '10' : '12'} fontWeight="800">L{level} {LEVEL_LABEL[level]}</text><text x={x + 13} y={y + 40} fill="#475569" fontSize={compact ? '8.5' : '9.5'}>{short(model.conditionLabel, compact ? 13 : 18)}</text>{!compact ? <text x={x + 13} y={y + 52} fill="#64748b" fontSize="8.5">{short(model.statusDescription, 24)}</text> : null}</g>;
}

export function WellboreSchemaFigure({ mode = 'thumbnail', backendLevel, wellDepth, bitDepth, drillPipeOD, bhaOD, bitOD, casingID, openHoleDiameter, flowIn, flowOut, spm = 0, casingPressure, drillPipePressure, pitGain, pitVolume, returnResponse = 0, totalGas = 0, mudWeight, ecd, porePressureEquivalent, fractureGradientEquivalent, influxFromDepth, influxToDepth, influxConfidence, influxSource, influxSide, gasFrontDepth, gasColumnBottomDepth, gasFraction, inclination, highSideDirection, activeSignals = [], pumpState, condition, cycleInfo, hasSamples = true, isRecovering = false, isStopped = false }: WellboreSchemaFigureProps) {
  const model = buildWellboreSimulationModel({ backendLevel, flowIn, flowOut, returnResponse, pitGain, pitVolume: pitVolume ?? pitGain, drillPipePressure, casingPressure, totalGas, spm, wellDepth, bitDepth, drillPipeOD, bhaOD, bitOD, casingID, openHoleDiameter, mudWeight, ecd, porePressureEquivalent, fractureGradientEquivalent, influxFromDepth, influxToDepth, influxConfidence, influxSource, influxSide, gasFrontDepth, gasColumnBottomDepth, gasFraction, inclination, highSideDirection, activeSignals, pumpState, condition, cycleInfo, hasSamples, isRecovering, isStopped });
  const compact = mode !== 'detail';
  const g = compact ? THUMB : DETAIL;
  const id = compact ? 'thumb' : 'detail';
  const color = levelColor(backendLevel);
  const visual = VISUAL_STATES[backendLevel];
  return (
    <div className={`wellbore-schema-figure wellbore-schema-figure-${mode}`} data-animation={visual.animationIntensity}>
      <svg className="wellbore-schema-overlay" viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${TEXT.aria} L${backendLevel} ${model.statusLabel}`}>
        <Defs id={id} />
        <defs><marker id={`arrow-critical-${backendLevel}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill={visual.returnFlowColor} /></marker><marker id="arrow-influx" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="#f97316" /></marker></defs>
        <rect width="100%" height="100%" fill={`url(#panel-${id})`} />
        <rect x={compact ? 14 : 24} y={compact ? 16 : 18} width={g.width - (compact ? 28 : 48)} height={g.height - (compact ? 32 : 36)} rx="10" fill={`url(#grid-${id})`} opacity="0.24" />
        {!compact ? <Header /> : null}
        <Axis model={model} g={g} compact={compact} />
        <Formations model={model} g={g} compact={compact} id={id} />
        <Tubulars model={model} g={g} id={id} />
        <TubularJointMarks model={model} g={g} compact={compact} />
        <OpenHole model={model} g={g} />
        <FluidColumn model={model} g={g} id={id} level={backendLevel} />
        <Surface g={g} />
        <DrillString model={model} g={g} id={id} />
        <BitHydraulics model={model} g={g} level={backendLevel} />
        <Flow model={model} g={g} level={backendLevel} id={id} visual={visual} />
        <EngineeringCallouts model={model} g={g} compact={compact} />
        <Status model={model} g={g} level={backendLevel} color={color} compact={compact} />
      </svg>
    </div>
  );
}

export default WellboreSchemaFigure;
