import type { BackendLevel } from '../context/WellControlContext';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';

interface WellSchematicProps {
  flowIn: number;
  flowOut: number;
  casingPressure: number;
  drillPipePressure: number;
  pitGain: number;
  returnResponse: number;
  backendLevel: BackendLevel;
  activeSignals?: string[];
  compact?: boolean;
  surface?: 'dark' | 'light';
  metrics?: Array<{
    label: string;
    value: string;
    unit: string;
    state?: 'normal' | 'warning' | 'critical';
  }>;
}

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

function ReadoutCard({
  metric,
  isLight,
}: {
  metric: NonNullable<WellSchematicProps['metrics']>[number];
  isLight: boolean;
}) {
  return (
    <div className={`flex min-h-[40px] min-w-0 flex-col justify-between rounded-md border px-2 py-1.5 ${metricTone(isLight, metric.state)}`}>
      <div className="truncate text-[10px] leading-tight opacity-70">{metric.label}</div>
      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
        <span className="truncate text-[14px] font-semibold tabular-nums leading-none">{metric.value}</span>
        {metric.unit ? <span className="shrink-0 text-[9px] leading-none opacity-65">{metric.unit}</span> : null}
      </div>
    </div>
  );
}

function FlowPath({
  d,
  color,
  active,
  width = 3,
  reverse = false,
}: {
  d: string;
  color: string;
  active: boolean;
  width?: number;
  reverse?: boolean;
}) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray="7 6" opacity={active ? 0.95 : 0.34}>
      {active && (
        <animate
          attributeName="stroke-dashoffset"
          from={reverse ? '0' : '26'}
          to={reverse ? '26' : '0'}
          dur={reverse ? '0.95s' : '1.15s'}
          repeatCount="indefinite"
        />
      )}
    </path>
  );
}

