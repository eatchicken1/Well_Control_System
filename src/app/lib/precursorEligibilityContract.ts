export interface HydraulicEligibilityDiagnostics {
  status: string;
  eligible: boolean;
  reasons: string[];
  reason: string;
}

export interface PressureEligibilityDiagnostics {
  status: string;
  hydraulicEligible: boolean;
  operationEligible: boolean;
  telemetryAvailable: boolean;
  reasons: string[];
  reason: string;
}

export interface MechanicalChannelEligibilityDiagnostics {
  channel: string;
  role: string;
  status: string;
  operationApplicable: boolean;
  hydraulicEligible: boolean;
  telemetryAvailable: boolean;
  reasons: string[];
  reason: string;
}

export interface MechanicalEligibilityDiagnostics {
  status: string;
  hydraulicEligible: boolean;
  operationEligible: boolean;
  mechanicalTransient: boolean;
  channels: MechanicalChannelEligibilityDiagnostics[];
  reasons: string[];
  reason: string;
}

export interface PrecursorEligibilitySnapshot {
  eventTime: string | null;
  hydraulic: HydraulicEligibilityDiagnostics;
  pressure: PressureEligibilityDiagnostics;
  mechanical: MechanicalEligibilityDiagnostics;
  reason: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function readReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.map((reason) => String(reason)) : [];
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeHydraulic(value: unknown): HydraulicEligibilityDiagnostics {
  const row = asRecord(value) || {};
  return {
    status: String(readValue(row, ['status']) || 'Unavailable'),
    eligible: readBoolean(readValue(row, ['eligible']), false),
    reasons: readReasons(readValue(row, ['reasons'])),
    reason: String(readValue(row, ['reason']) || ''),
  };
}

function normalizePressure(value: unknown): PressureEligibilityDiagnostics {
  const row = asRecord(value) || {};
  return {
    status: String(readValue(row, ['status']) || 'Unavailable'),
    hydraulicEligible: readBoolean(readValue(row, ['hydraulicEligible', 'hydraulic_eligible']), false),
    operationEligible: readBoolean(readValue(row, ['operationEligible', 'operation_eligible']), false),
    telemetryAvailable: readBoolean(readValue(row, ['telemetryAvailable', 'telemetry_available']), false),
    reasons: readReasons(readValue(row, ['reasons'])),
    reason: String(readValue(row, ['reason']) || ''),
  };
}

function normalizeMechanicalChannel(value: unknown): MechanicalChannelEligibilityDiagnostics {
  const row = asRecord(value) || {};
  return {
    channel: String(readValue(row, ['channel']) || 'unknown'),
    role: String(readValue(row, ['role']) || 'Unknown'),
    status: String(readValue(row, ['status']) || 'Unavailable'),
    operationApplicable: readBoolean(readValue(row, ['operationApplicable', 'operation_applicable']), false),
    hydraulicEligible: readBoolean(readValue(row, ['hydraulicEligible', 'hydraulic_eligible']), false),
    telemetryAvailable: readBoolean(readValue(row, ['telemetryAvailable', 'telemetry_available']), false),
    reasons: readReasons(readValue(row, ['reasons'])),
    reason: String(readValue(row, ['reason']) || ''),
  };
}

function normalizeMechanical(value: unknown): MechanicalEligibilityDiagnostics {
  const row = asRecord(value) || {};
  const channels = readValue(row, ['channels']);
  return {
    status: String(readValue(row, ['status']) || 'Unavailable'),
    hydraulicEligible: readBoolean(readValue(row, ['hydraulicEligible', 'hydraulic_eligible']), false),
    operationEligible: readBoolean(readValue(row, ['operationEligible', 'operation_eligible']), false),
    mechanicalTransient: readBoolean(readValue(row, ['mechanicalTransient', 'mechanical_transient']), false),
    channels: Array.isArray(channels) ? channels.map(normalizeMechanicalChannel) : [],
    reasons: readReasons(readValue(row, ['reasons'])),
    reason: String(readValue(row, ['reason']) || ''),
  };
}

/**
 * Round 3.1 diagnostic contract. The client renders backend-provided statuses
 * and reasons only; it must never re-derive precursor eligibility locally.
 */
export function normalizePrecursorEligibility(value: unknown): PrecursorEligibilitySnapshot | null {
  const source = asRecord(value);
  if (!source) return null;
  const raw = readValue(source, ['precursorEligibility', 'precursor_eligibility']);
  const row = asRecord(raw);
  if (!row) return null;
  return {
    eventTime: optionalText(readValue(row, ['eventTime', 'event_time'])),
    hydraulic: normalizeHydraulic(readValue(row, ['hydraulic'])),
    pressure: normalizePressure(readValue(row, ['pressure'])),
    mechanical: normalizeMechanical(readValue(row, ['mechanical'])),
    reason: String(readValue(row, ['reason']) || ''),
  };
}
