import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { buildWellboreSimulationModel, type WellboreSimulationModel, type WellboreTone } from '../lib/wellboreSimulation';

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

const DETAIL: Geometry = { viewBox: '0 0 660 640', width: 660, height: 640, top: 78, bottom: 584, centerX: 282, axisX: 38, labelX: 418, formationX: 536, formationW: 46, scale: 1.82 };
const THUMB: Geometry = { viewBox: '0 0 520 640', width: 520, height: 640, top: 70, bottom: 584, centerX: 246, axisX: 48, labelX: 354, formationX: 416, formationW: 44, scale: 0.68 };

const LEVEL_LABEL: Record<BackendLevel, string> = { 0: '正常循环', 1: '异常观察', 2: '溢流预警', 3: '疑似溢流', 4: '溢流确认' };
const TEXT = { aria: '井筒状态工程剖面', bit: '钻头', shoe: '套管鞋', influx: '异常侵入点', openHole: '裸眼段', casing: '套管', cement: '水泥环', drill: '钻柱 / BHA' };
const VISUAL_STATES: Record<BackendLevel, WellboreVisualState> = {
  0: { downflowColor: '#2563eb', returnFlowColor: '#0f766e', returnFlowOpacity: 0.76, showObservationBand: false, showInfluxSource: false, showMigrationPath: false, showTwoPhaseZone: false, animationIntensity: 'low' },
  1: { downflowColor: '#2563eb', returnFlowColor: '#f97316', returnFlowOpacity: 0.7, showObservationBand: true, showInfluxSource: false, showMigrationPath: false, showTwoPhaseZone: false, animationIntensity: 'low' },
  2: { downflowColor: '#2563eb', returnFlowColor: '#f97316', returnFlowOpacity: 0.72, showObservationBand: true, showInfluxSource: true, showMigrationPath: true, showTwoPhaseZone: false, animationIntensity: 'medium' },
  3: { downflowColor: '#2563eb', returnFlowColor: '#ea580c', returnFlowOpacity: 0.78, showObservationBand: true, showInfluxSource: true, showMigrationPath: true, showTwoPhaseZone: true, animationIntensity: 'medium' },
  4: { downflowColor: '#2563eb', returnFlowColor: '#dc2626', returnFlowOpacity: 0.86, showObservationBand: true, showInfluxSource: true, showMigrationPath: true, showTwoPhaseZone: true, animationIntensity: 'high' },
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function yOf(depth: number, model: WellboreSimulationModel, g: Geometry) { return g.top + (clamp(depth, 0, model.wellDepth) / model.wellDepth) * (g.bottom - g.top); }
function wOf(width: number, g: Geometry) { return Math.max(10, width * g.scale); }
function depth(value: number) { return `${Math.round(value)} m`; }
function short(value: string, max = 18) { return value.length > max ? `${value.slice(0, max - 2)}...` : value; }
function levelColor(level: BackendLevel) { if (level >= 4) return '#dc2626'; if (level >= 2) return '#ef4444'; if (level === 1) return '#f97316'; return '#0f766e'; }
function toneColor(tone: WellboreTone) { if (tone === 'critical') return '#dc2626'; if (tone === 'warning') return '#ef4444'; if (tone === 'watch') return '#f97316'; return '#0f766e'; }

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

function EngineeringReadouts({
  model,
  g,
  compact,
  level,
  flowIn,
  flowOut,
  pitGain,
  totalGas,
}: {
  model: WellboreSimulationModel;
  g: Geometry;
  compact: boolean;
  level: BackendLevel;
  flowIn: number;
  flowOut: number;
  pitGain: number;
  totalGas: number;
}) {
  if (compact) return null;
  const deltaQ = flowOut - flowIn;
  const danger = level >= 2;
  const pressureTone = model.pressureWindow.status === 'underbalanced' ? '#dc2626' : model.pressureWindow.status === 'narrow' ? '#f97316' : '#0f766e';
  const items = [
    { k: 'DQ', label: '返出-入口', value: `${deltaQ >= 0 ? '+' : ''}${deltaQ.toFixed(1)} L/s`, tone: danger ? '#dc2626' : '#0f766e' },
    { k: 'PIT', label: '池增量', value: `${pitGain.toFixed(2)} m³`, tone: danger ? '#ea580c' : '#0f766e' },
    { k: 'GAS', label: '全烃', value: `${totalGas.toFixed(2)} %`, tone: danger ? '#dc2626' : '#0f766e' },
    { k: 'MARGIN', label: '压力窗口', value: `${model.pressureWindow.margin >= 0 ? '+' : ''}${model.pressureWindow.margin.toFixed(2)} g/cm³`, tone: pressureTone },
  ];
  const x = 76;
  const y = g.bottom + 23;
  return (
    <g className="wellbore-engineering-readouts" aria-label="井筒工程读数" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <text x={x} y={y - 6} fill="#475569" fontSize="8.5" fontWeight="800">实时证据</text>
      {items.map((item, index) => {
        const ix = x + 58 + index * 92;
        return (
          <g key={item.k}>
            <rect x={ix} y={y - 19} width="82" height="28" rx="5" fill="#ffffff" stroke="#dbe2ea" />
            <circle cx={ix + 9} cy={y - 5} r="2.5" fill={item.tone} />
            <text x={ix + 16} y={y - 8} fill="#64748b" fontSize="7.5">{item.label}</text>
            <text x={ix + 16} y={y + 4} fill={item.tone} fontSize="8.3" fontWeight="800">{item.value}</text>
          </g>
        );
      })}
    </g>
  );
}

function GeometryLegend({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  if (compact) return null;
  const x = 76;
  const y = g.bottom + 38;
  const strings = model.tubularStrings.map((item) => `${item.programLabel}${item.holeSizeLabel}/${item.casingSizeLabel} @${depth(item.bottomDepth)}`);
  const copy = [...strings, `裸眼${model.openHoleSizeLabel} ${depth(model.openHoleLength)}`].join('  |  ');
  return (
    <g className="wellbore-geometry-legend" aria-label="井身结构尺寸" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <rect x={x} y={y} width="454" height="14" rx="5" fill="#ffffff" stroke="#dbe2ea" opacity="0.9" />
      <text x={x + 8} y={y + 9.6} fill="#475569" fontSize="6.6" fontWeight="800">井身尺寸 Mock</text>
      <text x={x + 68} y={y + 9.6} fill="#64748b" fontSize="6.4">{copy}</text>
    </g>
  );
}

function ChannelLegend({ g, compact, level }: { g: Geometry; compact: boolean; level: BackendLevel }) {
  if (compact) return null;
  const x = g.formationX - 126;
  const y = g.top + 4;
  const returnColor = level >= 2 ? '#dc2626' : '#0f766e';
  const rows = [
    { label: '钻柱内下行', color: '#2563eb', dash: '0' },
    { label: level >= 2 ? '异常上返' : '环空上返', color: returnColor, dash: '4 5' },
    ...(level >= 2 ? [{ label: '地层侧侵入', color: '#f97316', dash: '0' }] : []),
  ];
  return (
    <g className="wellbore-channel-legend" aria-label="通道判读" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <rect x={x} y={y} width="116" height={level >= 2 ? 58 : 47} rx="6" fill="#ffffff" stroke="#dbe2ea" opacity="0.94" />
      <text x={x + 8} y={y + 14} fill="#334155" fontSize="8.2" fontWeight="800">通道判读</text>
      {rows.map((row, index) => {
        const ry = y + 27 + index * 11;
        return (
          <g key={row.label}>
            <line x1={x + 9} y1={ry - 3} x2={x + 28} y2={ry - 3} stroke={row.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={row.dash} />
            <text x={x + 34} y={ry} fill="#475569" fontSize="7.6" fontWeight="700">{row.label}</text>
          </g>
        );
      })}
    </g>
  );
}

function PressureWindow({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  if (compact) return null;
  const x = g.formationX - 126;
  const y = g.top + 282;
  const w = 116;
  const h = 72;
  const { mudWeight, porePressureEquivalent, margin, status } = model.pressureWindow;
  const danger = status === 'underbalanced';
  const tight = status === 'narrow';
  const color = danger ? '#dc2626' : tight ? '#f97316' : '#0f766e';
  const min = 1.12;
  const max = 1.36;
  const meterX = x + 12;
  const meterY = y + 31;
  const meterW = 88;
  const pos = (value: number) => meterX + clamp((value - min) / (max - min), 0, 1) * meterW;
  const mudX = pos(mudWeight);
  const poreX = pos(porePressureEquivalent);
  return (
    <g className="wellbore-pressure-window" aria-label="压力窗口判读" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#ffffff" stroke="#dbe2ea" opacity="0.94" />
      <text x={x + 8} y={y + 14} fill="#334155" fontSize="8.2" fontWeight="800">压力窗口</text>
      <line x1={meterX} y1={meterY} x2={meterX + meterW} y2={meterY} stroke="#dbe2ea" strokeWidth="5" strokeLinecap="round" />
      <line x1={Math.min(mudX, poreX)} y1={meterY} x2={Math.max(mudX, poreX)} y2={meterY} stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.58" />
      <path d={`M ${mudX} ${meterY - 8} V ${meterY + 8}`} stroke="#2563eb" strokeWidth="1.5" />
      <path d={`M ${poreX} ${meterY - 8} V ${meterY + 8}`} stroke="#dc2626" strokeWidth="1.5" />
      <text x={x + 9} y={y + 49} fill="#2563eb" fontSize="7.2" fontWeight="700">MW {mudWeight.toFixed(2)}</text>
      <text x={x + 61} y={y + 49} fill="#b91c1c" fontSize="7.2" fontWeight="700">PP {porePressureEquivalent.toFixed(2)}</text>
      <text x={x + 9} y={y + 64} fill={color} fontSize="7.5" fontWeight="800">{danger ? '负压差' : tight ? '窗口变窄' : '过平衡'} Δ {margin >= 0 ? '+' : ''}{margin.toFixed(2)} g/cm³</text>
    </g>
  );
}

function KickDiagnosticsPanel({ model, g, compact, level }: { model: WellboreSimulationModel; g: Geometry; compact: boolean; level: BackendLevel }) {
  if (compact || level < 2) return null;
  const x = g.formationX - 126;
  const y = g.top + 365;
  const w = 116;
  const h = 82;
  const { severity, influxRate, gasFrontDepth, gasColumnLength, migrationVelocity } = model.kickDiagnostics;
  const fillW = clamp(severity, 0, 1) * 78;
  const chain = ['压差', '侧壁', '上移', '证据'];
  return (
    <g className="wellbore-kick-diagnostics" aria-label="溢流诊断参数" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#ffffff" stroke="#fecaca" opacity="0.94" />
      <text x={x + 8} y={y + 14} fill="#7f1d1d" fontSize="8.2" fontWeight="800">溢流诊断</text>
      <rect x={x + 9} y={y + 23} width="78" height="5" rx="3" fill="#fee2e2" />
      <rect x={x + 9} y={y + 23} width={fillW} height="5" rx="3" fill="#dc2626" opacity="0.72" />
      <text x={x + 91} y={y + 29} fill="#b91c1c" fontSize="7.2" fontWeight="800">{Math.round(severity * 100)}%</text>
      <text x={x + 9} y={y + 43} fill="#475569" fontSize="6.9">侵入 {influxRate.toFixed(1)} L/s · 气侵柱 {gasColumnLength} m</text>
      <text x={x + 9} y={y + 57} fill="#475569" fontSize="6.9">前缘 {gasFrontDepth} m · 上移 {migrationVelocity} m/min</text>
      <line x1={x + 13} y1={y + 69} x2={x + 101} y2={y + 69} stroke="#fecaca" strokeWidth="0.8" />
      {chain.map((item, index) => {
        const cx = x + 14 + index * 29;
        return <g key={item}><circle cx={cx} cy={y + 69} r="3.4" fill="#fff7ed" stroke="#ef4444" strokeWidth="0.7" /><text x={cx} y={y + 79} fill="#7f1d1d" fontSize="5.2" fontWeight="700" textAnchor="middle">{item}</text></g>;
      })}
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

function FormationPressureMarker({ model, g, compact, level }: { model: WellboreSimulationModel; g: Geometry; compact: boolean; level: BackendLevel }) {
  if (compact) return null;
  const abnormal = level >= 2;
  const y = abnormal ? yOf(model.kickPointDepth, model, g) - 18 : yOf(model.bitDepth, model, g) - 54;
  const x = g.formationX + g.formationW + 8;
  const tone = abnormal ? '#dc2626' : '#0f766e';
  const label = abnormal ? 'PP > MW' : 'MW > PP';
  const sub = abnormal ? '侧壁具备侵入条件' : '井底保持过平衡';
  return (
    <g className="wellbore-formation-pressure-marker" aria-label="地层压力关系" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <line x1={g.formationX + g.formationW} y1={y} x2={x - 2} y2={y} stroke={tone} strokeWidth="1" strokeDasharray="3 4" opacity="0.52" />
      <rect x={x} y={y - 16} width="62" height="31" rx="5" fill="#ffffff" stroke={tone} strokeOpacity="0.32" />
      <circle cx={x + 7} cy={y - 5} r="2.4" fill={tone} />
      <text x={x + 13} y={y - 2} fill={tone} fontSize="7.4" fontWeight="800">{label}</text>
      <text x={x + 7} y={y + 10} fill="#64748b" fontSize="6.2">{sub}</text>
    </g>
  );
}

function Tubulars({ model, g, id }: { model: WellboreSimulationModel; g: Geometry; id: string }) {
  return <g aria-label="套管与水泥环">{model.tubularStrings.map((item) => { const y1 = yOf(item.topDepth, model, g); const y2 = yOf(item.bottomDepth, model, g); const outer = wOf(item.outerWidth, g); const inner = wOf(item.innerWidth, g); const cementOuter = wOf(item.cementOuterWidth, g); const wall = Math.max(3.5, (outer - inner) / 2); const ol = g.centerX - outer / 2; const or = g.centerX + outer / 2; const il = g.centerX - inner / 2; const ir = g.centerX + inner / 2; const cl = g.centerX - cementOuter / 2; const cr = g.centerX + cementOuter / 2; return <g key={item.key}><path d={`M ${cl} ${y1} H ${ol} V ${y2} H ${cl} Z M ${or} ${y1} H ${cr} V ${y2} H ${or} Z`} fill={`url(#cement-${id})`} opacity="0.74" /><rect x={ol} y={y1} width={wall} height={Math.max(1, y2 - y1)} fill={`url(#steel-${id})`} stroke={item.stroke} strokeWidth="0.9" /><rect x={ir} y={y1} width={wall} height={Math.max(1, y2 - y1)} fill={`url(#steel-${id})`} stroke={item.stroke} strokeWidth="0.9" /><path d={`M ${ol} ${y2} L ${il} ${y2 + 11} L ${il} ${y2 + 15} L ${ol} ${y2 + 4} Z`} fill={item.stroke} /><path d={`M ${or} ${y2} L ${ir} ${y2 + 11} L ${ir} ${y2 + 15} L ${or} ${y2 + 4} Z`} fill={item.stroke} /></g>; })}</g>;
}

function FluidColumn({ model, g, id, level }: { model: WellboreSimulationModel; g: Geometry; id: string; level: BackendLevel }) {
  const shoeY = yOf(model.casingShoeDepth, model, g);
  const bottomY = yOf(model.bitDepth, model, g) - 2;
  const drillTop = g.top + 7;
  const annulusTop = g.top + 7;
  const annulusCenterX = g.centerX + wOf(16, g);
  const annulusWidth = wOf(12, g);
  const annulusX = annulusCenterX - annulusWidth / 2;
  const kickTone = level >= 2;
  return (
    <g aria-label="钻井液流道底色">
      <rect x={g.centerX - 3} y={drillTop} width="6" height={Math.max(20, bottomY - drillTop)} rx="3" fill={`url(#mud-${id})`} />
      <rect x={annulusX} y={annulusTop} width={annulusWidth} height={Math.max(18, bottomY - annulusTop)} rx="8" fill={kickTone ? '#fee2e2' : '#ccfbf1'} opacity={kickTone ? 0.2 : 0.16} />
      <path d={`M ${annulusCenterX} ${shoeY + 8} V ${bottomY - 10}`} stroke={kickTone ? '#fecaca' : '#99f6e4'} strokeWidth="1" strokeDasharray="1 9" opacity="0.72" />
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

function CasingProgramMarkers({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  if (compact) return null;
  const x = g.centerX - wOf(96, g);
  return (
    <g aria-label="套管程序节点" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      {model.tubularStrings.map((item, index) => {
        const y = yOf(item.bottomDepth, model, g);
        const outer = wOf(item.outerWidth, g);
        const casingLeft = g.centerX - outer / 2;
        const labelY = y - 10 - (index % 2) * 5;
        return (
          <g key={item.key} opacity="0.78">
            <path d={`M ${x + 48} ${labelY + 4} H ${casingLeft - 5}`} stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="3 5" />
            <rect x={x} y={labelY - 7} width="48" height="16" rx="4" fill="#ffffff" stroke="#dbe2ea" />
            <text x={x + 5} y={labelY + 3.8} fill="#475569" fontSize="6.6" fontWeight="700">{item.programLabel}鞋 {Math.round(item.bottomDepth)}</text>
          </g>
        );
      })}
    </g>
  );
}

function OpenHole({ model, g }: { model: WellboreSimulationModel; g: Geometry }) {
  const y1 = yOf(model.openHoleStartDepth, model, g) + 10; const y2 = yOf(model.wellDepth, model, g); const half = wOf(50, g) / 2; const left = g.centerX - half; const right = g.centerX + half; const mid = y1 + (y2 - y1) * 0.52;
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
  const bitTop = bitY - 26;
  const bhaTop = Math.max(bitY - 86, g.top + 50);
  const motorTop = bitY - 62;
  const pipeJointYs = [0.23, 0.48, 0.73].map((p) => g.top + (bhaTop - g.top) * p);
  return (
    <g aria-label={TEXT.drill}>
      <rect x={g.centerX - 5} y={g.top} width="10" height={Math.max(24, bhaTop - g.top)} fill={`url(#drill-${id})`} stroke="#2563eb" strokeWidth="1.25" />
      {pipeJointYs.map((y) => <line key={y} x1={g.centerX - 6.5} y1={y} x2={g.centerX + 6.5} y2={y} stroke="#1d4ed8" strokeWidth="0.9" opacity="0.58" />)}
      <rect x={g.centerX - 8} y={bhaTop} width="16" height={Math.max(8, motorTop - bhaTop)} rx="2" fill={`url(#drill-${id})`} stroke="#1d4ed8" strokeWidth="1.1" />
      <rect x={g.centerX - 12} y={motorTop} width="24" height={Math.max(14, bitTop - motorTop - 4)} rx="2" fill={`url(#drill-${id})`} stroke="#1d4ed8" strokeWidth="1.2" />
      <path d={`M ${g.centerX - 16} ${motorTop + 16} H ${g.centerX + 16} M ${g.centerX - 14} ${motorTop + 29} H ${g.centerX + 14}`} stroke="#1e40af" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d={`M ${g.centerX - 20} ${bitTop - 8} H ${g.centerX + 20} M ${g.centerX - 15} ${bitTop - 1} H ${g.centerX + 15}`} stroke="#1e40af" strokeWidth="2" strokeLinecap="round" opacity="0.72" />
      <path d={`M ${g.centerX - 26} ${bitTop} H ${g.centerX + 26} L ${g.centerX + 15} ${bitY - 5} L ${g.centerX + 4} ${bitY + 2} H ${g.centerX - 4} L ${g.centerX - 15} ${bitY - 5} Z`} fill="#64748b" stroke="#334155" strokeWidth="1.35" />
      <path d={`M ${g.centerX - 16} ${bitY - 4} L ${g.centerX - 24} ${bitY + 3} M ${g.centerX} ${bitY - 1} V ${bitY + 6} M ${g.centerX + 16} ${bitY - 4} L ${g.centerX + 24} ${bitY + 3}`} fill="none" stroke="#334155" strokeWidth="1.65" strokeLinecap="round" />
    </g>
  );
}

function BitHydraulics({ model, g, level }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel }) {
  const bitY = yOf(model.bitDepth, model, g);
  const bottomY = Math.min(bitY + 9, g.bottom - 3);
  const annulusRightX = g.centerX + wOf(16, g);
  const annulusLeftX = g.centerX - wOf(16, g);
  const returnColor = level >= 2 ? '#ef4444' : '#0f766e';
  const returnOpacity = level >= 2 ? 0.34 : 0.52;
  return (
    <g className="wellbore-bit-hydraulics" aria-label="钻头喷嘴与井底返流">
      <path className="wellbore-bit-nozzle-flow" d={`M ${g.centerX - 7} ${bitY - 4} C ${g.centerX - 10} ${bitY + 2} ${g.centerX - 16} ${bottomY} ${annulusLeftX - 4} ${bottomY - 1}`} />
      <path className="wellbore-bit-nozzle-flow" d={`M ${g.centerX + 7} ${bitY - 4} C ${g.centerX + 10} ${bitY + 2} ${g.centerX + 16} ${bottomY} ${annulusRightX + 4} ${bottomY - 1}`} />
      <path className="wellbore-bit-nozzle-flow wellbore-bit-nozzle-center" d={`M ${g.centerX} ${bitY - 2} V ${bottomY + 3}`} />
      <path
        className="wellbore-bit-bottom-sweep"
        d={`M ${annulusLeftX - 7} ${bottomY - 2} C ${g.centerX - 18} ${bottomY + 10} ${g.centerX + 18} ${bottomY + 10} ${annulusRightX + 7} ${bottomY - 2}`}
        stroke={returnColor}
        opacity={returnOpacity}
      />
    </g>
  );
}

function ReservoirEntryDetail({ model, g, level, visual }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel; visual: WellboreVisualState }) {
  if (!visual.showInfluxSource) return null;
  const kickY = yOf(model.kickPointDepth, model, g);
  const wallX = g.centerX + wOf(25, g);
  const formationX = wallX + wOf(18, g);
  const lines = [-23, -12, 0, 12, 23];
  return (
    <g aria-label="近井地层渗流细节" opacity="0.86">
      {lines.map((dy) => (
        <path
          key={dy}
          d={`M ${formationX + 35} ${kickY + dy - 1} C ${formationX + 25} ${kickY + dy + 2} ${formationX + 14} ${kickY + dy - 4} ${formationX + 3} ${kickY + dy}`}
          fill="none"
          stroke={dy === 0 ? '#f97316' : '#d6a15a'}
          strokeWidth={dy === 0 ? 1.2 : 0.75}
          strokeDasharray={dy === 0 ? '0' : '3 5'}
          opacity={dy === 0 ? 0.72 : 0.42}
        />
      ))}
      <path d={`M ${formationX + 16} ${kickY} L ${formationX + 6} ${kickY}`} stroke="#f97316" strokeWidth="1.1" markerEnd={`url(#arrow-critical-${level})`} opacity="0.62" />
      <path d={`M ${wallX + 3} ${kickY - 10} C ${wallX + 9} ${kickY - 4} ${wallX + 8} ${kickY + 5} ${wallX + 2} ${kickY + 12}`} fill="none" stroke="#b45309" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

function Evidence({ model, g }: { model: WellboreSimulationModel; g: Geometry }) {
  return <g aria-label="证据带">{model.evidenceBands.map((band) => {
    const y = yOf(band.from, model, g);
    const h = Math.max(14, yOf(band.to, model, g) - y);
    if (band.lane === 'formation') {
      const x = g.centerX + wOf(76, g) / 2 + 2;
      return <path key={band.key} d={`M ${x} ${y + 4} C ${x + 26} ${y + h * 0.18} ${x + 28} ${y + h * 0.82} ${x + 2} ${y + h - 4} L ${x - 12} ${y + h - 12} C ${x + 4} ${y + h * 0.68} ${x + 3} ${y + h * 0.32} ${x - 12} ${y + 12} Z`} fill={toneColor(band.tone)} opacity={(band.opacity ?? 0.18) * 0.72} />;
    }
    const abnormalAnnulus = band.tone === 'critical' || band.tone === 'warning';
    const annulusWidth = wOf(12, g);
    const rightCenterX = g.centerX + wOf(16, g);
    const leftCenterX = g.centerX - wOf(16, g);
    if (band.tone === 'normal') {
      return (
        <g key={band.key} opacity="0.58">
          <rect x={rightCenterX - annulusWidth / 2} y={y} width={annulusWidth} height={h} rx="5" fill={toneColor(band.tone)} opacity="0.18" />
          <rect x={leftCenterX - annulusWidth / 2} y={y} width={annulusWidth} height={h} rx="5" fill={toneColor(band.tone)} opacity="0.12" />
        </g>
      );
    }
    const x = abnormalAnnulus ? rightCenterX - annulusWidth / 2 : g.centerX - wOf(94, g) / 2;
    const width = abnormalAnnulus ? annulusWidth : wOf(94, g);
    return <rect key={band.key} x={x} y={y} width={width} height={h} rx="8" fill={toneColor(band.tone)} opacity={(band.opacity ?? 0.18) * (abnormalAnnulus ? 0.7 : 0.84)} />;
  })}</g>;
}

function ChannelGuides({ model, g, compact, level }: { model: WellboreSimulationModel; g: Geometry; compact: boolean; level: BackendLevel }) {
  if (compact) return null;
  const shoeY = yOf(model.casingShoeDepth, model, g);
  const bitY = yOf(model.bitDepth, model, g);
  const annulusX = g.centerX + wOf(16, g);
  const annulusStroke = level >= 2 ? '#fecaca' : '#99f6e4';
  return (
    <g aria-label="流道工程分区" opacity="0.78">
      <path d={`M ${g.centerX - 16} ${g.top + 6} V ${Math.min(bitY - 18, g.bottom - 28)}`} stroke="#bfdbfe" strokeWidth="1" strokeDasharray="2 7" />
      <path d={`M ${annulusX} ${g.top + 6} V ${bitY - 12}`} stroke={annulusStroke} strokeWidth="1" strokeDasharray="2 8" />
      <path d={`M ${g.centerX + wOf(43, g)} ${shoeY - 15} h 14`} stroke="#334155" strokeWidth="1.2" />
      <text x={g.centerX + wOf(43, g) + 18} y={shoeY - 11} fill="#475569" fontSize="8.5" fontWeight="700">裸眼起点</text>
    </g>
  );
}

function BottomEngineeringZone({ model, g, compact, level }: { model: WellboreSimulationModel; g: Geometry; compact: boolean; level: BackendLevel }) {
  if (compact || level < 2) return null;
  const bitY = yOf(model.bitDepth, model, g);
  const shoeY = yOf(model.casingShoeDepth, model, g);
  const zoneTop = Math.max(shoeY + 42, bitY - 112);
  const zoneBottom = Math.min(g.bottom - 2, bitY + 16);
  return (
    <g className="wellbore-bottom-engineering-zone" aria-label="井底重点区" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <rect x={g.centerX - wOf(82, g)} y={zoneTop} width={wOf(164, g)} height={Math.max(48, zoneBottom - zoneTop)} rx="10" fill="#fff7ed" stroke="#dc2626" strokeOpacity="0.08" opacity="0.25" />
      <path d={`M ${g.centerX - wOf(70, g)} ${zoneBottom - 8} H ${g.centerX - wOf(58, g)} M ${g.centerX + wOf(70, g)} ${zoneBottom - 8} H ${g.centerX + wOf(58, g)}`} stroke="#dc2626" strokeWidth="1" opacity="0.18" />
    </g>
  );
}

function StructureLabels({ model, g, compact }: { model: WellboreSimulationModel; g: Geometry; compact: boolean }) {
  if (compact) return null;
  const shoeY = yOf(model.casingShoeDepth, model, g);
  const openMidY = (shoeY + g.bottom) / 2;
  const casingMidY = (g.top + shoeY) / 2;
  const x = g.centerX - wOf(110, g);
  return (
    <g className="wellbore-structure-labels" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <text x={g.centerX - 8} y={g.top + 24} fill="#2563eb" fontSize="8.8" textAnchor="end">钻柱内下行</text>
      <text x={g.centerX + wOf(34, g)} y={g.top + 24} fill="#0f766e" fontSize="8.8">环空上返通道</text>
      <path d={`M ${x} ${g.top + 8} V ${shoeY - 8}`} stroke="#94a3b8" strokeWidth="1" />
      <path d={`M ${x - 4} ${g.top + 8} H ${x + 4} M ${x - 4} ${shoeY - 8} H ${x + 4}`} stroke="#94a3b8" strokeWidth="1" />
      <text x={x - 8} y={casingMidY} fill="#64748b" fontSize="9" textAnchor="end">套管段</text>
      <path d={`M ${x} ${shoeY + 14} V ${g.bottom - 8}`} stroke="#94a3b8" strokeWidth="1" />
      <path d={`M ${x - 4} ${shoeY + 14} H ${x + 4} M ${x - 4} ${g.bottom - 8} H ${x + 4}`} stroke="#94a3b8" strokeWidth="1" />
      <text x={x - 8} y={openMidY} fill="#64748b" fontSize="9" textAnchor="end">裸眼段</text>
    </g>
  );
}

function Flow({ model, g, level, id, visual }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel; id: string; visual: WellboreVisualState }) {
  const bitY = yOf(model.bitDepth, model, g);
  const kickY = yOf(model.kickPointDepth, model, g);
  const watchY = yOf(model.observationDepth, model, g);
  const shoeY = yOf(model.casingShoeDepth, model, g);
  const annulusX = g.centerX + wOf(16, g);
  const leftAnnulusX = g.centerX - wOf(16, g);
  const drillX = g.centerX;
  const topY = g.top + 8;
  const bottomFlowY = Math.min(bitY - 16, g.bottom - 18);
  const downArrowY = [0.19, 0.43, 0.67, 0.86].map((p) => g.top + 22 + (bottomFlowY - g.top - 40) * p);
  const upArrowY = [0.18, 0.39, 0.62, 0.83].map((p) => topY + (Math.max(kickY, bottomFlowY) - topY) * p);
  const drillPath = `M ${drillX} ${g.top + 4} V ${bottomFlowY}`;
  const normalReturnPath = `M ${annulusX} ${bottomFlowY} V ${topY}`;
  const kickReturnPath = `M ${annulusX} ${kickY + 10} C ${annulusX + 8} ${Math.max(shoeY + 18, kickY - 82)} ${annulusX + 3} ${Math.max(g.top + 90, shoeY - 160)} ${annulusX} ${topY}`;
  const gasFrontY = yOf(model.kickDiagnostics.gasFrontDepth || model.openHoleStartDepth, model, g);
  const gasTopY = Math.max(shoeY + 18, Math.min(gasFrontY, kickY - 70));
  const DownArrows = () => <g className="wellbore-flow-segments">{downArrowY.map((y, index) => <g key={y}><line x1={drillX} y1={y - 20} x2={drillX} y2={y + 1} stroke={visual.downflowColor} strokeWidth="2.15" strokeLinecap="round" opacity={index === 3 ? 0.5 : 0.64} /><path d={`M ${drillX - 4.5} ${y - 3} L ${drillX} ${y + 6} L ${drillX + 4.5} ${y - 3}`} fill={visual.downflowColor} opacity="0.78" /></g>)}</g>;
  const UpArrows = ({ color = visual.returnFlowColor }: { color?: string }) => <g className="wellbore-flow-segments">{upArrowY.map((y, index) => { const x = annulusX + (index % 2 === 0 ? 2.5 : -1.5); return <g key={y}><line x1={x} y1={y + 22} x2={x} y2={y} stroke={color} strokeWidth="1.85" strokeLinecap="round" opacity={level >= 2 ? 0.46 : 0.56} /><path d={`M ${x - 4.5} ${y + 4} L ${x} ${y - 5} L ${x + 4.5} ${y + 4}`} fill={color} opacity="0.72" /></g>; })}</g>;
  const SlugPackets = () => {
    const packetYs = [0.18, 0.5, 0.82].map((p) => gasTopY + (kickY - gasTopY) * p);
    const travel = Math.max(64, (kickY - gasTopY) * 0.42);
    const severity = clamp(model.kickDiagnostics.severity, 0.35, 1);
    return (
      <g className="wellbore-slug-packets" aria-label="气侵轻质段上移">
        {packetYs.map((y, index) => {
          const h = (index === 1 ? 32 : 24) + severity * 6;
          const w = (index === 1 ? 8 : 6) + severity * 2;
          const delay = `${-index * 1.05}s`;
          return (
            <g key={y} opacity={index === 1 ? 0.64 : 0.46}>
              <rect x={annulusX - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={`url(#slug-${id})`} stroke="#dc2626" strokeWidth="0.55" strokeOpacity="0.26" />
              <path d={`M ${annulusX} ${y + h / 2 - 7} V ${y - h / 2 + 7}`} stroke="#fff7ed" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 5" opacity="0.5" />
              <animateTransform attributeName="transform" type="translate" values={`0 ${travel * 0.18}; 0 ${-travel}; 0 ${travel * 0.18}`} dur="4.4s" begin={delay} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.2;0.78;0.36;0.2" dur="4.4s" begin={delay} repeatCount="indefinite" />
            </g>
          );
        })}
      </g>
    );
  };
  const GasProfile = () => {
    if (!visual.showTwoPhaseZone) return null;
    const markerX = annulusX + wOf(15, g);
    const columnX = annulusX - 5.5;
    const columnH = Math.max(36, kickY - gasTopY - 28);
    const labelX = markerX + 15;
    const frontDepth = model.kickDiagnostics.gasFrontDepth;
    const chevrons = [0.28, 0.52, 0.76].map((p) => gasTopY + columnH * p);
    return (
      <g className="wellbore-gas-profile" aria-label="环空气侵剖面" fontFamily="Microsoft YaHei, PingFang SC, Arial">
        <rect x={columnX} y={gasTopY + 8} width="11" height={columnH} rx="5.5" fill={`url(#slug-${id})`} opacity="0.24" />
        <line x1={markerX} y1={gasTopY} x2={markerX} y2={kickY - 28} stroke="#fecaca" strokeWidth="0.65" strokeDasharray="2 8" opacity="0.45" />
        <path d={`M ${markerX - 8} ${gasTopY} H ${markerX + 8}`} stroke="#dc2626" strokeWidth="1.15" strokeLinecap="round" opacity="0.62" />
        <path d={`M ${markerX + 2} ${kickY - 42} L ${markerX + 2} ${gasTopY + 14}`} stroke="#dc2626" strokeWidth="0.72" strokeDasharray="4 9" opacity="0.28" markerEnd={`url(#arrow-critical-${level})`} />
        {chevrons.map((y) => (
          <path key={y} d={`M ${annulusX - 4} ${y + 4} L ${annulusX} ${y - 3} L ${annulusX + 4} ${y + 4}`} fill="none" stroke="#dc2626" strokeWidth="0.95" strokeLinecap="round" strokeLinejoin="round" opacity="0.42" />
        ))}
        <title>气侵前缘 {frontDepth} m，沿右侧环空上移</title>
      </g>
    );
  };
  const MovingParticle = ({ path, color, delay, r = 2.4 }: { path: string; color: string; delay: string; r?: number }) => (
    <circle className="wellbore-flow-particle" r={r} fill={color}>
      <animateMotion dur="3.2s" begin={delay} repeatCount="indefinite" path={path} />
    </circle>
  );

  if (model.flowState.showNormalPath) {
    return <g aria-label="正常循环路径"><path className="wellbore-flow-path wellbore-flow-path-drill" d={drillPath} /><path className="wellbore-flow-path wellbore-flow-path-normal" d={normalReturnPath} /><path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M ${leftAnnulusX} ${bottomFlowY} V ${topY}`} /><DownArrows /><MovingParticle path={drillPath} color={visual.downflowColor} delay="0s" /><MovingParticle path={normalReturnPath} color="#0f766e" delay="-1.1s" r={2.1} /></g>;
  }

  if (model.flowState.showWatchPath) {
    return <g aria-label="观察路径"><path className="wellbore-flow-path wellbore-flow-path-drill" d={drillPath} /><path className="wellbore-flow-path wellbore-flow-path-warning" d={normalReturnPath} /><DownArrows /><UpArrows color="#f97316" /><MovingParticle path={drillPath} color="#2563eb" delay="0s" /><MovingParticle path={normalReturnPath} color="#f97316" delay="-1.1s" r={2.1} /><circle className="wellbore-kick-pulse" cx={annulusX} cy={watchY} r="13" fill="#f97316" opacity="0.16" /><circle cx={annulusX} cy={watchY} r="4.8" fill="#f97316" /></g>;
  }

  const cls = level >= 4 ? 'wellbore-flow-path wellbore-flow-path-critical wellbore-flow-path-kick-return' : 'wellbore-flow-path wellbore-flow-path-critical wellbore-flow-path-warning-level wellbore-flow-path-kick-return';
  const plumeX = annulusX + wOf(13, g);
  const labelX = g.centerX + wOf(44, g);
  const labelY = Math.min(kickY + 14, g.bottom - 47);
  const influxPath = `M ${plumeX + wOf(24, g)} ${kickY + 1} C ${plumeX + 18} ${kickY - 5} ${annulusX + 15} ${kickY - 1} ${annulusX + 5} ${kickY + 4}`;
  const plumeFronts = [-8, 0, 8].map((dy, index) => ({
    key: dy,
    d: `M ${plumeX + wOf(20 - index * 1.5, g)} ${kickY + dy} C ${plumeX + 15} ${kickY + dy - 4} ${plumeX + 8} ${kickY + dy - 3} ${annulusX + 8} ${kickY + dy + 1}`,
    opacity: index === 1 ? 0.34 : 0.18,
  }));

  return (
    <g aria-label="井底溢流路径">
      <path className="wellbore-flow-path wellbore-flow-path-drill" d={drillPath} />
      <path className={cls} d={kickReturnPath} />
      <DownArrows />
      {visual.showMigrationPath ? <SlugPackets /> : null}
      <GasProfile />
      <MovingParticle path={drillPath} color="#2563eb" delay="0s" />
      <MovingParticle path={drillPath} color="#60a5fa" delay="-1.4s" r={1.8} />
      <MovingParticle path={kickReturnPath} color={visual.returnFlowColor} delay="-0.5s" r={1.55} />
      <path className="wellbore-influx-plume" d={`M ${plumeX + wOf(23, g)} ${kickY + 1} C ${plumeX + 16} ${kickY - 7} ${plumeX + 7} ${kickY - 2} ${annulusX + 4} ${kickY + 4} C ${plumeX + 9} ${kickY + 11} ${plumeX + 18} ${kickY + 10} ${plumeX + wOf(23, g)} ${kickY + 1} Z`} fill={`url(#influx-${id})`} />
      {plumeFronts.map((front) => <path key={front.key} d={front.d} fill="none" stroke="#b91c1c" strokeWidth="0.75" strokeLinecap="round" opacity={front.opacity} />)}
      <path d={influxPath} fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" markerEnd={`url(#arrow-critical-${level})`} />
      <MovingParticle path={influxPath} color="#f97316" delay="-0.4s" r={1.65} />
      <circle cx={annulusX + 5} cy={kickY + 4} r="4.4" fill="#dc2626" />
      <g className="wellbore-kick-tag" fontFamily="Microsoft YaHei, PingFang SC, Arial">
        <path d={`M ${annulusX + 10} ${kickY + 4} L ${labelX + 8} ${labelY + 20}`} stroke="#dc2626" strokeDasharray="3 5" opacity="0.24" />
        <rect x={labelX} y={labelY} width="94" height="30" rx="6" fill="#fff7f7" stroke="#fca5a5" />
        <text x={labelX + 8} y={labelY + 13} fill="#b91c1c" fontSize="8" fontWeight="800">疑似侵入点</text>
        <text x={labelX + 8} y={labelY + 25} fill="#7f1d1d" fontSize="6.8">深度 {depth(model.kickPointDepth)}</text>
      </g>
    </g>
  );
}

function BottomFocusInset({ model, g, level, id, compact }: { model: WellboreSimulationModel; g: Geometry; level: BackendLevel; id: string; compact: boolean }) {
  if (compact || level < 2) return null;
  const kickY = yOf(model.kickPointDepth, model, g);
  const annulusX = g.centerX + wOf(16, g);
  const x = g.formationX - 126;
  const y = g.top + 118;
  const w = 112;
  const h = 138;
  const cx = x + 50;
  const wallL = cx - 21;
  const wallR = cx + 21;
  const bitY = y + 103;
  const entryX = wallR + 1;
  return (
    <g className="wellbore-bottom-inset" aria-label="井底局部工程窗" fontFamily="Microsoft YaHei, PingFang SC, Arial">
      <path d={`M ${annulusX + 10} ${kickY + 4} C ${x - 24} ${kickY - 30} ${x - 18} ${y + h - 10} ${x + 6} ${y + h - 16}`} fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4 5" opacity="0.58" />
      <rect x={x} y={y} width={w} height={h} rx="7" fill="#ffffff" stroke="#cbd5e1" filter={`url(#soft-shadow-${id})`} />
      <rect x={x + w - 29} y={y + 25} width="22" height={h - 39} fill="#f4ead8" opacity="0.82" />
      <rect x={x + w - 29} y={y + 68} width="22" height="38" fill="#dcfce7" opacity="0.6" />
      <path d={`M ${wallL} ${y + 28} C ${wallL - 3} ${y + 57} ${wallL - 4} ${y + 88} ${wallL - 1} ${y + 116}`} fill="none" stroke="#475569" strokeWidth="1.1" strokeLinecap="round" />
      <path d={`M ${wallR} ${y + 28} C ${wallR + 3} ${y + 57} ${wallR + 4} ${y + 88} ${wallR + 1} ${y + 116}`} fill="none" stroke="#475569" strokeWidth="1.1" strokeLinecap="round" />
      <path d={`M ${wallL - 1} ${y + 116} Q ${cx} ${y + 123} ${wallR + 1} ${y + 116}`} fill="none" stroke="#475569" strokeWidth="0.9" opacity="0.72" />
      <rect x={cx - 3} y={y + 27} width="6" height="63" rx="2" fill={`url(#drill-${id})`} stroke="#2563eb" strokeWidth="0.7" />
      <rect x={cx - 9} y={y + 85} width="18" height="10" rx="1.5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="0.75" />
      <path d={`M ${cx - 18} ${bitY - 5} H ${cx + 18} L ${cx + 10} ${bitY + 10} H ${cx - 10} Z`} fill="#64748b" stroke="#334155" strokeWidth="0.8" />
      <path d={`M ${entryX + 30} ${y + 76} C ${entryX + 20} ${y + 70} ${entryX + 10} ${y + 72} ${entryX + 1} ${y + 78} C ${entryX + 10} ${y + 82} ${entryX + 20} ${y + 83} ${entryX + 30} ${y + 76} Z`} fill={`url(#influx-${id})`} opacity="0.86" />
      <path d={`M ${entryX + 30} ${y + 76} C ${entryX + 18} ${y + 72} ${entryX + 10} ${y + 74} ${entryX + 2} ${y + 78}`} fill="none" stroke="#dc2626" strokeWidth="1.35" strokeLinecap="round" markerEnd={`url(#arrow-critical-${level})`} />
      <circle cx={entryX + 1} cy={y + 78} r="2.7" fill="#dc2626" />
      <path className="wellbore-inset-influx-particle" d={`M ${entryX + 26} ${y + 76} C ${entryX + 17} ${y + 73} ${entryX + 9} ${y + 74} ${entryX + 2} ${y + 78}`} fill="none" stroke="#f97316" strokeWidth="0.95" strokeLinecap="round" opacity="0.36" />
      <path d={`M ${cx} ${y + 31} V ${y + 76}`} stroke="#2563eb" strokeWidth="1.35" strokeLinecap="round" />
      <path d={`M ${cx - 4} ${y + 70} L ${cx} ${y + 78} L ${cx + 4} ${y + 70}`} fill="#2563eb" />
      <path d={`M ${wallR - 7} ${y + 101} V ${y + 54}`} stroke="#dc2626" strokeWidth="1.05" strokeDasharray="4 8" opacity="0.44" />
      <path d={`M ${wallR - 11} ${y + 61} L ${wallR - 7} ${y + 53} L ${wallR - 3} ${y + 61}`} fill="#dc2626" opacity="0.62" />
      <text x={x + 9} y={y + 16} fill="#0f172a" fontSize="9" fontWeight="800">井底局部放大</text>
      <text x={x + 9} y={y + h - 10} fill="#7f1d1d" fontSize="7.4" fontWeight="700">侧壁入口 · 右环空上返</text>
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

export function WellboreSchemaFigure({ mode = 'thumbnail', backendLevel, wellDepth, bitDepth, flowIn, flowOut, spm = 0, casingPressure, drillPipePressure, pitGain, pitVolume, returnResponse = 0, totalGas = 0, activeSignals = [], pumpState, condition, cycleInfo, hasSamples = true, isRecovering = false, isStopped = false }: WellboreSchemaFigureProps) {
  const model = buildWellboreSimulationModel({ backendLevel, flowIn, flowOut, returnResponse, pitGain, pitVolume: pitVolume ?? pitGain, drillPipePressure, casingPressure, totalGas, spm, wellDepth, bitDepth, activeSignals, pumpState, condition, cycleInfo, hasSamples, isRecovering, isStopped });
  const compact = mode !== 'detail';
  const g = compact ? THUMB : DETAIL;
  const id = compact ? 'thumb' : 'detail';
  const color = levelColor(backendLevel);
  const visual = VISUAL_STATES[backendLevel];
  return (
    <div className={`wellbore-schema-figure wellbore-schema-figure-${mode}`} data-animation={visual.animationIntensity}>
      <svg className="wellbore-schema-overlay" viewBox={g.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${TEXT.aria} L${backendLevel} ${model.statusLabel}`}>
        <Defs id={id} />
        <defs><marker id={`arrow-critical-${backendLevel}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill={visual.returnFlowColor} /></marker></defs>
        <rect width="100%" height="100%" fill={`url(#panel-${id})`} />
        <rect x={compact ? 14 : 24} y={compact ? 16 : 18} width={g.width - (compact ? 28 : 48)} height={g.height - (compact ? 32 : 36)} rx="10" fill={`url(#grid-${id})`} opacity="0.24" />
        {!compact ? <Header /> : null}
        <Axis model={model} g={g} compact={compact} />
        <Formations model={model} g={g} compact={compact} id={id} />
        {visual.showObservationBand || visual.showTwoPhaseZone ? <Evidence model={model} g={g} /> : null}
        <Tubulars model={model} g={g} id={id} />
        <TubularJointMarks model={model} g={g} compact={compact} />
        <OpenHole model={model} g={g} />
        <FluidColumn model={model} g={g} id={id} level={backendLevel} />
        <Surface g={g} />
        <DrillString model={model} g={g} id={id} />
        <BitHydraulics model={model} g={g} level={backendLevel} />
        <Flow model={model} g={g} level={backendLevel} id={id} visual={visual} />
        <ReservoirEntryDetail model={model} g={g} level={backendLevel} visual={visual} />
        <EngineeringCallouts model={model} g={g} compact={compact} />
        <Status model={model} g={g} level={backendLevel} color={color} compact={compact} />
      </svg>
    </div>
  );
}

export default WellboreSchemaFigure;
