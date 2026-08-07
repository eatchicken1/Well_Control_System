export interface PreprocessingSignalSnapshot {
  channel: string;
  unit: string;
  rawValue: number | null;
  processedValue: number | null;
  noiseSigma: number | null;
  robustZ: number | null;
  quality: string;
  flags: string[];
}

/**
 * Round 2 shadow preprocessing diagnostics. Research/diagnostics only - it
 * never overrides MonitoringData's raw fields (spp, flowIn, etc.), which
 * remain the values every chart and the existing alert path are derived
 * from.
 */
export interface PreprocessingSnapshot {
  mode: string;
  version: string;
  ready: boolean;
  availableChannels: number;
  suspectChannels: number;
  signals: PreprocessingSignalSnapshot[];
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

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Parses the backend's Preprocessing response field (see
 * PreprocessingSnapshotResponse / PreprocessingSignalResponse in
 * KickDetectionSystem.Application.Contracts.Responses.RealtimeDtos) into the
 * frontend's diagnostics-only model. Returns null when the field is absent
 * (SignalProcessing.Mode is Disabled, or an older backend that predates
 * Round 2) - callers must treat null as "no diagnostics available", never
 * fabricate a snapshot.
 */
export function normalizePreprocessingSnapshot(value: unknown): PreprocessingSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const rawSignals = readValue(row, ['signals']) ?? [];
  const signals = Array.isArray(rawSignals)
    ? rawSignals.map((item) => {
      if (!item || typeof item !== 'object') return null;
      const signal = item as Record<string, unknown>;
      const channel = String(readValue(signal, ['channel']) || '').trim();
      if (!channel) return null;
      const rawFlags = readValue(signal, ['flags']) ?? [];
      return {
        channel,
        unit: String(readValue(signal, ['unit']) || ''),
        rawValue: optionalFinite(readValue(signal, ['rawValue', 'raw_value'])),
        processedValue: optionalFinite(readValue(signal, ['processedValue', 'processed_value'])),
        noiseSigma: optionalFinite(readValue(signal, ['noiseSigma', 'noise_sigma'])),
        robustZ: optionalFinite(readValue(signal, ['robustZ', 'robust_z'])),
        quality: String(readValue(signal, ['quality']) || ''),
        flags: Array.isArray(rawFlags) ? rawFlags.map((flag) => String(flag)) : [],
      } satisfies PreprocessingSignalSnapshot;
    }).filter((item): item is PreprocessingSignalSnapshot => Boolean(item))
    : [];
  return {
    mode: String(readValue(row, ['mode']) || ''),
    version: String(readValue(row, ['version']) || ''),
    ready: readBoolean(readValue(row, ['ready']), false),
    availableChannels: Math.max(0, Math.round(finite(readValue(row, ['availableChannels', 'available_channels']), 0))),
    suspectChannels: Math.max(0, Math.round(finite(readValue(row, ['suspectChannels', 'suspect_channels']), 0))),
    signals,
  };
}
