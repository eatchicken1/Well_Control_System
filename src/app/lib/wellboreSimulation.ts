import type { BackendLevel, CycleInfo } from '../context/WellControlContext';
import { deriveWellboreState, formatWellboreConditionLabel, getWellboreStateMeta } from './wellboreState';

export type WellboreTone = 'normal' | 'watch' | 'warning' | 'critical';

export interface WellboreStructureSection {
  sectionId: number;
  wellboreName?: string;
  spudSequence: string;
  casingName: string;
  bottomDepthM?: number;
  formation: string;
  holeSizeMm?: number;
  kind?: 'casing' | 'openHole';
}

const WELLBORE_STRUCTURE_NAME = /套管|导管|悬挂|回接|衬管|筛管|裸眼|casing|conductor|liner|open\s*hole/i;
const OPEN_HOLE_NAME = /裸眼|open\s*hole/i;
const WELLBORE_PROGRAM_SEQUENCE = /(?:^|\s)(?:\d+\s*开|导眼|侧钻|加深|分支)/;

function usableText(value: string | undefined) {
  return value?.trim() || '';
}

function usableFormation(value: string | undefined) {
  const normalized = usableText(value);
  if (!normalized) return '';
  return /^[-+]?\d+(?:\.\d+)?$/.test(normalized) ? '' : normalized;
}

/**
 * The imported wellbore_section table can contain both program rows and
 * casing-specification fragments. Keep only program rows, merge duplicates,
 * and make an explicit casing/open-hole distinction before any drawing logic.
 */
export function normalizeWellboreStructureSections(rawSections: WellboreStructureSection[]): WellboreStructureSection[] {
  const deduped = new Map<string, WellboreStructureSection>();
  rawSections.forEach((section, index) => {
    const bottomDepthM = Number(section.bottomDepthM);
    const spudSequence = usableText(section.spudSequence);
    const casingName = usableText(section.casingName);
    const sourceFormation = usableFormation(section.formation);
    const formation = sourceFormation || String.fromCharCode(65 + Math.min(index, 25));
    const looksLikeProgram = WELLBORE_PROGRAM_SEQUENCE.test(spudSequence)
      || WELLBORE_STRUCTURE_NAME.test(casingName)
      || sourceFormation.length > 0;
    if (!Number.isFinite(bottomDepthM) || bottomDepthM <= 20 || !looksLikeProgram) return;
    const holeSizeMm = Number(section.holeSizeMm);
    const kind = OPEN_HOLE_NAME.test(casingName) || !casingName ? 'openHole' : 'casing';
    const key = `${Math.round(bottomDepthM * 10)}|${spudSequence || '未命名'}|${kind}`;
    const existing = deduped.get(key);
    const normalized: WellboreStructureSection = {
      sectionId: section.sectionId,
      wellboreName: usableText(section.wellboreName),
      spudSequence,
      casingName,
      bottomDepthM,
      formation,
      holeSizeMm: Number.isFinite(holeSizeMm) && holeSizeMm > 50 ? holeSizeMm : undefined,
      kind,
    };
    if (!existing) {
      deduped.set(key, normalized);
      return;
    }
    deduped.set(key, {
      ...existing,
      casingName: existing.casingName || normalized.casingName,
      formation: existing.formation || normalized.formation,
      holeSizeMm: existing.holeSizeMm ?? normalized.holeSizeMm,
      kind: existing.kind === 'casing' || normalized.kind === 'casing' ? 'casing' : 'openHole',
    });
  });
  return [...deduped.values()].sort((a, b) => Number(a.bottomDepthM) - Number(b.bottomDepthM));
}

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
  casingShoeDepth?: number;
  drillPipeOD?: number;
  bhaOD?: number;
  bitOD?: number;
  casingID?: number;
  openHoleDiameter?: number;
  formation?: string;
  wellboreSections?: WellboreStructureSection[];
  mudWeight?: number;
  ecd?: number;
  porePressureEquivalent?: number;
  fractureGradientEquivalent?: number;
  inclination?: number;
  highSideDirection?: number;
  influxFromDepth?: number;
  influxToDepth?: number;
  influxConfidence?: number;
  influxSource?: 'measured' | 'estimated' | 'unknown';
  influxSide?: 'left' | 'right' | 'highSide' | 'unknown';
  gasFrontDepth?: number;
  gasColumnBottomDepth?: number;
  gasFraction?: number;
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
  programLabel: string;
  holeSizeLabel: string;
  casingSizeLabel: string;
  topDepth: number;
  bottomDepth: number;
  outerWidth: number;
  innerWidth: number;
  fill: string;
  stroke: string;
  cementOuterWidth: number;
}

