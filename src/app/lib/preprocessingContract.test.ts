import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePreprocessingSnapshot } from './preprocessingContract.ts';

test('normalizePreprocessingSnapshot returns null when the field is absent (Disabled mode / older backend)', () => {
  assert.equal(normalizePreprocessingSnapshot(undefined), null);
  assert.equal(normalizePreprocessingSnapshot(null), null);
  assert.equal(normalizePreprocessingSnapshot('not-an-object'), null);
});

test('normalizePreprocessingSnapshot parses a well-formed Shadow response', () => {
  const snapshot = normalizePreprocessingSnapshot({
    mode: 'Shadow',
    version: 'causal-robust-v1',
    ready: true,
    availableChannels: 15,
    suspectChannels: 2,
    signals: [
      {
        channel: 'standpipe_pressure',
        unit: 'Pa',
        rawValue: 18_000_000,
        processedValue: 18_000_000,
        noiseSigma: 20_000,
        robustZ: 0.1,
        quality: 'Nominal',
        flags: [],
      },
      {
        channel: 'hook_load',
        unit: 'N',
        rawValue: null,
        processedValue: null,
        noiseSigma: null,
        robustZ: null,
        quality: 'Warming',
        flags: ['InsufficientHistory'],
      },
    ],
  });

  assert.ok(snapshot);
  assert.equal(snapshot!.mode, 'Shadow');
  assert.equal(snapshot!.availableChannels, 15);
  assert.equal(snapshot!.suspectChannels, 2);
  assert.equal(snapshot!.signals.length, 2);
  assert.equal(snapshot!.signals[0].rawValue, 18_000_000);
});

test('a missing/null processed or raw value stays null, never coerced to 0', () => {
  const snapshot = normalizePreprocessingSnapshot({
    mode: 'Shadow',
    signals: [
      { channel: 'hook_load', unit: 'N', rawValue: null, processedValue: null, quality: 'Warming', flags: [] },
    ],
  });

  assert.ok(snapshot);
  const signal = snapshot!.signals[0];
  assert.equal(signal.rawValue, null);
  assert.equal(signal.processedValue, null);
  // Never silently becomes 0 - the UI layer renders this as "--", not "0".
  assert.notEqual(signal.rawValue, 0);
});

test('quality flags round-trip as an array of strings', () => {
  const snapshot = normalizePreprocessingSnapshot({
    mode: 'Shadow',
    signals: [
      { channel: 'standpipe_pressure', unit: 'Pa', quality: 'PersistentShift', flags: ['InnovationCandidate', 'PersistentShift'] },
    ],
  });

  assert.deepEqual(snapshot!.signals[0].flags, ['InnovationCandidate', 'PersistentShift']);
});

test('a signal entry without a channel name is dropped rather than crashing', () => {
  const snapshot = normalizePreprocessingSnapshot({
    mode: 'Shadow',
    signals: [
      { unit: 'Pa', quality: 'Nominal', flags: [] },
      { channel: 'rpm', unit: 'rpm', quality: 'Nominal', flags: [] },
    ],
  });

  assert.equal(snapshot!.signals.length, 1);
  assert.equal(snapshot!.signals[0].channel, 'rpm');
});