export function WellSchematic({
  flowIn,
  flowOut,
  casingPressure,
  drillPipePressure,
  pitGain,
  returnResponse,
  backendLevel,
  activeSignals = [],
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
  const readouts = metrics || [
    { label: '出口流量响应', value: returnResponse.toFixed(1), unit: '%', state: backendLevel >= 4 ? 'critical' as const : backendLevel >= 2 ? 'warning' as const : 'normal' as const },
    { label: '总池体积变化', value: pitGain.toFixed(2), unit: 'm3', state: backendLevel >= 4 ? 'critical' as const : backendLevel >= 2 ? 'warning' as const : 'normal' as const },
  ];
  const topReadouts = readouts.slice(0, 2);
  const bottomReadouts = compact ? [] : readouts.slice(2, 6);

  return (
    <div className={`well-schematic-card flex h-full min-h-[260px] flex-col overflow-hidden rounded-md border p-2.5 lg:min-h-0 ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-700 bg-slate-950 text-slate-100'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">井筒溢流机理</h3>
          {!compact && <p className="mt-0.5 truncate text-[10px] ops-muted">钻柱循环 · 环空出口流 · 地层流体侵入</p>}
        </div>
        <div className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${visual.badge}`}>
          L{backendLevel} {BACKEND_LEVEL_META[backendLevel].shortLabel}
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {topReadouts.map((metric) => <ReadoutCard key={metric.label} metric={metric} isLight={isLight} />)}
      </div>

      <div className={`well-schematic-figure min-h-0 flex-1 overflow-hidden rounded-md border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-950'}`}>
        <svg
          viewBox="0 0 360 430"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={`井筒溢流机理示意图，报警等级 L${backendLevel}`}
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
            <filter id="influxGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="360" height="430" fill={panel} />
          <rect y="88" width="360" height="72" fill={isLight ? '#f1eadc' : '#29251d'} />
          <rect y="88" width="360" height="72" fill="url(#formationDots)" />
          <rect y="160" width="360" height="82" fill={isLight ? '#e7edf1' : '#17212d'} />
          <rect y="160" width="360" height="82" fill="url(#shaleLines)" />
          <rect y="242" width="360" height="88" fill={isLight ? '#eee5d5' : '#29251d'} />
          <rect y="242" width="360" height="88" fill="url(#formationDots)" />
          <rect y="330" width="360" height="100" fill={influxActive ? visual.soft : isLight ? '#f7e6a9' : '#342d18'} opacity={isLight ? 1 : 0.82} />
          <rect y="330" width="360" height="100" fill="url(#formationDots)" />
          <line x1="0" y1="88" x2="360" y2="88" stroke={line} strokeWidth="2" />

          <g aria-label="井口与防喷器组">
            <rect x="143" y="72" width="74" height="16" fill={bore} stroke={line} strokeWidth="2" />
            <rect x="151" y="54" width="58" height="18" fill={bore} stroke={line} strokeWidth="2" />
            <rect x="158" y="37" width="44" height="17" fill={bore} stroke={line} strokeWidth="2" />
            <rect x="168" y="22" width="24" height="15" fill={bore} stroke={line} strokeWidth="2" />
            <line x1="180" y1="10" x2="180" y2="22" stroke={line} strokeWidth="3" />
            <ellipse cx="180" cy="8" rx="18" ry="4" fill="none" stroke={line} strokeWidth="2" />
            <line x1="143" y1="62" x2="116" y2="62" stroke={line} strokeWidth="3" />
            <line x1="217" y1="62" x2="244" y2="62" stroke={line} strokeWidth="3" />
            <circle cx="112" cy="62" r="6" fill={bore} stroke={line} strokeWidth="2" />
            <circle cx="248" cy="62" r="6" fill={bore} stroke={line} strokeWidth="2" />
          </g>

          <path d="M127 94 H233 V288 H217 V111 H143 V288 H127 Z" fill={cement} opacity="0.72" />
          <path d="M127 94 H233 V288 H217 V111 H143 V288 H127 Z" fill="url(#cementSpeckle)" />
          <rect x="143" y="94" width="74" height="210" fill={bore} stroke={line} strokeWidth="2" />
          <path d="M143 304 C142 324 132 341 136 361 C140 383 128 403 130 430 H230 C232 403 220 383 224 361 C228 341 218 324 217 304 Z" fill={bore} stroke={line} strokeWidth="2" />

          <rect x="173" y="88" width="14" height="285" fill={isLight ? '#e2e8f0' : '#334155'} stroke={line} strokeWidth="1.8" />
          <path d="M165 373 H195 L188 385 H172 Z" fill={isLight ? '#64748b' : '#cbd5e1'} stroke={line} strokeWidth="1.5" />
          <path d="M164 382 L172 394 L180 385 L188 394 L196 382" fill="none" stroke={line} strokeWidth="2.2" />

          <FlowPath d="M180 103 V360" color="#2563eb" active={circulationActive} />
          <FlowPath d="M157 350 C151 302 155 246 156 126" color={influxActive ? visual.accent : '#0d9488'} active={circulationActive || influxActive} />
          <FlowPath d="M203 350 C209 302 205 246 204 126" color={influxActive ? visual.accent : '#0d9488'} active={circulationActive || influxActive} />

          {influxActive && (
            <g opacity={1} filter="url(#influxGlow)">
              <path d="M78 374 C101 372 112 362 139 358" fill="none" stroke={visual.accent} strokeWidth="3.6" strokeLinecap="round" />
              <path d="M282 374 C259 372 248 362 221 358" fill="none" stroke={visual.accent} strokeWidth="3.6" strokeLinecap="round" />
              <path d="M92 398 C112 393 123 382 143 378" fill="none" stroke={visual.accent} strokeWidth="3.2" strokeLinecap="round" />
              <path d="M268 398 C248 393 237 382 217 378" fill="none" stroke={visual.accent} strokeWidth="3.2" strokeLinecap="round" />
              <circle r="3.5" fill={visual.accent}><animateMotion dur="1.4s" repeatCount="indefinite" path="M78 374 C101 372 112 362 139 358" /></circle>
              <circle r="3.5" fill={visual.accent}><animateMotion dur="1.55s" repeatCount="indefinite" path="M282 374 C259 372 248 362 221 358" /></circle>
            </g>
          )}

          <path d="M100 118 H143" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          <path d="M217 118 H266" stroke={backendLevel >= 4 ? '#dc2626' : influxActive ? visual.accent : '#0d9488'} strokeWidth="3" strokeLinecap="round" />
          <circle cx="94" cy="118" r="7" fill={panel} stroke="#2563eb" strokeWidth="2" />
          <circle cx="272" cy="118" r="7" fill={panel} stroke={backendLevel >= 4 ? '#dc2626' : influxActive ? visual.accent : '#0d9488'} strokeWidth="2" />

          <g fontFamily="sans-serif" fontSize={compact ? 9.5 : 10.5} fill={muted}>
            <text x="12" y="82">地表</text>
            <path d="M35 79 H90 L100 88" fill="none" stroke={muted} strokeWidth="1" />
            <text x="9" y="121" fill="#2563eb" fontSize={compact ? 11 : 12} fontWeight="700">入口 {flowIn.toFixed(1)}</text>
            <text x="276" y="121" fill={influxActive ? visual.accent : '#0d9488'} fontSize={compact ? 11 : 12} fontWeight="700">出口 {flowOut.toFixed(1)}</text>
            <text x="251" y="43">防喷器组</text>
            <path d="M247 46 H218" fill="none" stroke={muted} strokeWidth="1" />
            <text x="254" y="179">套管</text>
            <path d="M247 176 H217" fill="none" stroke={muted} strokeWidth="1" />
            <text x="254" y="214">水泥环</text>
            <path d="M247 211 H226" fill="none" stroke={muted} strokeWidth="1" />
            <text x="12" y="246">钻柱</text>
            <path d="M41 243 H173" fill="none" stroke={muted} strokeWidth="1" />
            <text x="244" y="278" fill={influxActive ? visual.accent : muted}>环空出口流</text>
            <path d="M238 275 H207" fill="none" stroke={influxActive ? visual.accent : muted} strokeWidth="1" />
            <text x="251" y="350">高压地层</text>
            <path d="M246 347 H225" fill="none" stroke={muted} strokeWidth="1" />
            {influxActive && (
              <>
                <text x="12" y="414" fill={visual.accent}>地层流体侵入</text>
                <path d="M92 411 H126" fill="none" stroke={visual.accent} strokeWidth="1" />
              </>
            )}
            {!compact && (
              <>
                <text x="12" y="145" fill={muted}>立压 {drillPipePressure.toFixed(2)} MPa</text>
                <text x="235" y="145" fill={muted}>套压 {casingPressure.toFixed(2)} MPa</text>
                <text x="12" y="165" fill={activeSignals.includes('standpipe_pressure') ? visual.accent : muted}>活动信号 {activeSignals.length}</text>
              </>
            )}
          </g>
        </svg>
      </div>

      {bottomReadouts.length > 0 && (
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">
          {bottomReadouts.map((metric) => <ReadoutCard key={metric.label} metric={metric} isLight={isLight} />)}
        </div>
      )}
    </div>
  );
}
