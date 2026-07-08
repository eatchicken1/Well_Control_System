import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from './wellboreState';

export type WellboreTone = 'normal' | 'watch' | 'warning' | 'critical';

export interface WellboreSimulationInput {
  backendLevel: BackendLevel;
  flowIn: number;
  flowOut: number;
  returnResponse: number;
  pitGain: number;
  pitVolume: number;
  drillPipePressure: number;
  casingPressure: number;
  totalGas: number;
  spm?: number;
  wellDepth?: number;
  bitDepth?: number;
  formation?: string;
  activeSignals?: string[];
  pumpState?: string;
  condition?: string;
  cycleInfo?: CycleInfo;
  hasSamples?: boolean;
  isRecovering?: boolean;
  isStopped?: boolean;
}

export interface WellboreDepthMarker {
  key: string;
  label: string;
  depth: number;
  tone?: WellboreTone;
}

export interface WellboreFormationBand {
  key: string;
  label: string;
  from: number;
  to: number;
  fill: string;
  accent: string;
}

export interface WellboreZoneBand {
  key: string;
  from: number;
  to: number;
  label: string;
  tone: WellboreTone;
  opacity?: number;
  lane?: 'annulus' | 'formation' | 'bit';
}

export interface WellboreFlowState {
  circulationActive: boolean;
  returnActive: boolean;
  showNormalPath: boolean;
  showWatchPath: boolean;
  showKickPath: boolean;
  showKickPoint: boolean;
  inflowTone: WellboreTone;
  annulusTone: WellboreTone;
}

export interface WellboreCasingShoe {
  key: string;
  label: string;
  depth: number;
}

export interface WellboreTubularString {
  key: string;
  label: string;
  topDepth: number;
  bottomDepth: number;
  outerWidth: number;
  innerWidth: number;
  fill: string;
  stroke: string;
  cementOuterWidth: number;
}

export interface WellboreSimulationModel {
  wellDepth: number;
  bitDepth: number;
  casingShoeDepth: number;
  casingShoes: WellboreCasingShoe[];
  tubularStrings: WellboreTubularString[];
  openHoleStartDepth: number;
  openHoleLength: number;
  currentFormation: string;
  conditionLabel: string;
  statusLabel: string;
  statusDescription: string;
  tone: WellboreTone;
  kickPointDepth: number;
  observationDepth: number;
  flowState: WellboreFlowState;
  depthMarkers: WellboreDepthMarker[];
  formationBands: WellboreFormationBand[];
  evidenceBands: WellboreZoneBand[];
  evidenceNotes: string[];
}

export const DEFAULT_CASING_SHOE_DEPTH = 3200;

