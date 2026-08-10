import assert from 'node:assert/strict';
import test from 'node:test';
import { annotationsFromCsv, annotationsToCsv, canReveal, createBlindAnnotation, reviseAfterReveal, validateBlindDataset } from './operationAnnotationContract.ts';

const base = { reviewId: 'OPR-0001', annotatorId: 'A1', eventKey: 'hidden', windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-01-01T00:02:00Z', segmentStart: '2026-01-01T00:00:00Z', segmentEnd: '2026-01-01T00:01:00Z', manualOperationKind: 'TrippingOut' as const, manualStringMotion: 'MovingAwayFromBottom' as const, confidence: 'Probable' as const, evidenceQuality: 'Sufficient' as const, transitionIntervalStart: '', transitionIntervalEnd: '', notes: 'raw trend only', sourceVersion: 'test', annotationVersion: 'v1' };

test('BlindModeDoesNotExposeModelLabels', () => {
  assert.throws(() => validateBlindDataset({ packVersion: 'v1', reviewWindows: [], v1FineLabel: 'forbidden' }));
  assert.doesNotThrow(() => validateBlindDataset({ packVersion: 'v1', sourceVersion: 'test', annotationVersion: 'v1', randomSeed: 1, reviewWindows: [] }));
});
test('RevealRequiresBlindSave and PreRevealLabelIsImmutableAuditRecord', () => {
  const annotation = createBlindAnnotation(base);
  assert.equal(canReveal('OPR-0001', []), false);
  assert.equal(canReveal('OPR-0001', [annotation]), true);
  assert.match(annotation.preRevealManualLabel, /TrippingOut/);
});
test('PostRevealRevisionIsTracked', () => {
  const revised = reviseAfterReveal(createBlindAnnotation(base), { ...base, manualOperationKind: 'Circulation', manualStringMotion: 'Stationary', confidence: 'Ambiguous', evidenceQuality: 'Limited', notes: 'after comparison', segmentStart: base.segmentStart, segmentEnd: base.segmentEnd }, 'reviewed overlay');
  assert.equal(revised.postRevealRevision, true); assert.equal(revised.revisionReason, 'reviewed overlay'); assert.match(revised.preRevealManualLabel, /TrippingOut/);
});
test('AnnotationExportRoundTrip', () => {
  const original = createBlindAnnotation(base); const restored = annotationsFromCsv(annotationsToCsv([original]));
  assert.deepEqual(restored, [original]);
});
