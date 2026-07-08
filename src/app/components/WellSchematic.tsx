import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import {
  buildWellboreSimulationModel,
  type WellboreSimulationModel,
  type WellboreTone,
} from '../lib/wellboreSimulation';

interface WellSchematicProps {
  mode?: 'thumbnail' | 'detail';
  wellDepth?: number;
  bitDepth?: number;
  flowIn: number;
  flowOut: number;
  spm?: number;
  casingPressure: number;
  drillPipePressure: number;
  pitGain: number;
  pitVolume?: number;
  returnResponse: number;
  totalGas?: number;
  backendLevel: BackendLevel;
  activeSignals?: string[];
  pumpState?: string;
  condition?: string;
  cycleInfo?: CycleInfo;
  hasSamples?: boolean;
  isRecovering?: boolean;
  isStopped?: boolean;
  compact?: boolean;
  surface?: 'dark' | 'light';
}

const G = {
  width: 760,
  height: 620,
  top: 78,
  bottom: 548,
  axisX: 76,
  gridLeft: 104,
  gridRight: 662,
  centerX: 346,
  stratX: 584,
  stratW: 58,
  labelX: 650,
};

const T = {
  titleDetail: '\u4e95\u7b52\u72b6\u6001\u5de5\u7a0b\u5256\u9762',
  titleSmall: '\u4e95\u7b52\u72b6\u6001',
  aria: '\u4e95\u7b52\u72b6\u6001\u5de5\u7a0b\u5256\u9762\u56fe',
  depth: '\u6df1\u5ea6 (m)',
  currentEvidence: '\u5f53\u524d\u8bc1\u636e\u6458\u8981',
  wellDepth: '\u4e95\u6df1', bit: '\u94bb\u5934', shoe: '\u5957\u7ba1\u978b', openHole: '\u88f8\u773c\u6bb5', formation: '\u5f53\u524d\u5c42\u4f4d', condition: '\u5de5\u51b5',
  surface: '\u5730\u9762\u7ebf / \u8f6c\u76d8\u9762', wellhead: '\u4e95\u53e3', bop: 'BOP / \u9632\u55b7\u5668\u7ec4', conductor: '\u5bfc\u7ba1', surfaceCasing: '\u8868\u5c42\u5957\u7ba1', intermediateCasing: '\u6280\u672f\u5957\u7ba1', cement: '\u56fa\u4e95\u6c34\u6ce5\u73af', drillString: '\u94bb\u67f1 / BHA', td: '\u4eba\u5de5\u4e95\u5e95',
  inlet: '\u5165\u53e3\u6d41\u91cf', outlet: '\u51fa\u53e3\u6d41\u91cf', pitGain: '\u6c60\u589e\u91cf', pitVolume: '\u603b\u6c60\u4f53\u79ef', spp: '\u7acb\u538b', casingPressure: '\u5957\u538b', returnResponse: '\u8fd4\u51fa\u54cd\u5e94', totalGas: '\u5168\u70c3',
  normal: 'L0 \u6b63\u5e38', watch: 'L1 \u89c2\u5bdf', kick: 'L2-L3 \u7591\u4f3c\u6ea2\u6d41', confirm: 'L4 \u6ea2\u6d41\u786e\u8ba4', noEvidence: '\u672a\u89e6\u53d1\u5f02\u5e38\u4fb5\u5165\u8bc1\u636e', watchCopy: '\u5f02\u5e38\u89c2\u5bdf\u4e2d', kickCopy: '\u7591\u4f3c\u8fd4\u51fa\u8def\u5f84', confirmCopy: '\u6ea2\u6d41\u5df2\u786e\u8ba4', evidenceBox: '\u5f02\u5e38\u8bc1\u636e', influx: '\u5f02\u5e38\u4fb5\u5165\u70b9', normalPath: '\u6b63\u5e38\u5faa\u73af\u8def\u5f84', watchPath: '\u89c2\u5bdf\u8def\u5f84', kickPath: '\u7591\u4f3c\u4e0a\u8fd4\u8def\u5f84', units: '\u6df1\u5ea6\u5355\u4f4d m \u00b7 \u538b\u529b\u5355\u4f4d MPa',
};

const LEVEL_LABEL: Record<BackendLevel, string> = { 0: T.normal, 1: T.watch, 2: '\u6ea2\u6d41\u9884\u8b66', 3: '\u7591\u4f3c\u6ea2\u6d41', 4: T.confirm };

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function formatFinite(value: number | undefined, digits: number) { return Number.isFinite(value) ? Number(value).toFixed(digits) : '--'; }
function formatDepth(value: number) { return `${Math.round(value)} m`; }
function formatFlow(value: number | undefined) { const text = formatFinite(value, 1); return text === '--' ? text : `${text} L/s`; }
function shortText(value: string, max = 22) { return value.length > max ? value.slice(0, max - 1) + '…' : value; }
function depthToY(depth: number, model: WellboreSimulationModel) { return G.top + (clamp(depth, 0, model.wellDepth) / model.wellDepth) * (G.bottom - G.top); }

