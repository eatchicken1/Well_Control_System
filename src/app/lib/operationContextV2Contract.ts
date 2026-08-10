export interface OperationContextV2Candidate {
  available: boolean;
  fineLabel: string;
  kind: string;
  category: string;
  usesLegacyHookLoadMinus200Rule: boolean;
  ruleFlags: string[];
  reason: string;
}

export interface OperationContextV2PendingTransition {
  fromFineLabel: string;
  toFineLabel: string;
  fromKind: string;
  toKind: string;
  fromCategory: string;
  toCategory: string;
  startedAt: string | null;
  lastSeenAt: string | null;
  requiredSeconds: number | null;
  supportingFacts: string[];
  reason: string;
}

export interface OperationContextV2Snapshot {
  mode: string;
  shadowOnly: boolean;
  status: string;
  candidate: OperationContextV2Candidate;
  confirmedFineLabel: string | null;
  confirmedKind: string | null;
  confirmedCategory: string | null;
  confirmedSince: string | null;
  pendingTransition: OperationContextV2PendingTransition | null;
  hydraulicStatus: string | null;
  hydraulicBoundary: boolean;
  hydraulicBoundaryReasons: string[];
  trustedDepth: { rawMeasuredDepth: number | null; trustedMeasuredDepth: number | null; pendingMeasuredDepth: number | null; status: string; reason: string };
  stringMotion: { state: string; hookHeightCorroboratesMotion: boolean; reason: string };
  validationFlags: string[];
  eventTime: string | null;
  reason: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function read(record: Record<string, unknown>, names: string[]) {
  for (const name of names) if (record[name] !== undefined && record[name] !== null) return record[name];
  return undefined;
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : typeof value === 'string' ? value.trim().toLowerCase() === 'true' : fallback;
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const result = String(value).trim();
  return result || null;
}

function number(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/**
 * Parses the backend's Round 3.2 shadow projection without reconstructing
 * state locally. Missing/Disabled snapshots remain null for older backends.
 */
export function normalizeOperationContextV2(value: unknown): OperationContextV2Snapshot | null {
  const source = asRecord(value);
  const row = asRecord(source && read(source, ['operationContextV2', 'operation_context_v2']));
  if (!row || String(read(row, ['mode']) || '') === 'Disabled') return null;
  const candidate = asRecord(read(row, ['candidate'])) || {};
  const pending = asRecord(read(row, ['pendingTransition', 'pending_transition']));
  const trusted = asRecord(read(row, ['trustedDepth', 'trusted_depth'])) || {};
  const motion = asRecord(read(row, ['stringMotion', 'string_motion'])) || {};
  return {
    mode: String(read(row, ['mode']) || 'Unknown'),
    shadowOnly: bool(read(row, ['shadowOnly', 'shadow_only']), true),
    status: String(read(row, ['status']) || 'Unavailable'),
    candidate: {
      available: bool(read(candidate, ['available']), false),
      fineLabel: String(read(candidate, ['fineLabel', 'fine_label']) || '其它'),
      kind: String(read(candidate, ['kind']) || 'Unknown'),
      category: String(read(candidate, ['category']) || 'Unknown'),
      usesLegacyHookLoadMinus200Rule: bool(read(candidate, ['usesLegacyHookLoadMinus200Rule', 'uses_legacy_hook_load_minus_200_rule']), false),
      ruleFlags: texts(read(candidate, ['ruleFlags', 'rule_flags'])),
      reason: String(read(candidate, ['reason']) || ''),
    },
    confirmedFineLabel: text(read(row, ['confirmedFineLabel', 'confirmed_fine_label'])),
    confirmedKind: text(read(row, ['confirmedKind', 'confirmed_kind'])),
    confirmedCategory: text(read(row, ['confirmedCategory', 'confirmed_category'])),
    confirmedSince: text(read(row, ['confirmedSince', 'confirmed_since'])),
    pendingTransition: pending ? {
      fromFineLabel: String(read(pending, ['fromFineLabel', 'from_fine_label']) || ''),
      toFineLabel: String(read(pending, ['toFineLabel', 'to_fine_label']) || ''),
      fromKind: String(read(pending, ['fromKind', 'from_kind']) || ''),
      toKind: String(read(pending, ['toKind', 'to_kind']) || ''),
      fromCategory: String(read(pending, ['fromCategory', 'from_category']) || ''),
      toCategory: String(read(pending, ['toCategory', 'to_category']) || ''),
      startedAt: text(read(pending, ['startedAt', 'started_at'])),
      lastSeenAt: text(read(pending, ['lastSeenAt', 'last_seen_at'])),
      requiredSeconds: number(read(pending, ['requiredSeconds', 'required_seconds'])),
      supportingFacts: texts(read(pending, ['supportingFacts', 'supporting_facts'])),
      reason: String(read(pending, ['reason']) || ''),
    } : null,
    hydraulicStatus: text(read(row, ['hydraulicStatus', 'hydraulic_status'])),
    hydraulicBoundary: bool(read(row, ['hydraulicBoundary', 'hydraulic_boundary']), false),
    hydraulicBoundaryReasons: texts(read(row, ['hydraulicBoundaryReasons', 'hydraulic_boundary_reasons'])),
    trustedDepth: {
      rawMeasuredDepth: number(read(trusted, ['rawMeasuredDepth', 'raw_measured_depth'])),
      trustedMeasuredDepth: number(read(trusted, ['trustedMeasuredDepth', 'trusted_measured_depth'])),
      pendingMeasuredDepth: number(read(trusted, ['pendingMeasuredDepth', 'pending_measured_depth'])),
      status: String(read(trusted, ['status']) || 'Unavailable'),
      reason: String(read(trusted, ['reason']) || ''),
    },
    stringMotion: {
      state: String(read(motion, ['state']) || 'Unavailable'),
      hookHeightCorroboratesMotion: bool(read(motion, ['hookHeightCorroboratesMotion', 'hook_height_corroborates_motion']), false),
      reason: String(read(motion, ['reason']) || ''),
    },
    validationFlags: texts(read(row, ['validationFlags', 'validation_flags'])),
    eventTime: text(read(row, ['eventTime', 'event_time'])),
    reason: String(read(row, ['reason']) || ''),
  };
}
