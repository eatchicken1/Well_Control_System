import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReferenceExperimentSnapshot } from './referenceExperimentContract.ts';

test('normalizeReferenceExperimentSnapshot returns null when the field is absent (Disabled mode / older backend)', () => {
  assert.equal(normalizeReferenceExperimentSnapshot(undefined), null);
  assert.equal(normalizeReferenceExperimentSnapshot(null), null);
  assert.equal(normalizeReferenceExperimentSnapshot('not-an-object'), null);
});

test('normalizeReferenceExperimentSnapshot parses a well-formed ShadowProcessed response', () => {
  const snapshot = normalizeReferenceExperimentSnapshot({
    mode: 'ShadowProcessed',
    methodVersion: 'causal-robust-v1',
    channels: [
      {
        channel: 'standpipe_pressure',
        rawQueryValue: 18_000_000,
        authoritative: { ready: true, sampleCount: 120, center: 18_000_000, scale: 250_000, standardizedResidual: 0.1, lastLearnedAt: '2026-01-01T00:00:00Z' },
        shadowProcessed: { ready: true, sampleCount: 118, center: 17_990_000, scale: 240_000, standardizedResidual: 0.13, lastLearnedAt: '2026-01-01T00:00:00Z' },
        learningDecision: 'Learned',
        learningBlockReason: 'Learned',
        processedQuality: 'Nominal',
        processedFlags: [],
        lastPersistentShiftAt: null,
        learningAfterPersistentShiftCount: 0,
      },
      {
        channel: 'outlet_flow',
        rawQueryValue: null,
        authoritative: { ready: false, sampleCount: 0, center: null, scale: null, standardizedResidual: null, lastLearnedAt: null },
        shadowProcessed: { ready: false, sampleCount: 0, center: null, scale: null, standardizedResidual: null, lastLearnedAt: null },
        learningDecision: 'Blocked',
        learningBlockReason: 'RawGateBlocked',
        processedQuality: null,
        processedFlags: [],
        lastPersistentShiftAt: null,
        learningAfterPersistentShiftCount: 0,
      },
    ],
  });

  assert.ok(snapshot);
  assert.equal(snapshot!.mode, 'ShadowProcessed');
  assert.equal(snapshot!.methodVersion, 'causal-robust-v1');
  assert.equal(snapshot!.channels.length, 2);
  assert.equal(snapshot!.channels[0].authoritative.center, 18_000_000);
  assert.equal(snapshot!.channels[0].shadowProcessed.center, 17_990_000);
});

test('a missing/null center, scale, or residual stays null, never coerced to 0', () => {
  const snapshot = normalizeReferenceExperimentSnapshot({
    mode: 'ShadowProcessed',
    channels: [
      {
        channel: 'standpipe_pressure',
        authoritative: { ready: false, sampleCount: 0, center: null, scale: null, standardizedResidual: null, lastLearnedAt: null },
        shadowProcessed: { ready: false, sampleCount: 0, center: null, scale: null, standardizedResidual: null, lastLearnedAt: null },
        learningDecision: 'Blocked',
        learningBlockReason: 'MissingProcessedValue',
        processedFlags: [],
      },
    ],
  });

  assert.ok(snapshot);
  const channel = snapshot!.channels[0];
  assert.equal(channel.authoritative.center, null);
  assert.equal(channel.shadowProcessed.scale, null);
  // Never silently becomes 0 - the UI layer renders this as "--", not "0".
  assert.notEqual(channel.authoritative.center, 0);
});

test('processedFlags round-trip as an array of strings', () => {
  const snapshot = normalizeReferenceExperimentSnapshot({
    mode: 'ShadowProcessed',
    channels: [
      {
        channel: 'standpipe_pressure',
        authoritative: { ready: true, sampleCount: 10 },
        shadowProcessed: { ready: false, sampleCount: 0 },
        learningDecision: 'Blocked',
        learningBlockReason: 'ProcessedQuality=PersistentShift',
        processedQuality: 'PersistentShift',
        processedFlags: ['InnovationCandidate', 'PersistentShift'],
      },
    ],
  });

  assert.deepEqual(snapshot!.channels[0].processedFlags, ['InnovationCandidate', 'PersistentShift']);
});

test('a channel entry without a channel name is dropped rather than crashing', () => {
  const snapshot = normalizeReferenceExperimentSnapshot({
    mode: 'ShadowProcessed',
    channels: [
      { authoritative: {}, shadowProcessed: {}, learningDecision: 'Blocked', learningBlockReason: 'x' },
      { channel: 'outlet_flow', authoritative: {}, shadowProcessed: {}, learningDecision: 'Blocked', learningBlockReason: 'x' },
    ],
  });

  assert.equal(snapshot!.channels.length, 1);
  assert.equal(snapshot!.channels[0].channel, 'outlet_flow');
});

test('LearningAfterPersistentShiftCount and LastPersistentShiftAt round-trip', () => {
  const snapshot = normalizeReferenceExperimentSnapshot({
    mode: 'ShadowProcessed',
    channels: [
      {
        channel: 'standpipe_pressure',
        authoritative: { ready: true, sampleCount: 100 },
        shadowProcessed: { ready: true, sampleCount: 90 },
        learningDecision: 'Learned',
        learningBlockReason: 'Learned',
        lastPersistentShiftAt: '2026-01-01T00:00:00Z',
        learningAfterPersistentShiftCount: 3,
        framesSincePersistentShift: 7,
        learningAcceptedDuringInnovation: 0,
      },
    ],
  });

    assert.equal(snapshot!.channels[0].lastPersistentShiftAt, '2026-01-01T00:00:00Z');
    assert.equal(snapshot!.channels[0].learningAfterPersistentShiftCount, 3);
    assert.equal(snapshot!.channels[0].framesSincePersistentShift, 7);
    assert.equal(snapshot!.channels[0].learningAcceptedDuringInnovation, 0);
});