function toneColor(tone: WellboreTone) {
  if (tone === 'critical') return '#dc2626';
  if (tone === 'warning') return '#d97706';
  if (tone === 'watch') return '#f59e0b';
  return '#0f766e';
}
function toneFill(tone: WellboreTone) {
  if (tone === 'critical') return '#fef2f2';
  if (tone === 'warning') return '#fff7ed';
  if (tone === 'watch') return '#fffbeb';
  return '#ecfdf5';
}
function toneBadge(tone: WellboreTone) {
  if (tone === 'critical') return 'border-red-200 bg-red-50 text-red-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (tone === 'watch') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}
function metricTone(isLight: boolean, tone: WellboreTone = 'normal') {
  if (tone === 'critical') return isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/40 bg-red-500/12 text-red-200';
  if (tone === 'warning') return isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/12 text-amber-200';
  if (tone === 'watch') return isLight ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-orange-500/40 bg-orange-500/12 text-orange-200';
  return isLight ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-white/10 bg-white/10 text-slate-100';
}

type Tubular = WellboreSimulationModel['tubularStrings'][number];
function tubulars(model: WellboreSimulationModel): Tubular[] {
  return model.tubularStrings;
}

type FigureGeometry = ReturnType<typeof buildGeometry>;
function buildGeometry(model: WellboreSimulationModel) {
  const bitY = depthToY(model.bitDepth, model);
  const shoeY = depthToY(model.casingShoeDepth, model);
  const wellBottomY = depthToY(model.wellDepth, model);
  const tube = tubulars(model);
  return {
    bitY,
    shoeY,
    wellBottomY,
    conductorY: depthToY(tube[0].bottomDepth, model),
    surfaceCasingY: depthToY(tube[1].bottomDepth, model),
    openHoleTopY: Math.min(Math.max(shoeY + 4, G.top + 220), wellBottomY - 42),
    returnTopY: G.top + 52,
    returnBottomY: Math.max(bitY - 18, shoeY + 26),
    influxY: depthToY(model.kickPointDepth, model),
    observationY: depthToY(model.observationDepth, model),
    noteY: clamp(bitY - 74, G.top + 118, G.bottom - 106),
  };
}

function openHoleGeometry(g: FigureGeometry) {
  const left = G.centerX - 33;
  const right = G.centerX + 33;
  const bottom = Math.min(g.wellBottomY + 8, G.bottom + 2);
  const mid = g.openHoleTopY + (bottom - g.openHoleTopY) * 0.48;
  const leftWall = 'M ' + left + ' ' + g.openHoleTopY + ' C ' + (left - 10) + ' ' + (g.openHoleTopY + 40) + ' ' + (left - 20) + ' ' + (mid - 36) + ' ' + (left - 15) + ' ' + mid + ' C ' + (left - 10) + ' ' + (mid + 44) + ' ' + (left - 24) + ' ' + (bottom - 50) + ' ' + (left - 18) + ' ' + bottom;
  const rightWall = 'M ' + right + ' ' + g.openHoleTopY + ' C ' + (right + 10) + ' ' + (g.openHoleTopY + 40) + ' ' + (right + 20) + ' ' + (mid - 36) + ' ' + (right + 15) + ' ' + mid + ' C ' + (right + 10) + ' ' + (mid + 44) + ' ' + (right + 23) + ' ' + (bottom - 52) + ' ' + (right + 18) + ' ' + bottom;
  const area = leftWall + ' H ' + (right + 18) + ' ' + rightWall.replace(/^M [^ ]+ [^ ]+ /, '') + ' Z';
  return { leftWall, rightWall, area, bottom };
}

function ReadoutCard({ label, value, unit, tone, isLight }: { label: string; value: string; unit: string; tone: WellboreTone; isLight: boolean }) {
  return (
    <div className={`well-schematic-readout flex min-h-[58px] min-w-0 flex-col justify-between rounded-md border px-2.5 py-2 ${metricTone(isLight, tone)}`}>
      <div className="truncate text-[11px] leading-tight opacity-70">{label}</div>
      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
        <span className="truncate text-[17px] font-semibold tabular-nums leading-none">{value}</span>
        {unit && value !== '--' ? <span className="shrink-0 text-[10px] leading-none opacity-65">{unit}</span> : null}
      </div>
    </div>
  );
}

function DepthAxis({ model, line, muted, compact, minimal = false }: { model: WellboreSimulationModel; line: string; muted: string; compact: boolean; minimal?: boolean }) {
  const baseTicks = Array.from({ length: Math.floor(model.wellDepth / 1000) + 1 }, (_, index) => index * 1000);
  const ticks = Array.from(new Set([...baseTicks, Math.round(model.wellDepth)])).sort((a, b) => a - b);
  return (
    <g aria-label={T.depth} fontFamily="sans-serif">
      {!minimal ? <text x={G.axisX - 44} y={G.top - 22} fill={line} fontSize="12" fontWeight="700">{T.depth}</text> : null}
      <line x1={G.axisX} y1={G.top} x2={G.axisX} y2={G.bottom} stroke={line} strokeWidth="1.3" />
      {ticks.map((depth) => {
        const y = depthToY(depth, model);
        return (
          <g key={depth}>
            <line x1={G.axisX - 7} y1={y} x2={G.axisX + 7} y2={y} stroke={line} strokeWidth="1.1" />
            <line x1={G.gridLeft} y1={y} x2={G.gridRight} y2={y} stroke="#cbd5e1" strokeWidth="0.65" strokeDasharray="4 8" opacity="0.68" />
            {!compact ? <text x={G.axisX - 11} y={y + 4} fill={muted} fontSize={minimal ? '9' : '10'} textAnchor="end">{Math.round(depth)}</text> : null}
          </g>
        );
      })}
    </g>
  );
}

function StratigraphyColumn({ model, compact }: { model: WellboreSimulationModel; compact: boolean }) {
  return (
    <g aria-label={T.formation}>
      <rect x={G.stratX - 1} y={G.top} width={G.stratW + 2} height={G.bottom - G.top} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
      {model.formationBands.map((band) => {
        const y = depthToY(band.from, model);
        const endY = depthToY(band.to, model);
        const height = Math.max(10, endY - y);
        return (
          <g key={band.key}>
            <rect x={G.stratX} y={y} width={G.stratW} height={height} fill={band.fill} />
            <rect x={G.stratX} y={y} width={G.stratW} height={height} fill={band.key === 'mudstone' ? 'url(#wellboreShaleLines)' : 'url(#wellboreSandDots)'} opacity="0.76" />
            {!compact && height > 34 ? <text x={G.stratX + G.stratW / 2} y={y + Math.min(height / 2 + 4, height - 6)} fill={band.accent} fontSize="8" fontWeight={band.key === 'target' ? 700 : 600} textAnchor="middle" opacity="0.78">{band.label}</text> : null}
          </g>
        );
      })}
    </g>
  );
}

function Cement({ spec, model }: { spec: Tubular; model: WellboreSimulationModel }) {
  const y2 = depthToY(spec.bottomDepth, model);
  const outerLeft = G.centerX - spec.cementOuterWidth / 2;
  const outerRight = G.centerX + spec.cementOuterWidth / 2;
  const innerLeft = G.centerX - spec.outerWidth / 2;
  const innerRight = G.centerX + spec.outerWidth / 2;
  return <path d={`M ${outerLeft} ${G.top} H ${outerRight} V ${y2} H ${outerLeft} Z M ${innerLeft} ${G.top} V ${y2} H ${innerRight} V ${G.top} Z`} fill="url(#wellboreCementHatch)" fillRule="evenodd" opacity="0.74" />;
}

function TubularString({ spec, model }: { spec: Tubular; model: WellboreSimulationModel }) {
  const y2 = depthToY(spec.bottomDepth, model);
  const outerLeft = G.centerX - spec.outerWidth / 2;
  const outerRight = G.centerX + spec.outerWidth / 2;
  const innerRight = G.centerX + spec.innerWidth / 2;
  const wall = Math.max(4, (spec.outerWidth - spec.innerWidth) / 2);
  return (
    <g aria-label={spec.label}>
      <rect x={outerLeft} y={G.top} width={wall} height={y2 - G.top} fill={spec.fill} stroke={spec.stroke} strokeWidth="0.8" />
      <rect x={innerRight} y={G.top} width={wall} height={y2 - G.top} fill={spec.fill} stroke={spec.stroke} strokeWidth="0.8" />
      <line x1={outerLeft} y1={G.top} x2={outerLeft} y2={y2} stroke={spec.stroke} strokeWidth="0.8" />
      <line x1={outerRight + wall} y1={G.top} x2={outerRight + wall} y2={y2} stroke={spec.stroke} strokeWidth="0.8" />
    </g>
  );
}

function CasingShoeMarker({ spec, model }: { spec: Tubular; model: WellboreSimulationModel }) {
  const y = depthToY(spec.bottomDepth, model);
  const outerLeft = G.centerX - spec.outerWidth / 2;
  const outerRight = G.centerX + spec.outerWidth / 2;
  const innerLeft = G.centerX - spec.innerWidth / 2;
  const innerRight = G.centerX + spec.innerWidth / 2;
  const wall = Math.max(4, (spec.outerWidth - spec.innerWidth) / 2);
  return (
    <g aria-label={`${spec.label}${T.shoe}`}>
      <path d={`M ${outerLeft} ${y} L ${innerLeft} ${y + 11} L ${innerLeft} ${y + 15} L ${outerLeft} ${y + 4} Z`} fill={spec.stroke} opacity="0.88" />
      <path d={`M ${outerRight + wall} ${y} L ${innerRight} ${y + 11} L ${innerRight} ${y + 15} L ${outerRight + wall} ${y + 4} Z`} fill={spec.stroke} opacity="0.88" />
      <line x1={innerLeft} y1={y + 11} x2={innerRight} y2={y + 11} stroke={spec.stroke} strokeWidth="1.2" opacity="0.88" />
    </g>
  );
}

function SurfaceEquipment({ line, detail = false }: { line: string; detail?: boolean }) {
  if (detail) {
    return (
      <g aria-label={T.bop}>
        <line x1={G.gridLeft} y1={G.top + 2} x2={G.gridRight} y2={G.top + 2} stroke="#94a3b8" strokeWidth="0.9" />
        <line x1={G.centerX} y1="1" x2={G.centerX} y2="6" stroke="#64748b" strokeWidth="1.5" />
        <rect x={G.centerX - 12} y="6" width="24" height="5" rx="1.2" fill="#dde5ec" stroke="#64748b" strokeWidth="0.9" />
        <rect x={G.centerX - 18} y="11" width="36" height="6" rx="1.2" fill="#cbd5e1" stroke="#475569" strokeWidth="0.9" />
        <rect x={G.centerX - 26} y="17" width="52" height="9" rx="1.8" fill="#2563eb" stroke="#1e40af" strokeWidth="1.1" />
        <rect x={G.centerX - 38} y="20" width="8" height="4" rx="1" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="0.75" />
        <rect x={G.centerX + 30} y="20" width="8" height="4" rx="1" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="0.75" />
        <rect x={G.centerX - 16} y="26" width="32" height="6" rx="1.2" fill="#94a3b8" stroke="#475569" strokeWidth="0.9" />
        <rect x={G.centerX - 12} y="32" width="24" height="8" rx="1.2" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.9" />
        <line x1={G.centerX - 50} y1="22" x2={G.centerX - 38} y2="22" stroke="#64748b" strokeWidth="1.4" />
        <line x1={G.centerX + 38} y1="22" x2={G.centerX + 50} y2="22" stroke="#64748b" strokeWidth="1.4" />
      </g>
    );
  }

  return (
    <g aria-label={T.bop}>
      <line x1={G.gridLeft} y1={G.top} x2={G.gridRight} y2={G.top} stroke="#64748b" strokeWidth="1.4" />
      <rect x={G.centerX - 20} y="6" width="40" height="12" rx="2" fill="#d9e2ec" stroke="#64748b" strokeWidth="1.4" />
      <line x1={G.centerX} y1="0" x2={G.centerX} y2="6" stroke="#475569" strokeWidth="2" />
      <rect x={G.centerX - 28} y="18" width="56" height="12" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.4" />
      <rect x={G.centerX - 36} y="30" width="72" height="16" rx="3" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.8" />
      <rect x={G.centerX - 54} y="34" width="18" height="9" rx="2" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="1.2" />
      <rect x={G.centerX + 36} y="34" width="18" height="9" rx="2" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="1.2" />
      <rect x={G.centerX - 46} y="46" width="92" height="13" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
      <rect x={G.centerX - 32} y="59" width="64" height="17" rx="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
      <line x1={G.centerX - 92} y1="38" x2={G.centerX - 54} y2="38" stroke="#64748b" strokeWidth="2.4" />
      <line x1={G.centerX + 54} y1="38" x2={G.centerX + 92} y2="38" stroke="#64748b" strokeWidth="2.4" />
      <circle cx={G.centerX - 99} cy="38" r="6" fill="#fff" stroke="#64748b" strokeWidth="1.8" />
      <circle cx={G.centerX + 99} cy="38" r="6" fill="#fff" stroke="#64748b" strokeWidth="1.8" />
    </g>
  );
}
function OpenHole({ geometry }: { geometry: FigureGeometry }) {
  const shape = openHoleGeometry(geometry);
  return (
    <g aria-label={T.openHole}>
      <path d={shape.area} fill="#fffaf0" stroke="none" />
      <path d={shape.area} fill="url(#wellboreOpenHoleTexture)" opacity="0.4" />
      <path d={shape.leftWall} fill="none" stroke="#475569" strokeWidth="1.9" strokeLinecap="round" />
      <path d={shape.rightWall} fill="none" stroke="#475569" strokeWidth="1.9" strokeLinecap="round" />
      <line x1={G.centerX - 26} y1={shape.bottom} x2={G.centerX + 26} y2={shape.bottom} stroke="#475569" strokeWidth="1.2" opacity="0.55" />
    </g>
  );
}

function DrillString({ geometry, line, detail = false }: { geometry: FigureGeometry; line: string; detail?: boolean }) {
  const stringTop = detail ? 40 : 6;
  const bhaTop = Math.max(geometry.bitY - 54, G.top + 36);
  return (
    <g aria-label={T.drillString}>
      <rect x={G.centerX - 6} y={stringTop} width="12" height={Math.max(22, bhaTop - stringTop)} fill="#dbeafe" stroke="#2563eb" strokeWidth="1.4" />
      <rect x={G.centerX - 10} y={bhaTop} width="20" height={Math.max(12, geometry.bitY - bhaTop - 10)} rx="2" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.4" />
      <path d={`M ${G.centerX - 22} ${geometry.bitY - 10} H ${G.centerX + 22} L ${G.centerX + 13} ${geometry.bitY + 6} H ${G.centerX - 13} Z`} fill="#64748b" stroke={line} strokeWidth="1.5" />
      <path d={`M ${G.centerX - 23} ${geometry.bitY + 6} L ${G.centerX - 12} ${geometry.bitY + 18} L ${G.centerX} ${geometry.bitY + 7} L ${G.centerX + 12} ${geometry.bitY + 18} L ${G.centerX + 23} ${geometry.bitY + 6}`} fill="none" stroke={line} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function LeaderLabel({ x1, y1, label, value, muted, line }: { x1: number; y1: number; label: string; value?: string; muted: string; line: string }) {
  return (
    <g fontFamily="sans-serif" fontSize="10" fill={line}>
      <path d={`M ${x1} ${y1} H ${G.labelX - 11}`} fill="none" stroke={muted} strokeWidth="0.9" />
      <circle cx={G.labelX - 11} cy={y1} r="1.7" fill={line} />
      <text x={G.labelX} y={y1 - 2} fontWeight="700">{label}</text>
      {value ? <text x={G.labelX} y={y1 + 12} fill={muted} fontSize="9">{value}</text> : null}
    </g>
  );
}

function SideCallout({
  anchorX,
  anchorY,
  side,
  label,
  value,
  muted,
  line,
}: {
  anchorX: number;
  anchorY: number;
  side: 'left' | 'right';
  label: string;
  value?: string;
  muted: string;
  line: string;
}) {
  const elbowX = side === 'left' ? 146 : 560;
  const textX = side === 'left' ? 176 : 572;
  const textAnchor = side === 'left' ? 'end' : 'start';
  const lineEndX = side === 'left' ? textX + 10 : textX - 10;
  return (
    <g fontFamily="sans-serif">
      <path
        d={`M ${anchorX} ${anchorY} H ${elbowX} L ${lineEndX} ${anchorY}`}
        fill="none"
        stroke={muted}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={anchorX} cy={anchorY} r="2.1" fill={line} />
      <text x={textX} y={anchorY - 4} fill={line} fontSize="10.5" fontWeight="700" textAnchor={textAnchor}>{label}</text>
      {value ? <text x={textX} y={anchorY + 10} fill={muted} fontSize="9" textAnchor={textAnchor}>{value}</text> : null}
    </g>
  );
}

function DetailAnnotations({
  geometry,
  muted,
  line,
}: {
  geometry: FigureGeometry;
  muted: string;
  line: string;
}) {
  return (
    <g aria-label="工程结构标注">
      <SideCallout anchorX={G.centerX + 44} anchorY={geometry.shoeY + 10} side="right" label={T.shoe} muted={muted} line={line} />
      <SideCallout anchorX={G.centerX + 20} anchorY={geometry.bitY + 4} side="right" label={T.bit} muted={muted} line={line} />
    </g>
  );
}

function StatusHint({ title, copy, tone, x = 116, y = 104, compact = false }: { title: string; copy: string; tone: WellboreTone; x?: number; y?: number; compact?: boolean }) {
  const color = toneColor(tone);
  const width = compact ? 118 : 170;
  const height = compact ? 30 : 48;
  const titleY = compact ? y + 13 : y + 19;
  const copyY = compact ? y + 23 : y + 36;
  const titleSize = compact ? '9.6' : '11';
  const copySize = compact ? '7.8' : '9.5';
  return (
    <g aria-label={title} className="wellbore-status-breathe">
      <rect x={x} y={y} width={width} height={height} rx={compact ? 7 : 8} fill={toneFill(tone)} stroke={color} strokeWidth="1.2" />
      <text x={x + 10} y={titleY} fill={color} fontSize={titleSize} fontWeight="800">{title}</text>
      <text x={x + 10} y={copyY} fill="#334155" fontSize={copySize}>{copy}</text>
    </g>
  );
}

function BitMarker({ geometry, tone }: { geometry: FigureGeometry; tone: WellboreTone }) {
  const color = toneColor(tone);
  return (
    <g className="wellbore-bit-pulse" aria-label={T.bit}>
      <circle cx={G.centerX} cy={geometry.bitY + 5} r="13" fill={color} opacity="0.12" />
      <circle cx={G.centerX} cy={geometry.bitY + 5} r="5.2" fill={color} opacity="0.68" />
    </g>
  );
}

function EvidenceBands({ model }: { model: WellboreSimulationModel }) {
  return (
    <g aria-label={T.currentEvidence}>
      {model.evidenceBands.map((band) => {
        const y = depthToY(band.from, model);
        const endY = depthToY(band.to, model);
        const bandColor = toneColor(band.tone);
        const x = band.lane === 'formation' ? G.centerX + 34 : band.lane === 'bit' ? G.centerX - 15 : G.centerX - 38;
        const width = band.lane === 'formation' ? 102 : band.lane === 'bit' ? 30 : 76;
        return <rect key={band.key} x={x} y={y} width={width} height={Math.max(14, endY - y)} rx="9" fill={bandColor} opacity={band.opacity ?? 0.18} />;
      })}
    </g>
  );
}

function NormalOverlay({ geometry }: { geometry: FigureGeometry }) {
  return (
    <g aria-label={T.normalPath}>
      <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M ${G.centerX} ${G.top + 6} V ${Math.max(geometry.bitY - 20, G.top + 28)}`} />
      <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M ${G.centerX - 27} ${geometry.returnBottomY} C ${G.centerX - 47} ${(geometry.returnBottomY + geometry.returnTopY) / 2} ${G.centerX - 42} ${G.top + 86} ${G.centerX - 24} ${geometry.returnTopY}`} />
      <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M ${G.centerX + 27} ${geometry.returnBottomY} C ${G.centerX + 47} ${(geometry.returnBottomY + geometry.returnTopY) / 2} ${G.centerX + 42} ${G.top + 86} ${G.centerX + 24} ${geometry.returnTopY}`} />
      <StatusHint title={T.normal} copy="\u5faa\u73af\u6b63\u5e38" tone="normal" x={120} y={494} compact />
    </g>
  );
}

function WatchOverlay({ geometry }: { geometry: FigureGeometry }) {
  return (
    <g aria-label={T.watchPath}>
      <path className="wellbore-flow-path wellbore-flow-path-warning wellbore-flow-path-subtle" d={`M ${G.centerX + 29} ${geometry.returnBottomY} C ${G.centerX + 48} ${(geometry.returnBottomY + geometry.returnTopY) / 2} ${G.centerX + 44} ${G.top + 102} ${G.centerX + 25} ${geometry.returnTopY}`} />
      <g className="wellbore-kick-pulse" aria-label={T.watch}>
        <circle cx={G.centerX + 44} cy={geometry.observationY} r="12" fill="#fb923c" opacity="0.16" />
        <circle cx={G.centerX + 44} cy={geometry.observationY} r="4.8" fill="#f97316" opacity="0.84" />
      </g>
      <StatusHint title={T.watch} copy="\u89c2\u5bdf\u4e2d" tone="watch" x={120} y={494} compact />
    </g>
  );
}

function KickOverlay({ geometry, backendLevel, note }: { geometry: FigureGeometry; backendLevel: BackendLevel; note: string }) {
  const confirmed = backendLevel >= 4;
  const tone: WellboreTone = confirmed ? 'critical' : 'warning';
  const pathClass = confirmed ? 'wellbore-flow-path-critical' : 'wellbore-flow-path-critical wellbore-flow-path-warning-level';
  const color = confirmed ? '#dc2626' : '#ef4444';
  return (
    <g aria-label={T.kickPath}>
      <path className={`wellbore-flow-path ${pathClass}`} d={`M ${G.centerX - 28} ${geometry.returnBottomY} C ${G.centerX - 54} ${(geometry.returnBottomY + geometry.returnTopY) / 2} ${G.centerX - 50} ${G.top + 98} ${G.centerX - 25} ${geometry.returnTopY}`} />
      <path className={`wellbore-flow-path ${pathClass}`} d={`M ${G.centerX + 28} ${geometry.returnBottomY} C ${G.centerX + 54} ${(geometry.returnBottomY + geometry.returnTopY) / 2} ${G.centerX + 50} ${G.top + 98} ${G.centerX + 25} ${geometry.returnTopY}`} />
      <path className={`wellbore-flow-path ${pathClass}`} d={`M ${G.centerX + 118} ${geometry.influxY + 22} C ${G.centerX + 82} ${geometry.influxY + 8} ${G.centerX + 60} ${geometry.influxY + 2} ${G.centerX + 34} ${geometry.influxY}`} />
      <g className="wellbore-kick-pulse" aria-label={T.influx}>
        <circle cx={G.centerX + 35} cy={geometry.influxY} r="15" fill={color} opacity="0.16" />
        <circle cx={G.centerX + 35} cy={geometry.influxY} r="5.8" fill={color} opacity="0.88" />
      </g>
      <g className="wellbore-evidence-callout" aria-label={T.evidenceBox}>
        <rect x={G.centerX + 92} y={geometry.noteY + 4} width="138" height="46" rx="8" fill={toneFill(tone)} stroke={color} strokeWidth="1.2" />
        <text x={G.centerX + 104} y={geometry.noteY + 21} fill={color} fontSize="10" fontWeight="800">{T.evidenceBox}</text>
        <text x={G.centerX + 104} y={geometry.noteY + 37} fill="#334155" fontSize="8.8">{shortText(note, 18)}</text>
      </g>
      <StatusHint title={confirmed ? T.confirm : T.kick} copy={confirmed ? T.confirmCopy : T.kickCopy} tone={tone} x={120} y={494} compact />
    </g>
  );
}

export function WellSchematic({
  mode = 'thumbnail',
  wellDepth,
  bitDepth,
  flowIn,
  flowOut,
  spm = 0,
  casingPressure,
  drillPipePressure,
  pitGain,
  pitVolume,
  returnResponse,
  totalGas = 0,
  backendLevel,
  activeSignals = [],
  pumpState,
  condition,
  cycleInfo,
  hasSamples = true,
  isRecovering = false,
  isStopped = false,
  compact = false,
  surface = 'dark',
}: WellSchematicProps) {
  const isLight = surface === 'light';
  const isDetail = mode === 'detail';
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

  const geometry = buildGeometry(model);
  const strings = tubulars(model);
  const color = toneColor(model.tone);
  const line = isLight ? '#334155' : '#cbd5e1';
  const muted = isLight ? '#64748b' : '#94a3b8';
  const panel = isLight ? '#ffffff' : '#08111f';
  const metricLevelTone: WellboreTone = backendLevel >= 2 ? 'warning' : backendLevel === 1 ? 'watch' : 'normal';
  const evidenceNote = model.evidenceNotes[0] || model.statusDescription;

  const readouts = [
    { label: T.inlet, value: formatFinite(flowIn, 1), unit: 'L/s', tone: model.flowState.inflowTone },
    { label: T.outlet, value: formatFinite(flowOut, 1), unit: 'L/s', tone: model.flowState.annulusTone },
    { label: T.pitGain, value: formatFinite(pitGain, 2), unit: 'm\u00b3', tone: metricLevelTone },
    { label: T.pitVolume, value: formatFinite(pitVolume ?? pitGain, 2), unit: 'm\u00b3', tone: backendLevel >= 2 ? 'warning' : 'normal' },
    { label: T.spp, value: formatFinite(drillPipePressure, 2), unit: 'MPa', tone: activeSignals.includes('standpipe_pressure') || activeSignals.includes('spp_drop') ? model.tone : 'normal' },
    { label: T.casingPressure, value: formatFinite(casingPressure, 2), unit: 'MPa', tone: activeSignals.includes('casing_pressure') ? model.tone : 'normal' },
    { label: T.returnResponse, value: formatFinite(returnResponse, 1), unit: '%', tone: metricLevelTone },
    { label: T.totalGas, value: formatFinite(totalGas, 2), unit: '%', tone: activeSignals.includes('total_gas') ? model.tone : 'normal' },
  ];
  const summaryMetrics = compact ? readouts.slice(0, 4) : readouts;
  const topReadouts = !isDetail && !compact ? summaryMetrics.slice(0, 2) : [];
  const bottomReadouts = !isDetail && !compact ? summaryMetrics.slice(2, 6) : [];
  const figureViewBox = isDetail ? `0 0 ${G.width} ${G.height}` : `0 0 ${G.width} ${G.height}`;

  return (
    <div className={`well-schematic-card well-schematic-card-${mode} ${isDetail ? 'well-schematic-card-detail' : ''} ${compact ? 'well-schematic-card-compact' : ''} flex h-full min-h-[260px] flex-col overflow-hidden rounded-md border p-2.5 lg:min-h-0 ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-700 bg-slate-950 text-slate-100'}`}>
      {!isDetail ? <div className="well-schematic-status-head mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="well-schematic-status-dot" style={{ backgroundColor: color }} />
            <h3 className="truncate text-base font-semibold">{T.titleSmall}</h3>
          </div>
          <p className="well-schematic-status-copy mt-0.5 text-[11px] ops-muted">{model.conditionLabel}</p>
        </div>
        <div className={`well-schematic-status-badge shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${toneBadge(model.tone)}`}>{model.statusLabel}</div>
      </div> : null}

      {topReadouts.length > 0 ? <div className="well-schematic-readouts mb-2 grid grid-cols-2 gap-2">{topReadouts.map((metric) => <ReadoutCard key={metric.label} {...metric} isLight={isLight} />)}</div> : null}

      <div className={`well-schematic-figure min-h-0 flex-1 overflow-hidden rounded-md border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-950'}`}>
        <svg viewBox={figureViewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={`${T.aria}, L${backendLevel}, ${model.statusLabel}`}>
          <defs>
            <pattern id="wellboreSandDots" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="0.8" fill="#a16207" opacity="0.32" /><circle cx="10" cy="9" r="0.65" fill="#a16207" opacity="0.22" /></pattern>
            <pattern id="wellboreShaleLines" width="18" height="9" patternUnits="userSpaceOnUse"><path d="M0 5 Q4 2 9 5 T18 5" fill="none" stroke="#64748b" strokeWidth="0.55" opacity="0.36" /></pattern>
            <pattern id="wellboreCementHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#e5e7eb" /><line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="1" opacity="0.6" /></pattern>
            <pattern id="wellboreOpenHoleTexture" width="20" height="16" patternUnits="userSpaceOnUse"><path d="M2 6 C7 1 12 10 18 4" fill="none" stroke="#b45309" strokeWidth="0.7" opacity="0.35" /><circle cx="6" cy="13" r="0.9" fill="#92400e" opacity="0.28" /></pattern>
          </defs>

          {!isDetail ? <rect width={G.width} height={G.height} fill={panel} /> : null}
          {!isDetail ? <rect x="18" y="14" width={G.width - 36} height={G.height - 28} rx="12" fill="#fff" stroke="#cbd5e1" strokeWidth="1.2" /> : null}
          <rect x={G.gridLeft} y={G.top} width={G.gridRight - G.gridLeft} height={G.bottom - G.top} fill="#f8fafc" stroke="#dbe2ea" strokeWidth="1" />
          <line x1={G.centerX} y1={G.top} x2={G.centerX} y2={G.bottom} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="5 6" opacity="0.65" />
          <DepthAxis model={model} line={line} muted={muted} compact={compact} minimal={isDetail} />
          <StratigraphyColumn model={model} compact={compact} />
          <g aria-label={T.cement}>{strings.map((spec) => <Cement key={`cement-${spec.key}`} spec={spec} model={model} />)}</g>
          {strings.map((spec) => <TubularString key={spec.key} spec={spec} model={model} />)}
          {strings.map((spec) => <CasingShoeMarker key={`shoe-${spec.key}`} spec={spec} model={model} />)}
          <OpenHole geometry={geometry} />
          {!isDetail && backendLevel >= 1 ? <EvidenceBands model={model} /> : null}
          <SurfaceEquipment line={line} detail={isDetail} />
          <DrillString geometry={geometry} line={line} detail={isDetail} />
          {model.flowState.showNormalPath ? <NormalOverlay geometry={geometry} /> : null}
          {model.flowState.showWatchPath ? <WatchOverlay geometry={geometry} /> : null}
          {model.flowState.showKickPath ? <KickOverlay geometry={geometry} backendLevel={backendLevel} note={evidenceNote} /> : null}
          <BitMarker geometry={geometry} tone={model.tone === 'normal' ? 'normal' : model.tone === 'watch' ? 'watch' : backendLevel >= 4 ? 'critical' : 'warning'} />
          {isDetail ? <DetailAnnotations geometry={geometry} muted={muted} line={line} /> : null}
          {!isDetail ? <>
            <path d={`M ${G.centerX - 180} ${G.top + 50} H ${G.centerX - 44}`} stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            <path d={`M ${G.centerX + 44} ${G.top + 50} H ${G.centerX + 182}`} stroke={model.flowState.showKickPath ? '#dc2626' : model.flowState.showWatchPath ? '#f59e0b' : '#0d9488'} strokeWidth="3" strokeLinecap="round" />
            {!compact ? <g fontFamily="sans-serif"><LeaderLabel x1={G.centerX + 58} y1={44} label={T.bop} muted={muted} line={line} /><LeaderLabel x1={G.centerX + 44} y1={geometry.shoeY} label={T.shoe} value={formatDepth(model.casingShoeDepth)} muted={muted} line={line} /><LeaderLabel x1={G.centerX + 55} y1={(geometry.shoeY + geometry.wellBottomY) / 2} label={T.openHole} value={formatDepth(model.openHoleLength)} muted={muted} line={line} /><LeaderLabel x1={G.centerX + 22} y1={geometry.bitY} label={T.bit} value={formatDepth(model.bitDepth)} muted={muted} line={line} /><LeaderLabel x1={G.centerX + 52} y1={geometry.wellBottomY} label={T.td} value={formatDepth(model.wellDepth)} muted={muted} line={line} /></g> : null}
          </> : null}
          {compact ? <g fontFamily="sans-serif" fontSize="12"><rect x="38" y="104" width="134" height="50" rx="8" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.2" opacity="0.96" /><text x="52" y="123" fill="#2563eb" fontSize="11" fontWeight="800">{T.inlet}</text><text x="52" y="143" fill="#2563eb" fontSize="14">{formatFlow(flowIn)}</text><rect x="588" y="104" width="134" height="50" rx="8" fill={model.flowState.showKickPath ? '#fff1f2' : '#ecfdf5'} stroke={model.flowState.showKickPath ? '#dc2626' : model.flowState.showWatchPath ? '#f59e0b' : '#0d9488'} strokeWidth="1.2" opacity="0.96" /><text x="602" y="123" fill={model.flowState.showKickPath ? '#dc2626' : model.flowState.showWatchPath ? '#f59e0b' : '#0d9488'} fontSize="11" fontWeight="800">{T.outlet}</text><text x="602" y="143" fill={model.flowState.showKickPath ? '#dc2626' : model.flowState.showWatchPath ? '#f59e0b' : '#0d9488'} fontSize="14">{formatFlow(flowOut)}</text><text x="38" y="582" fill={muted} fontSize="10">{LEVEL_LABEL[backendLevel]}</text></g> : null}
        </svg>
      </div>

      {isDetail ? null : null}

      {bottomReadouts.length > 0 ? <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">{bottomReadouts.map((metric) => <ReadoutCard key={metric.label} {...metric} isLight={isLight} />)}</div> : null}
    </div>
  );
}


