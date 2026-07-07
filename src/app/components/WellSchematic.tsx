import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from '../lib/wellboreState';

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
  metrics?: Array<{
    label: string;
    value: string;
    unit: string;
    state?: 'normal' | 'warning' | 'critical';
  }>;
}

type WellMetric = NonNullable<WellSchematicProps['metrics']>[number];

const DEFAULT_CASING_SHOE_DEPTH = 3200;

function metricTone(isLight: boolean, state: 'normal' | 'warning' | 'critical' = 'normal') {
  if (state === 'critical') return isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/40 bg-red-500/12 text-red-200';
  if (state === 'warning') return isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/12 text-amber-200';
  return isLight ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-white/10 bg-white/10 text-slate-100';
}

function levelVisual(level: BackendLevel) {
  if (level >= 4) return { accent: '#dc2626', soft: '#fee2e2', badge: 'border-red-200 bg-red-50 text-red-700' };
  if (level === 3) return { accent: '#ea580c', soft: '#ffedd5', badge: 'border-orange-200 bg-orange-50 text-orange-700' };
  if (level === 2) return { accent: '#d97706', soft: '#fef3c7', badge: 'border-amber-200 bg-amber-50 text-amber-700' };
  if (level === 1) return { accent: '#0891b2', soft: '#cffafe', badge: 'border-cyan-200 bg-cyan-50 text-cyan-700' };
  return { accent: '#0f766e', soft: '#ccfbf1', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
}

function formatFinite(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function formatFiniteWithUnit(value: number, digits: number, unit: string) {
  const formatted = formatFinite(value, digits);
  return formatted === '--' ? formatted : `${formatted} ${unit}`;
}

function includesAny(value: string | undefined, tokens: string[]) {
  const normalized = value?.toLowerCase().trim() ?? '';
  return tokens.some((token) => normalized.includes(token));
}

function deriveWellStatus({
  backendLevel,
  pumpState,
  condition,
  cycleInfo,
  hasSamples = true,
  isRecovering = false,
  isStopped = false,
  flowIn,
  flowOut,
  spm,
  circulationActive,
}: {
  backendLevel: BackendLevel;
  pumpState?: string;
  condition?: string;
  cycleInfo?: CycleInfo;
  hasSamples?: boolean;
  isRecovering?: boolean;
  isStopped?: boolean;
  flowIn: number;
  flowOut: number;
  spm: number;
  circulationActive: boolean;
}) {
  const cycleState = cycleInfo?.state;
  const cycleLabel = cycleInfo?.stateLabel || cycleInfo?.shortLabel || '';
  const pumpStateText = pumpState?.trim() || '';
  const conditionText = condition?.trim() || '';
  const pumpingActive = flowIn > 0.8 || spm > 8;
  const returnOnlyActive = !pumpingActive && flowOut > 0.8;
  const hasExplicitCondition = conditionText.length > 0 && !includesAny(condition, ['实时检测']);
  const explicitStopPump = includesAny(pumpState, ['停泵', 'stop']);
  const explicitRestart = includesAny(pumpState, ['开泵', 'restart', 'recover']);
  const explicitTripping = includesAny(condition, ['起下钻', 'tripping', 'trip']);
  const explicitObservation = includesAny(condition, ['扰动', '观察']);
  const explicitCirculation = includesAny(condition, ['循环', 'circulating']);
  const explicitDrilling = includesAny(condition, ['钻进', 'drilling']);
  const explicitStable = includesAny(condition, ['稳态', '稳定', 'stable', '正常']);
  const fallbackCycleTripping = !hasExplicitCondition && cycleState === 0 && returnOnlyActive;
  const fallbackCycleCirculation = !hasExplicitCondition && (cycleState === 2 || cycleState === 5);
  const fallbackCycleDrilling = !hasExplicitCondition && cycleState === 1;
  const inferredTripping = !hasExplicitCondition && !explicitCirculation && !explicitDrilling && returnOnlyActive;
  const inferredCirculation = !hasExplicitCondition && pumpingActive && flowOut > 0.5;
  const stopPump = explicitStopPump || (!hasExplicitCondition && cycleState === 3);
  const restart = explicitRestart || (!hasExplicitCondition && cycleState === 4);
  const trippingObservation = explicitTripping || (explicitObservation && returnOnlyActive) || fallbackCycleTripping || inferredTripping;
  const circulationStable = explicitCirculation
    || fallbackCycleCirculation
    || (inferredCirculation && includesAny(pumpState, ['normal', 'circulating', '循环']));
  const drillingStable = explicitDrilling
    || fallbackCycleDrilling
    || (!trippingObservation && !circulationStable && explicitStable);
  const waitingForData = !hasSamples && !circulationActive;

  if (isStopped) {
    return {
      label: '监测已停',
      copy: activeCopy(conditionText || cycleLabel || '当前井已手动停止监测，可保留历史点位并按需重新启动'),
    };
  }
  if (isRecovering || includesAny(condition, ['恢复', '续接']) || includesAny(cycleLabel, ['恢复'])) {
    return {
      label: '恢复监测',
      copy: activeCopy(conditionText || cycleLabel || '正在续接历史监测点，等待实时样本继续推送'),
    };
  }
  if (waitingForData || includesAny(condition, ['等待接入', '未接入', '待启动'])) {
    return {
      label: '等待接入',
      copy: activeCopy(conditionText || cycleLabel || '尚未收到实时样本，等待检测流接入'),
    };
  }
  if (backendLevel >= 4) {
    return {
      label: '溢流确认',
      copy: pumpStateText
        ? `已进入${BACKEND_LEVEL_META[backendLevel].label}，当前工况：${pumpStateText}`
        : '进入确认事件，需重点关注关井与处置节奏',
    };
  }
  if (backendLevel >= 2) {
    return {
      label: backendLevel >= 3 ? '疑似溢流' : '溢流预警',
      copy: activeCopy(conditionText || cycleLabel || '已有异常证据，保持实时跟踪'),
    };
  }
  if (trippingObservation) {
    return {
      label: '井筒扰动观察',
      copy: activeCopy(conditionText || cycleLabel || '当前处于起下钻/扰动观察阶段，重点关注井筒体积与返出响应'),
    };
  }
  if (stopPump) {
    return {
      label: '停泵监测',
      copy: activeCopy(cycleLabel || conditionText || '停泵后持续跟踪出口流量与总池体积变化'),
    };
  }
  if (restart) {
    return {
      label: '开泵恢复',
      copy: activeCopy(cycleLabel || conditionText || '开泵后重新建立水力与循环参照'),
    };
  }
  if (circulationStable) {
    return {
      label: '循环稳定',
      copy: activeCopy(cycleLabel || conditionText || '循环稳定，监测窗口持续刷新'),
    };
  }
  if (drillingStable) {
    return {
      label: '钻进稳定',
      copy: activeCopy(conditionText || cycleLabel || '钻进稳定，当前未见明显异常'),
    };
  }
  return {
    label: '井筒正常',
    copy: activeCopy(conditionText || cycleLabel || '井筒工况平稳，保持连续监测'),
  };
}

function activeCopy(text: string) {
  return text && text.length > 0 ? text : '井筒工况平稳，保持连续监测';
}

function ReadoutCard({
  metric,
  isLight,
}: {
  metric: WellMetric;
  isLight: boolean;
}) {
  return (
    <div className={`well-schematic-readout flex min-h-[58px] min-w-0 flex-col justify-between rounded-md border px-2.5 py-2 ${metricTone(isLight, metric.state)}`}>
      <div className="truncate text-[11px] leading-tight opacity-70">{metric.label}</div>
      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
        <span className="truncate text-[17px] font-semibold tabular-nums leading-none">{metric.value}</span>
        {metric.unit && metric.value !== '--' ? <span className="shrink-0 text-[10px] leading-none opacity-65">{metric.unit}</span> : null}
      </div>
    </div>
  );
}

function FlowPath({
  d,
  color,
  active,
  width = 3,
}: {
  d: string;
  color: string;
  active: boolean;
  width?: number;
}) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray="7 6" opacity={active ? 0.95 : 0.34}>
      {active && (
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-26"
          dur="1.05s"
          repeatCount="indefinite"
        />
      )}
    </path>
  );
}

