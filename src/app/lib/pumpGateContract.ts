export interface PumpConfigurationDiagnostics {
  spm1: number | null;
  spm2: number | null;
  spm3: number | null;
  totalSpm: number | null;
  complete: boolean;
  activeMask: number | null;
  configurationSignature: string | null;
  pump1State: string;
  pump2State: string;
  pump3State: string;
  anyRunning: boolean;
  allStopped: boolean;
}

export interface StablePumpingGateDiagnostics {
  mode: string;
  status: string;
  eligibleForPrecursor: boolean;
  configurationStable: boolean;
  qinStable: boolean;
  perPumpRatesStable: boolean;
  stableSince: string | null;
  lastBoundaryAt: string | null;
  boundaryReasons: string[];
  reason: string;
}

export interface PumpGateDiagnosticsSnapshot {
  configuration: PumpConfigurationDiagnostics;
  gate: StablePumpingGateDiagnostics;
}

function readValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function optionalFinite(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function normalizeConfiguration(value: unknown): PumpConfigurationDiagnostics {
  const row = asRecord(value) || {};
  const activeMask = optionalFinite(readValue(row, ['activeMask', 'active_mask']));
  return {
    spm1: optionalFinite(readValue(row, ['spm1', 'spm_1'])),
    spm2: optionalFinite(readValue(row, ['spm2', 'spm_2'])),
    spm3: optionalFinite(readValue(row, ['spm3', 'spm_3'])),
    totalSpm: optionalFinite(readValue(row, ['totalSpm', 'total_spm'])),
    complete: readBoolean(readValue(row, ['complete']), false),
    activeMask: activeMask === null ? null : Math.max(0, Math.round(activeMask)),
    configurationSignature: optionalText(readValue(row, ['configurationSignature', 'configuration_signature'])),
    pump1State: String(readValue(row, ['pump1State', 'pump_1_state']) || 'Unknown'),
    pump2State: String(readValue(row, ['pump2State', 'pump_2_state']) || 'Unknown'),
    pump3State: String(readValue(row, ['pump3State', 'pump_3_state']) || 'Unknown'),
    anyRunning: readBoolean(readValue(row, ['anyRunning', 'any_running']), false),
    allStopped: readBoolean(readValue(row, ['allStopped', 'all_stopped']), false),
  };
}

function normalizeGate(value: unknown): StablePumpingGateDiagnostics {
  const row = asRecord(value) || {};
  const rawReasons = readValue(row, ['boundaryReasons', 'boundary_reasons']);
  return {
    mode: String(readValue(row, ['mode']) || 'Unknown'),
    status: String(readValue(row, ['status']) || 'Unavailable'),
    eligibleForPrecursor: readBoolean(readValue(row, ['eligibleForPrecursor', 'eligible_for_precursor']), false),
    configurationStable: readBoolean(readValue(row, ['configurationStable', 'configuration_stable']), false),
    qinStable: readBoolean(readValue(row, ['qinStable', 'qin_stable']), false),
    perPumpRatesStable: readBoolean(readValue(row, ['perPumpRatesStable', 'per_pump_rates_stable']), false),
    stableSince: optionalText(readValue(row, ['stableSince', 'stable_since'])),
    lastBoundaryAt: optionalText(readValue(row, ['lastBoundaryAt', 'last_boundary_at'])),
    boundaryReasons: Array.isArray(rawReasons) ? rawReasons.map((reason) => String(reason)) : [],
    reason: String(readValue(row, ['reason']) || ''),
  };
}

/**
 * Parses Round 3 shadow diagnostics. Missing values stay missing: the client
 * must never infer an Off pump, an active mask, or Qin stability from Total
 * SPM or other aggregate fields.
 */
export function normalizePumpGateDiagnostics(value: unknown): PumpGateDiagnosticsSnapshot | null {
  const row = asRecord(value);
  if (!row) return null;
  const configuration = readValue(row, ['pumpConfiguration', 'pump_configuration']);
  const gate = readValue(row, ['stablePumpingGate', 'stable_pumping_gate']);
  if (!asRecord(configuration) && !asRecord(gate)) return null;
  return {
    configuration: normalizeConfiguration(configuration),
    gate: normalizeGate(gate),
  };
}