export interface WellborePressureWindow {
  mudWeight?: number;
  ecd?: number;
  porePressureEquivalent?: number;
  fractureGradientEquivalent?: number;
  margin?: number;
  status: 'overbalanced' | 'narrow' | 'underbalanced' | 'unknown';
  source: 'measured' | 'partial' | 'unknown';
}

export interface WellboreKickDiagnostics {
  severity: number;
  influxRate: number;
  gasFrontDepth?: number;
  gasColumnLength?: number;
  migrationVelocity?: number;
}

export interface WellboreHydraulicGeometry {
  drillPipeOD: number;
  bhaOD: number;
  bitOD: number;
  casingID: number;
  openHoleDiameter: number;
}

export interface WellboreSectionGeometry {
  fromDepth: number;
  toDepth: number;
  boreInnerWidth: number;
  drillOuterWidth: number;
  sectionType: 'cased' | 'openHole' | 'bha' | 'bit';
}

export interface InfluxLocalization {
  fromDepth: number;
  toDepth: number;
  confidence: number;
  source: 'measured' | 'estimated' | 'unknown';
  side: 'left' | 'right' | 'highSide' | 'unknown';
}

export interface AnnulusPhaseState {
  gasFrontDepth?: number;
  gasColumnBottomDepth?: number;
  gasFraction?: number;
  highSideBias?: number;
}

export interface WellboreSimulationModel {
  wellDepth: number;
  bitDepth: number;
  casingShoeDepth: number;
  casingShoes: WellboreCasingShoe[];
  tubularStrings: WellboreTubularString[];
  openHoleStartDepth: number;
  openHoleLength: number;
  openHoleSizeLabel: string;
  hydraulicGeometry: WellboreHydraulicGeometry;
  sectionGeometry: WellboreSectionGeometry[];
  pressureWindow: WellborePressureWindow;
  influxLocalization: InfluxLocalization;
  annulusPhaseState: AnnulusPhaseState;
  kickDiagnostics: WellboreKickDiagnostics;
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
  if (wellDepth >= 5200) return 'E';
  if (wellDepth >= 4200) return 'D';
  if (wellDepth >= 3200) return 'C';
  return 'A';
}

function buildFormationBands(wellDepth: number): WellboreFormationBand[] {
  const anchors = [0, 900, 2000, 3200, Math.max(wellDepth - 500, 3400), wellDepth];
  return [
    { key: 'surface', label: 'A', from: anchors[0], to: Math.min(anchors[1], wellDepth), fill: '#f3eee4', accent: '#9a7b4f' },
    { key: 'upper-sand', label: 'B', from: Math.min(anchors[1], wellDepth), to: Math.min(anchors[2], wellDepth), fill: '#ebe4d5', accent: '#986c32' },
    { key: 'mudstone', label: 'C', from: Math.min(anchors[2], wellDepth), to: Math.min(anchors[3], wellDepth), fill: '#e7edf1', accent: '#64748b' },
    { key: 'reservoir', label: 'D', from: Math.min(anchors[3], wellDepth), to: Math.min(anchors[4], wellDepth), fill: '#eee5d5', accent: '#8a5f2a' },
    { key: 'target', label: 'E', from: Math.min(anchors[4], wellDepth), to: wellDepth, fill: '#dcfce7', accent: '#047857' },
  ].filter((item) => item.to > item.from + 1);
}

