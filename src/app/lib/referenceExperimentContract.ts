export interface ReferenceBankDiagnostic {
  ready: boolean;
  sampleCount: number;
  center: number | null;
  scale: number | null;
  standardizedResidual: number | null;
  lastLearnedAt: string | null;
}

export interface ReferenceChannelComparison {
  channel: string;
  rawQueryValue: number | null;
  authoritative: ReferenceBankDiagnostic;
  /**
   * The shadow (causal-robust-v1 processed) reference bank's diagnostics.
   * Never a measurement - see Round 2.2's provenance discipline. A UI must
   * label this "处理参考 / Processed reference (experimental)", never
   * "实测基线" (measured baseline).
   */
  shadowProcessed: ReferenceBankDiagnostic;
  learningDecision: string;
  learningBlockReason: string;
  processedQuality: string | null;
  processedFlags: string[];
  lastPersistentShiftAt: string | null;
  learningAfterPersistentShiftCount: number;
  framesSincePersistentShift: number | null;
  learningAcceptedDuringInnovation: number;
}

/**
 * Round 2.2 shadow reference A/B diagnostics. Research/diagnostics only - it
 * never overrides BackendDetectionState's raw baseline fields (baselineCount,
 * baselineSnapshot, etc.), which remain the values every existing alarm path
 * is derived from. Current alarms NEVER use the Shadow/Processed reference.
 */
export interface ReferenceExperimentSnapshot {
  mode: string;
  methodVersion: string;
  channels: ReferenceChannelComparison[];
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
  return text.length > 0 ? text : null;
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

function normalizeReferenceBankDiagnostic(value: unknown): ReferenceBankDiagnostic {
  if (!value || typeof value !== 'object') {
    return { ready: false, sampleCount: 0, center: null, scale: null, standardizedResidual: null, lastLearnedAt: null };
  }
  const row = value as Record<string, unknown>;
  return {
    ready: readBoolean(readValue(row, ['ready']), false),
    sampleCount: Math.max(0, Math.round(finite(readValue(row, ['sampleCount', 'sample_count']), 0))),
    center: optionalFinite(readValue(row, ['center'])),
    scale: optionalFinite(readValue(row, ['scale'])),
    standardizedResidual: optionalFinite(readValue(row, ['standardizedResidual', 'standardized_residual'])),
    lastLearnedAt: optionalText(readValue(row, ['lastLearnedAt', 'last_learned_at'])),
  };
}

/**
 * Parses the backend's ReferenceExperiment response field (see
 * ReferenceExperimentSnapshotResponse / ReferenceChannelComparisonResponse /
 * ReferenceBankDiagnosticResponse in
 * KickDetectionSystem.Application.Contracts.Responses.RealtimeDtos) into the
 * frontend's diagnostics-only model. Returns null when the field is absent
 * (ReferenceExperimentOptions.Mode is Disabled, or an older backend that
 * predates Round 2.2) - callers must treat null as "no diagnostics
 * available", never fabricate a snapshot.
 */
export function normalizeReferenceExperimentSnapshot(value: unknown): ReferenceExperimentSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const rawChannels = readValue(row, ['channels']) ?? [];
  const channels = Array.isArray(rawChannels)
    ? rawChannels.map((item) => {
      if (!item || typeof item !== 'object') return null;
      const channelRow = item as Record<string, unknown>;
      const channel = String(readValue(channelRow, ['channel']) || '').trim();
      if (!channel) return null;
      const rawFlags = readValue(channelRow, ['processedFlags', 'processed_flags']) ?? [];
      return {
        channel,
        rawQueryValue: optionalFinite(readValue(channelRow, ['rawQueryValue', 'raw_query_value'])),
        authoritative: normalizeReferenceBankDiagnostic(readValue(channelRow, ['authoritative'])),
        shadowProcessed: normalizeReferenceBankDiagnostic(readValue(channelRow, ['shadowProcessed', 'shadow_processed'])),
        learningDecision: String(readValue(channelRow, ['learningDecision', 'learning_decision']) || ''),
        learningBlockReason: String(readValue(channelRow, ['learningBlockReason', 'learning_block_reason']) || ''),
        processedQuality: optionalText(readValue(channelRow, ['processedQuality', 'processed_quality'])),
        processedFlags: Array.isArray(rawFlags) ? rawFlags.map((flag) => String(flag)) : [],
        lastPersistentShiftAt: optionalText(readValue(channelRow, ['lastPersistentShiftAt', 'last_persistent_shift_at'])),
        learningAfterPersistentShiftCount: Math.max(0, Math.round(finite(
          readValue(channelRow, ['learningAfterPersistentShiftCount', 'learning_after_persistent_shift_count']), 0,
        ))),
        framesSincePersistentShift: optionalFinite(
          readValue(channelRow, ['framesSincePersistentShift', 'frames_since_persistent_shift']),
        ),
        learningAcceptedDuringInnovation: Math.max(0, Math.round(finite(
          readValue(channelRow, ['learningAcceptedDuringInnovation', 'learning_accepted_during_innovation']), 0,
        ))),
      } satisfies ReferenceChannelComparison;
    }).filter((item): item is ReferenceChannelComparison => Boolean(item))
    : [];
  return {
    mode: String(readValue(row, ['mode']) || ''),
    methodVersion: String(readValue(row, ['methodVersion', 'method_version']) || ''),
    channels,
  };
}
