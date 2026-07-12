import { authenticatedFetch } from './authToken';

export interface WellboreSectionProfile {
  sectionId: number;
  wellboreName: string;
  spudSequence: string;
  casingName: string;
  bottomDepthM?: number;
  formation: string;
  holeSizeMm?: number;
  cementReturnDepthM?: number;
}

export interface TrajectorySurveyProfile {
  measuredDepthM: number;
  verticalDepthM?: number;
  inclinationDeg?: number;
  azimuthDeg?: number;
  doglegSeverityDeg30m?: number;
}

export interface BhaIntervalProfile {
  bhaIntervalId: number;
  bhaNo: string;
  startDepthM?: number;
  endDepthM?: number;
  holeSizeMm?: number;
  assemblyType: string;
  assemblyPurpose: string;
}

export interface BhaComponentProfile {
  componentId: number;
  bhaIntervalId?: number;
  componentOrder?: number;
  componentName: string;
  specModel: string;
  lengthM?: number;
  outerDiameterMm?: number;
  innerDiameterMm?: number;
  cumulativeLengthM?: number;
}

export interface WellboreProfile {
  wellId: number;
  wellKey: string;
  targetLayer: string;
  registeredDepthMax?: number;
  sections: WellboreSectionProfile[];
  trajectory: TrajectorySurveyProfile[];
  bhaIntervals: BhaIntervalProfile[];
  bhaComponents: BhaComponentProfile[];
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const wrapper = value as Record<string, unknown>;
    if (Array.isArray(wrapper.items)) return wrapper.items as T[];
    if (Array.isArray(wrapper.rows)) return wrapper.rows as T[];
    if (Array.isArray(wrapper.data)) return wrapper.data as T[];
  }
  return [];
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeProfile(payload: Record<string, unknown>): WellboreProfile {
  const sections = asArray<Record<string, unknown>>(payload.sections ?? payload.wellboreSections ?? payload.wellbore_sections).map((item) => ({
    sectionId: asNumber(item.sectionId ?? item.section_id ?? item.id) ?? 0,
    wellboreName: String(item.wellboreName ?? item.wellbore_name ?? item.wellbore ?? item.name ?? ''),
    spudSequence: String(item.spudSequence ?? item.spud_sequence ?? item.spud ?? item.sequence ?? ''),
    casingName: String(item.casingName ?? item.casing_name ?? item.casing ?? item.tubularName ?? item.tubular_name ?? ''),
    bottomDepthM: asNumber(item.bottomDepthM ?? item.bottom_depth_m ?? item.sectionBottomDepthM ?? item.section_bottom_depth_m ?? item.endDepthM ?? item.end_depth_m ?? item.depth),
    formation: String(item.formation ?? item.layer ?? item.stratum ?? ''),
    holeSizeMm: asNumber(item.holeSizeMm ?? item.hole_size_mm ?? item.holeSize ?? item.hole_size ?? item.holeDiameterMm ?? item.hole_diameter_mm),
    cementReturnDepthM: asNumber(item.cementReturnDepthM ?? item.cement_return_depth_m),
  }));
  const trajectory = asArray<Record<string, unknown>>(payload.trajectory ?? payload.surveys ?? payload.trajectory_surveys).map((item) => ({
    measuredDepthM: asNumber(item.measuredDepthM ?? item.measured_depth_m ?? item.md ?? item.depth) ?? 0,
    verticalDepthM: asNumber(item.verticalDepthM ?? item.vertical_depth_m ?? item.tvd),
    inclinationDeg: asNumber(item.inclinationDeg ?? item.inclination_deg ?? item.inclination),
    azimuthDeg: asNumber(item.azimuthDeg ?? item.azimuth_deg ?? item.azimuth),
    doglegSeverityDeg30m: asNumber(item.doglegSeverityDeg30m ?? item.dogleg_severity_deg30m),
  }));
  const bhaIntervals = asArray<Record<string, unknown>>(payload.bhaIntervals ?? payload.bha_intervals ?? payload.bha).map((item) => ({
    bhaIntervalId: asNumber(item.bhaIntervalId ?? item.bha_interval_id) ?? 0,
    bhaNo: String(item.bhaNo ?? item.bha_no ?? ''),
    startDepthM: asNumber(item.startDepthM ?? item.start_depth_m),
    endDepthM: asNumber(item.endDepthM ?? item.end_depth_m),
    holeSizeMm: asNumber(item.holeSizeMm ?? item.hole_size_mm),
    assemblyType: String(item.assemblyType ?? item.assembly_type ?? ''),
    assemblyPurpose: String(item.assemblyPurpose ?? item.assembly_purpose ?? ''),
  }));
  const bhaComponents = asArray<Record<string, unknown>>(payload.bhaComponents ?? payload.bha_components ?? payload.components).map((item) => ({
    componentId: asNumber(item.componentId ?? item.component_id) ?? 0,
    bhaIntervalId: asNumber(item.bhaIntervalId ?? item.bha_interval_id),
    componentOrder: asNumber(item.componentOrder ?? item.component_order),
    componentName: String(item.componentName ?? item.component_name ?? ''),
    specModel: String(item.specModel ?? item.spec_model ?? ''),
    lengthM: asNumber(item.lengthM ?? item.length_m),
    outerDiameterMm: asNumber(item.outerDiameterMm ?? item.outer_diameter_mm),
    innerDiameterMm: asNumber(item.innerDiameterMm ?? item.inner_diameter_mm),
    cumulativeLengthM: asNumber(item.cumulativeLengthM ?? item.cumulative_length_m),
  }));
  return {
    wellId: asNumber(payload.wellId ?? payload.well_id) ?? 0,
    wellKey: String(payload.wellKey ?? payload.well_key ?? ''),
    targetLayer: String(payload.targetLayer ?? payload.target_layer ?? ''),
    registeredDepthMax: asNumber(payload.registeredDepthMax ?? payload.registered_depth_max),
    sections,
    trajectory,
    bhaIntervals,
    bhaComponents,
  };
}

export async function fetchWellboreProfile(url: string, signal?: AbortSignal): Promise<WellboreProfile> {
  const response = await authenticatedFetch(url, { cache: 'no-store', signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return normalizeProfile(payload as Record<string, unknown>);
}