const toneOrder: Record<WellboreTone, number> = {
  normal: 0,
  watch: 1,
  warning: 2,
  critical: 3,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampRange(target: number, min: number, max: number) {
  if (max <= min) return min;
  return clamp(target, min, max);
}

function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function formatSigned(value: number, digits: number, unit: string) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)} ${unit}`;
}

function formatValue(value: number, digits: number, unit: string) {
  return `${value.toFixed(digits)} ${unit}`;
}

function hasSignal(activeSignals: string[] | undefined, tokens: string[]) {
  return tokens.some((token) => activeSignals?.includes(token));
}

function maxTone(...tones: WellboreTone[]) {
  return tones.reduce((highest, tone) => (toneOrder[tone] > toneOrder[highest] ? tone : highest), 'normal' as WellboreTone);
}

function levelTone(level: BackendLevel): WellboreTone {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  if (level === 1) return 'watch';
  return 'normal';
}

function inferFormationName(explicit: string | undefined, wellDepth: number) {
  if (explicit?.trim()) return explicit.trim();
  if (wellDepth >= 5200) return '\u6df1\u5c42\u50a8\u96c6\u5c42';
  if (wellDepth >= 4200) return '\u76ee\u7684\u5c42';
  if (wellDepth >= 3200) return '\u7802\u5ca9\u50a8\u5c42';
  return '\u6ce5\u5ca9\u6bb5';
}

function buildFormationBands(wellDepth: number): WellboreFormationBand[] {
  const anchors = [0, 900, 2000, 3200, Math.max(wellDepth - 500, 3400), wellDepth];
  return [
    { key: 'surface', label: '\u7b2c\u56db\u7cfb', from: anchors[0], to: Math.min(anchors[1], wellDepth), fill: '#f3eee4', accent: '#9a7b4f' },
    { key: 'upper-sand', label: '\u4e0a\u90e8\u7802\u5ca9\u5c42', from: Math.min(anchors[1], wellDepth), to: Math.min(anchors[2], wellDepth), fill: '#ebe4d5', accent: '#986c32' },
    { key: 'mudstone', label: '\u6ce5\u5ca9\u5c42', from: Math.min(anchors[2], wellDepth), to: Math.min(anchors[3], wellDepth), fill: '#e7edf1', accent: '#64748b' },
    { key: 'reservoir', label: '\u7802\u5ca9\u5c42', from: Math.min(anchors[3], wellDepth), to: Math.min(anchors[4], wellDepth), fill: '#eee5d5', accent: '#8a5f2a' },
    { key: 'target', label: '\u76ee\u7684\u5c42', from: Math.min(anchors[4], wellDepth), to: wellDepth, fill: '#dcfce7', accent: '#047857' },
  ].filter((item) => item.to > item.from + 1);
}

function buildTubularStrings(wellDepth: number, deepestShoeDepth: number) {
  const conductorDepth = clampRange(wellDepth * 0.14, 260, Math.min(680, deepestShoeDepth - 920));
  const surfaceDepth = clampRange(
    Math.min(wellDepth * 0.34, deepestShoeDepth - 360),
    conductorDepth + 140,
    deepestShoeDepth - 220,
  );

  const tubularStrings: WellboreTubularString[] = [
    {
      key: 'conductor',
      label: '\u5bfc\u7ba1',
      topDepth: 0,
      bottomDepth: conductorDepth,
      outerWidth: 164,
      innerWidth: 132,
      fill: '#94a3b8',
      stroke: '#475569',
      cementOuterWidth: 182,
    },
    {
      key: 'surface',
      label: '\u8868\u5c42\u5957\u7ba1',
      topDepth: 0,
      bottomDepth: surfaceDepth,
      outerWidth: 128,
      innerWidth: 96,
      fill: '#64748b',
      stroke: '#334155',
      cementOuterWidth: 146,
    },
    {
      key: 'intermediate',
      label: '\u6280\u672f\u5957\u7ba1',
      topDepth: 0,
      bottomDepth: deepestShoeDepth,
      outerWidth: 86,
      innerWidth: 58,
      fill: '#475569',
      stroke: '#1f2937',
      cementOuterWidth: 104,
    },
  ];

  const casingShoes: WellboreCasingShoe[] = tubularStrings.map((string) => ({
    key: `${string.key}-shoe`,
    label: `${string.label}\u978b`,
    depth: string.bottomDepth,
  }));

  return { tubularStrings, casingShoes };
}

export function buildWellboreSimulationModel(input: WellboreSimulationInput): WellboreSimulationModel {
  const wellDepth = Math.max(finite(input.wellDepth, 4200), 2600);
  const bitDepth = clamp(finite(input.bitDepth, wellDepth - 80), 300, wellDepth);
  const casingShoeDepth = clamp(Math.min(DEFAULT_CASING_SHOE_DEPTH, wellDepth - 140), 1200, Math.max(wellDepth - 160, 1400));
  const { tubularStrings, casingShoes } = buildTubularStrings(wellDepth, casingShoeDepth);
  const openHoleStartDepth = casingShoeDepth;
  const openHoleLength = Math.max(0, Math.round(wellDepth - openHoleStartDepth));
  const currentFormation = inferFormationName(input.formation, wellDepth);
  const conditionLabel = formatWellboreConditionLabel(input.condition, input.cycleInfo?.stateLabel || '\u7a33\u5b9a\u76d1\u6d4b');
  const state = deriveWellboreState({
    backendLevel: input.backendLevel,
    pumpState: input.pumpState,
    condition: input.condition,
    cycleState: input.cycleInfo?.state,
    flowIn: input.flowIn,
    flowOut: input.flowOut,
    spm: input.spm,
    hasSamples: input.hasSamples,
    isRecovering: input.isRecovering,
    isStopped: input.isStopped,
  });
  const statusMeta = getWellboreStateMeta(state);
  const tone = levelTone(input.backendLevel);
  const flowDelta = finite(input.flowOut, 0) - finite(input.flowIn, 0);
  const circulationActive = finite(input.flowIn, 0) > 0.5 || finite(input.spm, 0) > 8;
  const returnActive = finite(input.flowOut, 0) > 0.5 || finite(input.returnResponse, 0) > 5;

  const gasSupport = finite(input.totalGas, 0) >= 0.8 || hasSignal(input.activeSignals, ['total_gas', 'gas_support']);
  const pitSupport = finite(input.pitGain, 0) >= 0.8 || hasSignal(input.activeSignals, ['pit_gain', 'pit_volume', 'pool_delta', 'pool_window_increase']);
  const pressureSupport = hasSignal(input.activeSignals, ['standpipe_pressure', 'spp', 'spp_drop', 'casing_pressure']);
  const returnSupport = flowDelta > 0.8 || finite(input.returnResponse, 0) > 8 || hasSignal(input.activeSignals, ['return_response']);

  const kickPointDepth = clamp(bitDepth - Math.max(80, openHoleLength * 0.12), openHoleStartDepth + 40, wellDepth - 40);
  const observationDepth = clamp(bitDepth - Math.max(50, openHoleLength * 0.08), openHoleStartDepth + 30, bitDepth - 12);

  const formationBands = buildFormationBands(wellDepth);
  const evidenceBands: WellboreZoneBand[] = [];
  const evidenceNotes: string[] = [];

  if (input.backendLevel === 0) {
    evidenceBands.push({
      key: 'normal-circulation',
      from: Math.max(openHoleStartDepth + 30, bitDepth - 180),
      to: Math.min(bitDepth + 25, wellDepth),
      label: '\u6b63\u5e38\u5faa\u73af\u6bb5',
      tone: 'normal',
      opacity: 0.16,
      lane: 'annulus',
    });
    evidenceNotes.push('\u672a\u89e6\u53d1\u5f02\u5e38\u4fb5\u5165\u8bc1\u636e');
    if (circulationActive) evidenceNotes.push(`\u5165\u53e3 / \u8fd4\u51fa\u57fa\u672c\u5e73\u8861\uff0c\u0394Q ${formatSigned(flowDelta, 1, 'L/s')}`);
  } else if (input.backendLevel === 1) {
    evidenceBands.push({
      key: 'watch-zone',
      from: Math.max(openHoleStartDepth + 30, observationDepth - 90),
      to: Math.min(observationDepth + 24, wellDepth),
      label: '\u89c2\u5bdf\u6bb5',
      tone: 'watch',
      opacity: 0.2,
      lane: 'annulus',
    });
    evidenceNotes.push('\u5f02\u5e38\u89c2\u5bdf\u4e2d');
    evidenceNotes.push(returnSupport ? `\u8fd4\u51fa\u54cd\u5e94\u8f7b\u5fae\u62ac\u5347\uff0c\u0394Q ${formatSigned(flowDelta, 1, 'L/s')}` : '\u5173\u6ce8\u8fd4\u51fa\u4e0e\u6c60\u4f53\u79ef\u5fae\u5c0f\u6ce2\u52a8');
  } else {
    const annulusTone = input.backendLevel >= 4 ? 'critical' : 'warning';
    evidenceBands.push({
      key: 'kick-return-path',
      from: Math.max(openHoleStartDepth + 40, kickPointDepth - 260),
      to: Math.max(openHoleStartDepth + 120, bitDepth - 18),
      label: input.backendLevel >= 4 ? '\u5f02\u5e38\u8fd4\u51fa\u4e3b\u8def\u5f84' : '\u7591\u4f3c\u4e0a\u8fd4\u8def\u5f84',
      tone: annulusTone,
      opacity: input.backendLevel >= 4 ? 0.28 : 0.22,
      lane: 'annulus',
    });
    evidenceBands.push({
      key: 'influx-zone',
      from: Math.max(openHoleStartDepth + 24, kickPointDepth - 54),
      to: Math.min(kickPointDepth + 64, wellDepth),
      label: gasSupport ? '\u6c14\u4fb5\u7591\u4f3c\u6bb5' : '\u5f02\u5e38\u4fb5\u5165\u6bb5',
      tone: maxTone(annulusTone, gasSupport ? 'critical' : annulusTone),
      opacity: gasSupport ? 0.3 : 0.24,
      lane: 'formation',
    });
    if (returnSupport) evidenceNotes.push(`\u51fa\u53e3\u6d41\u91cf\u9ad8\u4e8e\u5165\u53e3\u6d41\u91cf\uff0c\u0394Q ${formatSigned(flowDelta, 1, 'L/s')}`);
    if (pitSupport) evidenceNotes.push(`\u6c60\u589e\u91cf ${formatValue(finite(input.pitGain, 0), 2, 'm\u00b3')}\uff0c\u603b\u6c60\u4f53\u79ef ${formatValue(finite(input.pitVolume, 0), 2, 'm\u00b3')}`);
    if (pressureSupport) evidenceNotes.push(`\u7acb\u538b ${formatValue(finite(input.drillPipePressure, 0), 2, 'MPa')} / \u5957\u538b ${formatValue(finite(input.casingPressure, 0), 2, 'MPa')}`);
    if (gasSupport) evidenceNotes.push(`\u5168\u70c3 ${formatValue(finite(input.totalGas, 0), 2, '%')}\uff0c\u652f\u6301\u4e95\u5e95\u4fb5\u5165\u5224\u65ad`);
    if (evidenceNotes.length === 0) evidenceNotes.push('\u591a\u53c2\u6570\u8054\u5408\u5f02\u5e38\uff0c\u5efa\u8bae\u6309\u89c4\u7a0b\u590d\u6838\u5173\u4e95\u6761\u4ef6');
  }

  const flowState: WellboreFlowState = {
    circulationActive,
    returnActive,
    showNormalPath: input.backendLevel === 0,
    showWatchPath: input.backendLevel === 1,
    showKickPath: input.backendLevel >= 2,
    showKickPoint: input.backendLevel >= 2,
    inflowTone: input.backendLevel >= 2 ? 'warning' : input.backendLevel === 1 ? 'watch' : 'normal',
    annulusTone: input.backendLevel >= 4 ? 'critical' : input.backendLevel >= 2 ? 'warning' : input.backendLevel === 1 ? 'watch' : 'normal',
  };

  const depthMarkers: WellboreDepthMarker[] = [
    { key: 'wellhead', label: '\u4e95\u53e3', depth: 0 },
    { key: 'bop', label: 'BOP', depth: 0 },
    ...casingShoes.map((shoe) => ({ key: shoe.key, label: `${shoe.label} ${Math.round(shoe.depth)} m`, depth: shoe.depth })),
    { key: 'bit', label: `\u94bb\u5934 ${Math.round(bitDepth)} m`, depth: bitDepth, tone: input.backendLevel >= 2 ? 'critical' : input.backendLevel === 1 ? 'warning' : 'normal' },
    { key: 'td', label: `\u4e95\u6df1 ${Math.round(wellDepth)} m`, depth: wellDepth },
  ];

  return {
    wellDepth,
    bitDepth,
    casingShoeDepth,
    casingShoes,
    tubularStrings,
    openHoleStartDepth,
    openHoleLength,
    currentFormation,
    conditionLabel,
    statusLabel: statusMeta.label,
    statusDescription: statusMeta.description,
    tone,
    kickPointDepth,
    observationDepth,
    flowState,
    depthMarkers,
    formationBands,
    evidenceBands,
    evidenceNotes,
  };
}