function buildFormationBandsFromSections(sections: WellboreStructureSection[], wellDepth: number): WellboreFormationBand[] {
  const palette = [
    { fill: '#f3eee4', accent: '#9a7b4f' },
    { fill: '#e7edf1', accent: '#64748b' },
    { fill: '#eee5d5', accent: '#8a5f2a' },
    { fill: '#dcfce7', accent: '#047857' },
  ];
  let top = 0;
  return sections.flatMap((section, index) => {
    const bottom = clamp(finite(section.bottomDepthM, top), top, wellDepth);
    const band = bottom > top + 1 ? [{
      key: `section-${section.sectionId || index}`,
      label: section.formation?.trim() || section.spudSequence?.trim() || `井段 ${index + 1}`,
      from: top,
      to: bottom,
      ...palette[index % palette.length],
    }] : [];
    top = Math.max(top, bottom);
    return band;
  });
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
      programLabel: '\u5bfc\u7ba1',
      holeSizeLabel: '20 in',
      casingSizeLabel: '13-3/8 in',
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
      programLabel: '\u8868\u5957',
      holeSizeLabel: '12-1/4 in',
      casingSizeLabel: '9-5/8 in',
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
      programLabel: '\u6280\u5957',
      holeSizeLabel: '8-1/2 in',
      casingSizeLabel: '7 in',
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

function buildTubularStringsFromSections(sections: WellboreStructureSection[], wellDepth: number) {
  const validSections = sections
    .filter((section) => Number.isFinite(section.bottomDepthM) && Number(section.bottomDepthM) > 20)
    .sort((a, b) => Number(a.bottomDepthM) - Number(b.bottomDepthM));
  const strings = validSections.map((section, index) => {
    const outerWidth = clamp(164 - index * Math.max(22, 76 / Math.max(validSections.length, 1)), 72, 164);
    const casingName = section.casingName?.trim() || section.spudSequence?.trim() || `第 ${index + 1} 开`;
    const holeSizeLabel = Number.isFinite(section.holeSizeMm) && Number(section.holeSizeMm) > 0
      ? `${Math.round(Number(section.holeSizeMm))} mm`
      : '井眼尺寸未录入';
    return {
      key: `db-section-${section.sectionId || index}`,
      label: casingName,
      programLabel: section.spudSequence?.trim() || casingName,
      holeSizeLabel,
      casingSizeLabel: casingName,
      topDepth: 0,
      bottomDepth: clamp(Number(section.bottomDepthM), 20, wellDepth),
      outerWidth,
      innerWidth: Math.max(outerWidth - 28, 34),
      fill: ['#94a3b8', '#64748b', '#475569', '#334155'][index % 4],
      stroke: ['#475569', '#334155', '#1f2937', '#0f172a'][index % 4],
      cementOuterWidth: outerWidth + 18,
    } satisfies WellboreTubularString;
  });
  return {
    tubularStrings: strings,
    casingShoes: strings.map((item) => ({ key: `${item.key}-shoe`, label: `${item.label}鞋`, depth: item.bottomDepth })),
  };
}

export function buildWellboreSimulationModel(input: WellboreSimulationInput): WellboreSimulationModel {
  const wellDepth = Math.max(finite(input.wellDepth, 4200), 2600);
  const bitDepth = clamp(finite(input.bitDepth, wellDepth - 80), 300, wellDepth);
  const realSections = normalizeWellboreStructureSections(input.wellboreSections || []);
  // A wellbore-section row can describe a planned open-hole section extending below the
  // live bit position. Only a completed section above the bit can be a casing shoe.
  const casingSections = realSections.filter((section) => section.kind !== 'openHole');
  const completedCasingSections = casingSections.filter((section) => Number(section.bottomDepthM) <= bitDepth - 120);
  const activeCasingSections = completedCasingSections.length > 0 ? completedCasingSections : casingSections.filter((section) => Number(section.bottomDepthM) < bitDepth);
  const deepestSectionDepth = activeCasingSections.length > 0
    ? Number(activeCasingSections[activeCasingSections.length - 1].bottomDepthM)
    : undefined;
  const fallbackShoeDepth = Math.min(DEFAULT_CASING_SHOE_DEPTH, Math.max(900, bitDepth - 320));
  const suppliedShoeDepth = Number.isFinite(input.casingShoeDepth) && Number(input.casingShoeDepth) <= bitDepth - 120
    ? Number(input.casingShoeDepth)
    : undefined;
  const casingShoeDepth = clamp(
    finite(deepestSectionDepth ?? suppliedShoeDepth, fallbackShoeDepth),
    Math.min(900, Math.max(280, bitDepth - 180)),
    Math.max(900, Math.min(bitDepth - 120, wellDepth - 160)),
  );
  const { tubularStrings, casingShoes } = activeCasingSections.length > 0
    ? buildTubularStringsFromSections(activeCasingSections, wellDepth)
    : buildTubularStrings(wellDepth, casingShoeDepth);
  const openHoleStartDepth = casingShoeDepth;
  const openHoleLength = Math.max(0, Math.round(wellDepth - openHoleStartDepth));
  const hydraulicGeometry: WellboreHydraulicGeometry = {
    drillPipeOD: finite(input.drillPipeOD, 22),
    bhaOD: finite(input.bhaOD, 34),
    bitOD: finite(input.bitOD, 50),
    casingID: finite(input.casingID, tubularStrings[tubularStrings.length - 1]?.innerWidth ?? 58),
    openHoleDiameter: finite(input.openHoleDiameter, 66),
  };
  const activeSection = realSections.find((section) => Number(section.bottomDepthM) >= bitDepth) || realSections[realSections.length - 1];
  const openHoleSizeLabel = Number.isFinite(activeSection?.holeSizeMm) && Number(activeSection.holeSizeMm) > 0
    ? `${Math.round(Number(activeSection.holeSizeMm))} mm`
    : '8-1/2 in';
  const bhaTopDepth = clamp(bitDepth - 620, openHoleStartDepth + 80, Math.max(openHoleStartDepth + 120, bitDepth - 40));
  const bitTopDepth = clamp(bitDepth - 80, bhaTopDepth + 40, bitDepth - 8);
  const sectionGeometry: WellboreSectionGeometry[] = [
    { fromDepth: 0, toDepth: openHoleStartDepth, boreInnerWidth: hydraulicGeometry.casingID, drillOuterWidth: hydraulicGeometry.drillPipeOD, sectionType: 'cased' },
    { fromDepth: openHoleStartDepth, toDepth: bhaTopDepth, boreInnerWidth: hydraulicGeometry.openHoleDiameter, drillOuterWidth: hydraulicGeometry.drillPipeOD, sectionType: 'openHole' },
    { fromDepth: bhaTopDepth, toDepth: bitTopDepth, boreInnerWidth: hydraulicGeometry.openHoleDiameter, drillOuterWidth: hydraulicGeometry.bhaOD, sectionType: 'bha' },
    { fromDepth: bitTopDepth, toDepth: bitDepth, boreInnerWidth: hydraulicGeometry.openHoleDiameter, drillOuterWidth: hydraulicGeometry.bitOD, sectionType: 'bit' },
  ].filter((section) => section.toDepth > section.fromDepth + 1);
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
  const mudWeight = Number.isFinite(input.mudWeight) && Number(input.mudWeight) > 0 ? Number(input.mudWeight) : undefined;
  const ecd = Number.isFinite(input.ecd) && Number(input.ecd) > 0 ? Number(input.ecd) : undefined;
  const porePressureEquivalent = Number.isFinite(input.porePressureEquivalent) && Number(input.porePressureEquivalent) > 0 ? Number(input.porePressureEquivalent) : undefined;
  const fractureGradientEquivalent = Number.isFinite(input.fractureGradientEquivalent) && Number(input.fractureGradientEquivalent) > 0 ? Number(input.fractureGradientEquivalent) : undefined;
  const effectiveDensity = ecd ?? mudWeight;
  const pressureMargin = effectiveDensity !== undefined && porePressureEquivalent !== undefined ? Number((effectiveDensity - porePressureEquivalent).toFixed(2)) : undefined;
  const pressureWindow: WellborePressureWindow = {
    mudWeight,
    ecd,
    porePressureEquivalent,
    fractureGradientEquivalent,
    margin: pressureMargin,
    status: pressureMargin === undefined ? 'unknown' : pressureMargin !== undefined && pressureMargin < 0 ? 'underbalanced' : pressureMargin <= 0.03 ? 'narrow' : 'overbalanced',
    source: porePressureEquivalent === undefined ? (mudWeight !== undefined || ecd !== undefined ? 'partial' : 'unknown') : 'measured',
  };

  const gasSupport = finite(input.totalGas, 0) >= 0.8 || hasSignal(input.activeSignals, ['total_gas', 'gas_support']);
  const pitSupport = finite(input.pitGain, 0) >= 0.8 || hasSignal(input.activeSignals, ['pit_gain', 'pit_volume', 'pool_delta', 'pool_window_increase']);
  const pressureSupport = hasSignal(input.activeSignals, ['standpipe_pressure', 'spp', 'spp_drop', 'casing_pressure']);
  const returnSupport = flowDelta > 0.8 || finite(input.returnResponse, 0) > 8 || hasSignal(input.activeSignals, ['return_response']);

  const estimatedCenterDepth = clamp(bitDepth - Math.max(100, openHoleLength * 0.12), openHoleStartDepth + 80, wellDepth - 80);
  const localizationHalfSpan = clamp(openHoleLength * 0.045, 40, 120);
  const localizationSource = input.influxSource ?? (input.backendLevel >= 2 ? 'estimated' : 'unknown');
  const localizationFrom = input.influxFromDepth ?? estimatedCenterDepth - localizationHalfSpan;
  const localizationTo = input.influxToDepth ?? estimatedCenterDepth + localizationHalfSpan;
  const influxLocalization: InfluxLocalization = {
    fromDepth: clamp(Math.min(localizationFrom, localizationTo), openHoleStartDepth + 20, wellDepth - 20),
    toDepth: clamp(Math.max(localizationFrom, localizationTo), openHoleStartDepth + 40, wellDepth),
    confidence: clamp(input.influxConfidence ?? (localizationSource === 'estimated' ? 0.28 + [returnSupport, pitSupport, gasSupport, pressureSupport].filter(Boolean).length * 0.12 : 0), 0, 1),
    source: localizationSource,
    side: input.influxSide ?? 'unknown',
  };
  const kickPointDepth = (influxLocalization.fromDepth + influxLocalization.toDepth) / 2;
  const observationDepth = clamp(kickPointDepth - Math.max(50, openHoleLength * 0.08), openHoleStartDepth + 30, bitDepth - 12);
  const evidenceScore = (returnSupport ? 0.28 : 0) + (pitSupport ? 0.22 : 0) + (gasSupport ? 0.26 : 0) + (pressureMargin !== undefined && pressureMargin !== undefined && pressureMargin < 0 ? 0.24 : 0);
  const levelBase = input.backendLevel >= 4 ? 0.76 : input.backendLevel === 3 ? 0.62 : input.backendLevel === 2 ? 0.48 : 0;
  const severity = input.backendLevel >= 2 ? clamp(levelBase + evidenceScore * 0.18, 0.35, 0.96) : input.backendLevel === 1 ? 0.18 : 0;
  const gasColumnBottomDepth = input.gasColumnBottomDepth;
  const gasFrontDepth = input.gasFrontDepth;
  const gasColumnLength = gasFrontDepth !== undefined && gasColumnBottomDepth !== undefined ? Math.max(0, gasColumnBottomDepth - gasFrontDepth) : undefined;
  const influxRate = input.backendLevel >= 2 ? clamp(Math.max(flowDelta, 0) * 0.78 + finite(input.pitGain, 0) * 0.42 + finite(input.totalGas, 0) * 0.34, 0.4, 8.8) : 0;
  const migrationVelocity = input.backendLevel >= 2 ? clamp(12 + severity * 36 + Math.max(flowDelta, 0) * 1.2, 10, 58) : 0;
  const kickDiagnostics: WellboreKickDiagnostics = {
    severity: Number(severity.toFixed(2)),
    influxRate: Number(influxRate.toFixed(1)),
    gasFrontDepth: gasFrontDepth === undefined ? undefined : Math.round(gasFrontDepth),
    gasColumnLength: gasColumnLength === undefined ? undefined : Math.round(gasColumnLength),
    migrationVelocity: input.backendLevel >= 2 ? Math.round(migrationVelocity) : undefined,
  };
  const hasDirectionalBasis = Number.isFinite(input.inclination) && Number(input.inclination) >= 5 && Number.isFinite(input.highSideDirection);
  const annulusPhaseState: AnnulusPhaseState = {
    gasFrontDepth: kickDiagnostics.gasFrontDepth,
    gasColumnBottomDepth,
    gasFraction: input.gasFraction ?? (input.backendLevel >= 2 ? clamp(finite(input.totalGas, 0) / 4, 0.08, 0.62) : undefined),
    highSideBias: hasDirectionalBasis ? clamp(Number(input.inclination) / 90, 0, 1) : undefined,
  };

  const formationBands = (realSections.length > 0 ? buildFormationBandsFromSections(realSections, wellDepth) : buildFormationBands(wellDepth)).map((band) => (
    band.key === 'target' ? { ...band, label: currentFormation } : band
  ));
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
    evidenceNotes.push(pressureMargin === undefined ? '压力关系数据不足，未接入 PP / ECD' : `井底压力裕度 Δρ ${formatSigned(pressureMargin, 2, 'g/cm³')}`);
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
    evidenceNotes.push(pressureMargin === undefined ? '压力关系数据不足，持续观察流量与池体积' : `压力裕度 Δρ ${formatSigned(pressureMargin, 2, 'g/cm³')}`);
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
    if (pressureMargin !== undefined && pressureMargin < 0) evidenceNotes.push(`\u6ce5\u6d46\u5f53\u91cf\u4f4e\u4e8e\u5730\u5c42\u538b\u529b\u5f53\u91cf\uff0c\u0394\u03c1 ${pressureMargin === undefined ? '数据不足' : formatSigned(pressureMargin, 2, 'g/cm\u00b3')}`);
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
    openHoleSizeLabel,
    hydraulicGeometry,
    sectionGeometry,
    pressureWindow,
    influxLocalization,
    annulusPhaseState,
    kickDiagnostics,
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