function SvgMetricCallout({
  x,
  y,
  width,
  label,
  value,
  unit,
  stroke,
  fill,
  textColor,
  anchorD,
}: {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
  unit: string;
  stroke: string;
  fill: string;
  textColor: string;
  anchorD?: string;
}) {
  return (
    <g aria-label={`${label}${value}${unit}`}>
      {anchorD ? <path d={anchorD} fill="none" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" opacity="0.72" /> : null}
      <rect x={x} y={y} width={width} height="28" rx="4" fill={fill} stroke={stroke} strokeWidth="1" opacity="0.96" />
      <text x={x + 6} y={y + 11} fill={textColor} fontSize="7.8" fontWeight="700">{label}</text>
      <text x={x + 6} y={y + 22} fill={textColor} fontSize="10.6" fontWeight="800">
        {value}
        {unit && value !== '--' ? <tspan fontSize="7.4" fontWeight="700"> {unit}</tspan> : null}
      </text>
    </g>
  );
}

export function WellSchematic({
  mode = 'thumbnail',
  wellDepth = 4200,
  bitDepth = 3860,
  flowIn,
  flowOut,
  spm = 0,
  casingPressure,
  drillPipePressure,
  pitGain,
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
  metrics,
}: WellSchematicProps) {
  const isLight = surface === 'light';
  const visual = levelVisual(backendLevel);
  const influxActive = backendLevel >= 2;
  const circulationActive = flowIn > 0.5 || flowOut > 0.5;
  const panel = isLight ? '#ffffff' : '#08111f';
  const line = isLight ? '#334155' : '#cbd5e1';
  const muted = isLight ? '#64748b' : '#94a3b8';
  const cement = isLight ? '#cbd5e1' : '#475569';
  const bore = isLight ? '#f8fafc' : '#0f172a';
  const bopFill = isLight
    ? (backendLevel >= 2 ? visual.accent : '#e2e8f0')
    : (backendLevel >= 2 ? visual.accent : '#334155');
  const bopStroke = backendLevel >= 2 ? '#991b1b' : line;
  const readouts = metrics || [
    { label: '出口流量响应', value: formatFinite(returnResponse, 1), unit: '%', state: backendLevel >= 4 ? 'critical' as const : backendLevel >= 2 ? 'warning' as const : 'normal' as const },
    { label: '总池体积变化', value: formatFinite(pitGain, 2), unit: 'm3', state: backendLevel >= 4 ? 'critical' as const : backendLevel >= 2 ? 'warning' as const : 'normal' as const },
  ];
  const responseMetric = readouts.find((metric) => metric.label.includes('响应'));
  const sppMetric = readouts.find((metric) => metric.label.includes('立压'));
  const pitMetric = readouts.find((metric) => metric.label.includes('总池'));
  const gasMetric = readouts.find((metric) => metric.label.includes('全烃'));
  const topReadouts = compact || mode === 'detail' ? [] : readouts.slice(0, 2);
  const bottomReadouts = compact || mode === 'detail' ? [] : readouts.slice(2, 6);
  const flowInText = formatFiniteWithUnit(flowIn, 1, 'L/s');
  const flowOutText = formatFiniteWithUnit(flowOut, 1, 'L/s');
  const wellboreState = deriveWellboreState({
    backendLevel,
    pumpState,
    condition,
    cycleState: cycleInfo?.state,
    hasSamples,
    isRecovering,
    isStopped,
    flowIn,
    flowOut,
    spm,
  });
  const status = getWellboreStateMeta(wellboreState);
  const statusLabel = status.label;
  const isDetail = mode === 'detail';
  const conditionLabel = formatWellboreConditionLabel(condition, cycleInfo?.stateLabel || status.label);
  const statusCopy = isDetail ? status.description : (conditionLabel || status.description);
  const safeWellDepth = Math.max(wellDepth || 4200, 4200);
  const safeBitDepth = Math.min(Math.max(bitDepth || safeWellDepth - 5, 0), safeWellDepth);
  const openHoleLength = Math.max(0, Math.round(safeWellDepth - DEFAULT_CASING_SHOE_DEPTH));
  const currentFormation = safeWellDepth >= 5200 ? '目的层' : safeWellDepth >= 3200 ? '砂岩层' : '泥岩层';
  const depthToY = (depth: number) => 88 + (Math.min(Math.max(depth, 0), safeWellDepth) / safeWellDepth) * 326;
  const bitY = depthToY(safeBitDepth);
  const wellBottomY = depthToY(safeWellDepth);
  const casingShoeY = depthToY(DEFAULT_CASING_SHOE_DEPTH);
  const overlayTone = backendLevel >= 3 ? '#dc2626' : backendLevel === 2 ? '#d97706' : backendLevel === 1 ? '#f59e0b' : '#0f766e';
  const casingDisplayBottomY = isDetail ? Math.min(Math.max(casingShoeY, 150), wellBottomY - 20) : 304;
  const cementDisplayBottomY = isDetail ? Math.max(casingDisplayBottomY - 16, 112) : 288;
  const openHoleStartY = casingDisplayBottomY;
  const openHoleMiddleY = openHoleStartY + (wellBottomY - openHoleStartY) * 0.45;
  const openHoleBottomY = isDetail ? Math.min(wellBottomY + 16, 430) : 430;
  const drillStringBottomY = isDetail ? Math.max(bitY - 12, 112) : 373;
  const bitTopY = isDetail ? Math.max(bitY - 12, 112) : 373;
  const bitBodyBottomY = isDetail ? bitY : 385;
  const bitCrownY = isDetail ? Math.min(bitY + 10, 430) : 394;
  const flowBottomY = isDetail ? Math.max(bitY - 24, 120) : 360;
  const returnBottomY = isDetail ? Math.max(bitY - 18, openHoleStartY + 18) : 350;
  const returnTopY = isDetail ? Math.max(126, Math.min(casingDisplayBottomY - 18, 180)) : 126;
  const influxEntryY = isDetail ? Math.max(Math.min(bitY - 18, 405), openHoleStartY + 20) : 358;
  const influxLowerY = isDetail ? Math.min(influxEntryY + 20, 420) : 378;
  const influxTailY = Math.min(influxLowerY + 28, 428);
  const openHoleLabelY = Math.min(Math.max((openHoleStartY + wellBottomY) / 2, openHoleStartY + 20), wellBottomY - 10);
  const cementPath = 'M127 94 H233 V' + cementDisplayBottomY + ' H217 V111 H143 V' + cementDisplayBottomY + ' H127 Z';
  const openHolePath = 'M143 ' + openHoleStartY
    + ' C142 ' + (openHoleStartY + 18).toFixed(1) + ' 132 ' + (openHoleMiddleY - 16).toFixed(1) + ' 136 ' + openHoleMiddleY.toFixed(1)
    + ' C140 ' + (openHoleMiddleY + 28).toFixed(1) + ' 128 ' + (openHoleBottomY - 28).toFixed(1) + ' 130 ' + openHoleBottomY.toFixed(1)
    + ' H230 C232 ' + (openHoleBottomY - 28).toFixed(1) + ' 220 ' + (openHoleMiddleY + 28).toFixed(1) + ' 224 ' + openHoleMiddleY.toFixed(1)
    + ' C228 ' + (openHoleMiddleY - 16).toFixed(1) + ' 218 ' + (openHoleStartY + 18).toFixed(1) + ' 217 ' + openHoleStartY + ' Z';

  return (
    <div className={`well-schematic-card well-schematic-card-${mode} ${compact ? 'well-schematic-card-compact' : ''} flex h-full min-h-[260px] flex-col overflow-hidden rounded-md border p-2.5 lg:min-h-0 ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-700 bg-slate-950 text-slate-100'}`}>
      <div className="well-schematic-status-head mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="well-schematic-status-dot" style={{ backgroundColor: visual.accent }} />
            <h3 className="truncate text-base font-semibold">{isDetail ? '井筒状态剖面' : '井筒状态'}</h3>
          </div>
          <p className="well-schematic-status-copy mt-0.5 text-[11px] ops-muted">{statusCopy}</p>
        </div>
        <div className={`well-schematic-status-badge shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${visual.badge}`}>
          {statusLabel}
        </div>
      </div>

      {isDetail ? (
        <div className="well-schematic-summary-strip">
          <span>井深 <strong>{Math.round(safeWellDepth)} m</strong></span>
          <span>钻头 <strong>{Math.round(safeBitDepth)} m</strong></span>
          <span>套管鞋 <strong>{DEFAULT_CASING_SHOE_DEPTH} m</strong></span>
          <span>裸眼段 <strong>{openHoleLength} m</strong></span>
          <span>当前层位 <strong>{currentFormation}</strong></span>
          <span>工况 <strong>{conditionLabel}</strong></span>
        </div>
      ) : null}

      {topReadouts.length > 0 && (
        <div className="well-schematic-readouts mb-2 grid grid-cols-2 gap-2">
          {topReadouts.map((metric) => <ReadoutCard key={metric.label} metric={metric} isLight={isLight} />)}
        </div>
      )}

      <div className={`well-schematic-figure min-h-0 flex-1 overflow-hidden rounded-md border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-950'}`}>
        <svg
          viewBox={isDetail ? '-80 0 520 430' : '0 0 360 430'}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={`井筒状态示意图，报警等级 L${backendLevel}，当前状态 ${statusLabel}`}
        >
          <defs>
            <pattern id="formationDots" width="13" height="13" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="4" r="0.8" fill="#a16207" opacity="0.38" />
              <circle cx="10" cy="9" r="0.65" fill="#a16207" opacity="0.28" />
            </pattern>
            <pattern id="cementSpeckle" width="9" height="9" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="3" r="0.65" fill="#64748b" opacity="0.45" />
              <circle cx="7" cy="7" r="0.55" fill="#64748b" opacity="0.32" />
            </pattern>
            <pattern id="shaleLines" width="18" height="9" patternUnits="userSpaceOnUse">
              <path d="M0 5 Q4 2 9 5 T18 5" fill="none" stroke="#64748b" strokeWidth="0.55" opacity="0.4" />
            </pattern>
            <pattern id="surfaceHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(62)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#64748b" strokeWidth="0.45" opacity="0.36" />
            </pattern>
            <filter id="influxGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="returnArrow" markerWidth="7" markerHeight="7" refX="5.6" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0 0 L7 3.5 L0 7 Z" fill={visual.accent} />
            </marker>
            <marker id="flowArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0 0 L6 3 L0 6 Z" fill="#2563eb" />
            </marker>
          </defs>

          <rect x={isDetail ? -80 : 0} width={isDetail ? 520 : 360} height="430" fill={panel} />
          <rect x="8" y="8" width="344" height="414" rx="10" fill={isLight ? '#fffdf8' : '#08111f'} stroke={compact || isDetail ? 'none' : line} strokeWidth="1.2" opacity="0.96" />
          <rect y="88" width="360" height="47" fill={isLight ? '#f3eee4' : '#29251d'} />
          <rect y="88" width="360" height="47" fill="url(#formationDots)" />
          <rect y="135" width="360" height="70" fill={isLight ? '#ebe4d5' : '#30291e'} />
          <rect y="135" width="360" height="70" fill="url(#formationDots)" />
          <rect y="205" width="360" height="70" fill={isLight ? '#e7edf1' : '#17212d'} />
          <rect y="205" width="360" height="70" fill="url(#shaleLines)" />
          <rect y="275" width="360" height="93" fill={isLight ? '#eee5d5' : '#29251d'} />
          <rect y="275" width="360" height="93" fill="url(#formationDots)" />
          <rect y="368" width="360" height="47" fill={influxActive ? visual.soft : isLight ? '#dcfce7' : '#16352b'} opacity="0.9" />
          <rect y="368" width="360" height="47" fill="url(#formationDots)" />
          <rect y="415" width="360" height="15" fill={isLight ? '#d8dee5' : '#202a36'} />
          <line x1="0" y1="88" x2="360" y2="88" stroke={line} strokeWidth="2" />
          {isDetail ? (
            <>
              <rect x="40" y="83" width="280" height="5" fill="url(#surfaceHatch)" opacity="0.78" />
              {[1000, 2000, 3000, 4000].map((depth) => {
                const y = depthToY(depth);
                return <line key={'guide-' + depth} x1="56" y1={y} x2="320" y2={y} stroke="#94a3b8" strokeWidth="0.85" strokeDasharray="4 4" opacity="0.72" />;
              })}
            </>
          ) : null}

          {isDetail ? (
            <g fill={muted} fontSize="8.5" fontFamily="sans-serif" aria-label="深度刻度">
              <text x="-64" y="77" fill={line} fontSize="9" fontWeight="700">深度 (m)</text>
              <line x1="-58" y1="88" x2="-58" y2="414" stroke={line} strokeWidth="1" />
              {[500, 1500, 2500, 3500, 5000].map((depth) => {
                const y = depthToY(depth);
                return <line key={'minor-' + depth} x1="-61" y1={y} x2="-55" y2={y} stroke={muted} strokeWidth="0.75" opacity="0.72" />;
              })}
              {[0, 1000, 2000, 3000, 4000, safeWellDepth].map((depth, index) => {
                const y = Math.min(414, depthToY(depth));
                return <g key={`${depth}-${index}`}><line x1="-63" y1={y} x2="-53" y2={y} stroke={line} strokeWidth="1" /><text x="-48" y={y + 3}>{Math.round(depth)}</text></g>;
              })}
              <g fontSize="7.8" textAnchor="middle">
                <rect x="-18" y="88" width="74" height="47" fill="#f3eee4" stroke="#cbd5e1" /><text x="19" y="114">第四系</text>
                <rect x="-18" y="135" width="74" height="70" fill="#ebe4d5" stroke="#cbd5e1" /><text x="19" y="172">上部砂岩层</text>
                <rect x="-18" y="205" width="74" height="70" fill="#e7edf1" stroke="#cbd5e1" /><text x="19" y="242">泥岩层</text>
                <rect x="-18" y="275" width="74" height="93" fill="#eee5d5" stroke="#cbd5e1" /><text x="19" y="324">砂岩层</text>
                <rect x="-18" y="368" width="74" height="47" fill="#dcfce7" stroke="#86b89a" /><text x="19" y="394" fill="#047857" fontWeight="700">目的层</text>
                <rect x="-18" y="415" width="74" height="15" fill="#d8dee5" stroke="#cbd5e1" /><text x="19" y="426">基岩层</text>
              </g>
              <g fill={line} fontSize="8.5">
                <path d="M215 88 H355" fill="none" stroke={muted} /><circle cx="355" cy="88" r="1.5" fill={line} /><text x="365" y="91">地面</text>
                <path d="M212 76 H355" fill="none" stroke={muted} /><circle cx="355" cy="76" r="1.5" fill={line} /><text x="365" y="79">井口 / 转盘</text>
                <path d="M217 62 H355" fill="none" stroke={muted} /><circle cx="355" cy="62" r="1.5" fill={line} /><text x="365" y="65">BOP / 防喷器</text>
                <path d={'M217 ' + casingShoeY + ' H355'} fill="none" stroke={muted} /><circle cx="355" cy={casingShoeY} r="1.5" fill={line} /><text x="365" y={casingShoeY + 3}>套管鞋 {DEFAULT_CASING_SHOE_DEPTH} m</text>
                <path d={'M224 ' + openHoleLabelY + ' H355'} fill="none" stroke={muted} /><circle cx="355" cy={openHoleLabelY} r="1.5" fill={line} /><text x="365" y={openHoleLabelY + 3}>裸眼段 {openHoleLength} m</text>
                <path d={'M196 ' + bitY + ' H355'} fill="none" stroke={muted} /><circle cx="355" cy={bitY} r="1.5" fill={line} /><text x="365" y={bitY + 3}>钻头位置 {Math.round(safeBitDepth)} m</text>
                <path d={'M230 ' + wellBottomY + ' H355'} fill="none" stroke={muted} /><circle cx="355" cy={wellBottomY} r="1.5" fill={line} /><text x="365" y={wellBottomY + 3}>井深 {Math.round(safeWellDepth)} m</text>
              </g>
            </g>
          ) : null}

          <g aria-label="井口与防喷器组">
            <rect x="143" y="72" width="74" height="16" fill={bore} stroke={line} strokeWidth="2" />
            <rect x="151" y="54" width="58" height="18" fill={bopFill} stroke={bopStroke} strokeWidth="2" opacity={backendLevel >= 2 ? 0.94 : 1} />
            <rect x="158" y="37" width="44" height="17" fill={bore} stroke={line} strokeWidth="2" />
            <rect x="168" y="22" width="24" height="15" fill={bore} stroke={line} strokeWidth="2" />
            <line x1="180" y1="10" x2="180" y2="22" stroke={line} strokeWidth="3" />
            <ellipse cx="180" cy="8" rx="18" ry="4" fill="none" stroke={line} strokeWidth="2" />
            <line x1="143" y1="62" x2="116" y2="62" stroke={line} strokeWidth="3" />
            <line x1="217" y1="62" x2="244" y2="62" stroke={line} strokeWidth="3" />
            <circle cx="112" cy="62" r="6" fill={bore} stroke={line} strokeWidth="2" />
            <circle cx="248" cy="62" r="6" fill={bore} stroke={line} strokeWidth="2" />
            {isDetail ? (
              <>
                <rect x="151" y="56" width="58" height="4" fill={backendLevel >= 2 ? '#fecaca' : '#f8fafc'} opacity="0.45" />
                <rect x="151" y="66" width="58" height="4" fill={backendLevel >= 2 ? '#7f1d1d' : '#94a3b8'} opacity="0.22" />
                {[144, 216].map((x) => (
                  <g key={'bop-bolts-' + x} fill={line}>
                    <circle cx={x} cy="57" r="1.8" />
                    <circle cx={x} cy="69" r="1.8" />
                  </g>
                ))}
              </>
            ) : null}
          </g>

          <path d={cementPath} fill={cement} opacity="0.72" />
          <path d={cementPath} fill="url(#cementSpeckle)" />
          <rect x="143" y="94" width="74" height={Math.max(24, casingDisplayBottomY - 94)} fill={bore} stroke={line} strokeWidth="2" />
          <path d={openHolePath} fill={bore} stroke={line} strokeWidth="2" />

          <rect x="173" y="88" width="14" height={Math.max(24, drillStringBottomY - 88)} fill={isLight ? '#e2e8f0' : '#334155'} stroke={line} strokeWidth="1.8" />
          <path d={'M165 ' + bitTopY + ' H195 L188 ' + bitBodyBottomY + ' H172 Z'} fill={isLight ? '#64748b' : '#cbd5e1'} stroke={line} strokeWidth="1.5" />
          <path d={'M164 ' + bitBodyBottomY + ' L172 ' + bitCrownY + ' L180 ' + bitBodyBottomY + ' L188 ' + bitCrownY + ' L196 ' + bitBodyBottomY} fill="none" stroke={line} strokeWidth="2.2" />

          <FlowPath d={'M180 103 V' + flowBottomY} color="#2563eb" active={circulationActive} />
          <FlowPath d={'M157 ' + returnBottomY + ' C152 ' + ((returnBottomY + returnTopY) / 2).toFixed(1) + ' 154 250 157 ' + returnTopY} color={influxActive ? visual.accent : '#0d9488'} active={circulationActive || influxActive} />
          <FlowPath d={'M203 ' + returnBottomY + ' C208 ' + ((returnBottomY + returnTopY) / 2).toFixed(1) + ' 206 250 203 ' + returnTopY} color={influxActive ? visual.accent : '#0d9488'} active={circulationActive || influxActive} />

          {isDetail ? (
            <g aria-label="环空回返路径" opacity={influxActive ? 0.96 : 0.48}>
              <path d={'M126 ' + (returnBottomY + 30) + ' C109 ' + ((returnBottomY + returnTopY) / 2).toFixed(1) + ' 108 212 129 132'} fill="none" stroke={influxActive ? visual.accent : '#0d9488'} strokeWidth="2.1" strokeLinecap="round" strokeDasharray="6 5" markerEnd={influxActive ? 'url(#returnArrow)' : undefined} />
              <path d={'M234 ' + (returnBottomY + 30) + ' C251 ' + ((returnBottomY + returnTopY) / 2).toFixed(1) + ' 252 212 231 132'} fill="none" stroke={influxActive ? visual.accent : '#0d9488'} strokeWidth="2.1" strokeLinecap="round" strokeDasharray="6 5" markerEnd={influxActive ? 'url(#returnArrow)' : undefined} />
              {influxActive ? (
                <>
                  <path d={'M126 ' + (returnBottomY + 12) + ' V' + Math.max(openHoleStartY + 12, returnBottomY - 18)} fill="none" stroke={visual.accent} strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#returnArrow)" />
                  <path d={'M234 ' + (returnBottomY + 12) + ' V' + Math.max(openHoleStartY + 12, returnBottomY - 18)} fill="none" stroke={visual.accent} strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#returnArrow)" />
                </>
              ) : null}
            </g>
          ) : null}

          {influxActive && (
            <g opacity={1}>
              <path d={'M82 ' + (influxLowerY + 4) + ' C104 ' + influxLowerY + ' 116 ' + (influxEntryY + 10) + ' 140 ' + influxEntryY} fill="none" stroke={visual.accent} strokeWidth="3.6" strokeLinecap="round" />
              <path d={'M278 ' + (influxLowerY + 4) + ' C256 ' + influxLowerY + ' 244 ' + (influxEntryY + 10) + ' 220 ' + influxEntryY} fill="none" stroke={visual.accent} strokeWidth="3.6" strokeLinecap="round" />
              <path d={'M94 ' + influxTailY + ' C114 ' + (influxLowerY + 23) + ' 125 ' + (influxLowerY + 12) + ' 144 ' + (influxEntryY + 20)} fill="none" stroke={visual.accent} strokeWidth="3.2" strokeLinecap="round" />
              <path d={'M266 ' + influxTailY + ' C246 ' + (influxLowerY + 23) + ' 235 ' + (influxLowerY + 12) + ' 216 ' + (influxEntryY + 20)} fill="none" stroke={visual.accent} strokeWidth="3.2" strokeLinecap="round" />
            </g>
          )}

          <path d="M100 118 H143" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          <path d="M217 118 H266" stroke={backendLevel >= 4 ? '#dc2626' : influxActive ? visual.accent : '#0d9488'} strokeWidth="3" strokeLinecap="round" />
          <circle cx="94" cy="118" r="7" fill={panel} stroke="#2563eb" strokeWidth="2" />
          <circle cx="272" cy="118" r="7" fill={panel} stroke={backendLevel >= 4 ? '#dc2626' : influxActive ? visual.accent : '#0d9488'} strokeWidth="2" />

          <g fontFamily="sans-serif" fontSize={compact ? 9.5 : 10.5} fill={muted}>
            {compact ? (
              <>
                <g aria-label="入口流量读数">
                  <rect x="18" y="106" width="91" height="47" rx="7" fill={isLight ? '#eff6ff' : '#0b2447'} stroke="#2563eb" strokeWidth="1.2" opacity="0.96" />
                  <text x="28" y="123" fill="#2563eb" fontSize="10" fontWeight="700">入口流量</text>
                  <text x="28" y="142" fill="#2563eb" fontSize="13">{flowInText}</text>
                </g>
                <g aria-label="出口流量读数">
                  <rect x="251" y="106" width="91" height="47" rx="7" fill={isLight ? '#ecfdf5' : '#082f2a'} stroke={influxActive ? visual.accent : '#0d9488'} strokeWidth="1.2" opacity="0.96" />
                  <text x="261" y="123" fill={influxActive ? visual.accent : '#0d9488'} fontSize="10" fontWeight="700">出口流量</text>
                  <text x="261" y="142" fill={influxActive ? visual.accent : '#0d9488'} fontSize="13">{flowOutText}</text>
                </g>
              </>
            ) : null}

            {compact ? (
              <>
                <SvgMetricCallout
                  x={18}
                  y={164}
                  width={72}
                  label="立压"
                  value={sppMetric?.value ?? formatFinite(drillPipePressure, 2)}
                  unit={sppMetric?.unit ?? 'MPa'}
                  stroke={activeSignals.includes('standpipe_pressure') ? visual.accent : '#2563eb'}
                  fill={isLight ? '#eff6ff' : '#0b2447'}
                  textColor={activeSignals.includes('standpipe_pressure') ? visual.accent : '#2563eb'}
                  anchorD="M90 178 C116 178 138 178 164 178"
                />
                <SvgMetricCallout
                  x={18}
                  y={24}
                  width={76}
                  label="池体积"
                  value={pitMetric?.value ?? formatFinite(pitGain, 2)}
                  unit={pitMetric?.unit ?? 'm3'}
                  stroke={pitMetric?.state === 'critical' ? '#dc2626' : pitMetric?.state === 'warning' ? '#d97706' : '#0d9488'}
                  fill={pitMetric?.state === 'critical' ? '#fef2f2' : pitMetric?.state === 'warning' ? '#fffbeb' : '#ecfdf5'}
                  textColor={pitMetric?.state === 'critical' ? '#b91c1c' : pitMetric?.state === 'warning' ? '#b45309' : '#0f766e'}
                  anchorD="M94 38 C118 38 134 50 148 68"
                />
                <SvgMetricCallout
                  x={256}
                  y={164}
                  width={78}
                  label="返出响应"
                  value={responseMetric?.value ?? formatFinite(returnResponse, 1)}
                  unit={responseMetric?.unit ?? '%'}
                  stroke={responseMetric?.state === 'critical' ? '#dc2626' : responseMetric?.state === 'warning' ? '#d97706' : '#0d9488'}
                  fill={responseMetric?.state === 'critical' ? '#fef2f2' : responseMetric?.state === 'warning' ? '#fffbeb' : '#ecfdf5'}
                  textColor={responseMetric?.state === 'critical' ? '#b91c1c' : responseMetric?.state === 'warning' ? '#b45309' : '#0f766e'}
                  anchorD="M256 178 H224"
                />
                <SvgMetricCallout
                  x={260}
                  y={210}
                  width={66}
                  label="全烃"
                  value={gasMetric?.value ?? formatFinite(totalGas, 2)}
                  unit={gasMetric?.unit ?? '%'}
                  stroke={gasMetric?.state === 'critical' ? '#dc2626' : gasMetric?.state === 'warning' ? '#d97706' : '#16a34a'}
                  fill={gasMetric?.state === 'critical' ? '#fef2f2' : gasMetric?.state === 'warning' ? '#fffbeb' : '#f0fdf4'}
                  textColor={gasMetric?.state === 'critical' ? '#b91c1c' : gasMetric?.state === 'warning' ? '#b45309' : '#15803d'}
                  anchorD="M260 224 H224"
                />
              </>
            ) : null}

            {!compact && !isDetail && (
              <>
                <text x="236" y="40">防喷器</text>
                <path d="M232 43 H209" fill="none" stroke={muted} strokeWidth="1" />
                <text x="258" y="183">套管</text>
                <path d="M256 180 H219" fill="none" stroke={muted} strokeWidth="1" />
                <text x="248" y="350">地层</text>
                <path d="M248 347 H226" fill="none" stroke={muted} strokeWidth="1" />
              </>
            )}
            {influxActive && (
              <>
                {isDetail ? (
                  <>
                    <circle cx="232" cy={influxEntryY} r="3.3" fill={overlayTone} />
                    <path d={'M235 ' + influxEntryY + ' H300'} fill="none" stroke={overlayTone} strokeWidth="1.2" />
                    <text x="304" y={influxEntryY + 3} fill={overlayTone} fontWeight="700">异常侵入点</text>
                  </>
                ) : (
                  <>
                    <text x={compact ? 24 : 12} y={compact ? 398 : 410} fill={visual.accent}>地层流体侵入</text>
                    <path d={compact ? 'M98 397 H126' : 'M92 411 H126'} fill="none" stroke={visual.accent} strokeWidth="1" />
                  </>
                )}
              </>
            )}
            {!compact && !isDetail && (
              <>
                <text x="12" y="145" fill={muted}>立压 {formatFiniteWithUnit(drillPipePressure, 2, 'MPa')}</text>
                <text x="234" y="145" fill={muted}>套压 {formatFiniteWithUnit(casingPressure, 2, 'MPa')}</text>
                <text x="12" y="165" fill={activeSignals.includes('standpipe_pressure') ? visual.accent : muted}>
                  {cycleInfo?.shortLabel || '活动信号'} {cycleInfo?.stateLabel ? `· ${cycleInfo.stateLabel}` : activeSignals.length}
                </text>
              </>
            )}
          </g>
        </svg>
      </div>

      {isDetail ? (
        <div className="well-schematic-legend">
          <span><i className="legend-return" />环空回返路径</span>
          <span><i className="legend-influx" />异常侵入点</span>
          <span>深度单位 m · 压力单位 MPa</span>
        </div>
      ) : null}

      {bottomReadouts.length > 0 && (
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">
          {bottomReadouts.map((metric) => <ReadoutCard key={metric.label} metric={metric} isLight={isLight} />)}
        </div>
      )}
    </div>
  );
}
