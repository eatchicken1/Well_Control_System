import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annotationsFromCsv, annotationsToCsv, canCreateBlindSegment, canMutateBlindTopology, canReveal, canShowFutureNet, createBlindAnnotation, createRevealAuditEvent,
  isReviewRevealed, primaryBlindRecords, reviseAfterReveal, validateBlindDataset, validateBlindWindowCompletion,
} from './operationAnnotationContract.ts';

const review = {
  reviewId: 'OPR-0001', eventKey: 'hidden', windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-01-01T00:02:30Z',
  frames: [
    { timestamp: '2026-01-01T00:00:00Z', signals: {} }, { timestamp: '2026-01-01T00:00:30Z', signals: {} },
    { timestamp: '2026-01-01T00:01:00Z', signals: {} }, { timestamp: '2026-01-01T00:02:30Z', signals: {} },
  ],
} as const;
const base = { reviewId: review.reviewId, annotatorId: 'A1', eventKey: 'hidden', windowStart: review.windowStart, windowEnd: review.windowEnd,
  segmentStart: review.frames[0].timestamp, segmentEnd: review.frames.at(-1)!.timestamp, manualOperationKind: 'TrippingOut' as const,
  manualStringMotion: 'MovingAwayFromBottom' as const, confidence: 'Probable' as const, evidenceQuality: 'Sufficient' as const,
  transitionIntervalStart: '', transitionIntervalEnd: '', notes: 'raw trend only', sourceVersion: 'test', annotationVersion: 'v2' };
const record = (patch = {}, id = 'blind-1') => createBlindAnnotation({ ...base, ...patch }, id, '2026-01-01T00:03:00Z');

test('BlindModeDoesNotExposeModelLabels or SelectionStrata', () => {
  for (const forbidden of ['v1FineLabel', 'futureNetBitDepth8s', 'selectionStrata', 'pumpGateStatus'])
    assert.throws(() => validateBlindDataset({ packVersion: 'v2', reviewWindows: [], [forbidden]: 'forbidden' }));
  assert.doesNotThrow(() => validateBlindDataset({ packVersion: 'v2', sourceVersion: 'test', annotationVersion: 'v2', randomSeed: 1, reviewWindows: [] }));
});

test('RevealAfterSinglePartialSegmentIsRejected and BlindGapIsRejected', () => {
  const partial = record({ segmentEnd: '2026-01-01T00:00:30Z' });
  assert.equal(canReveal(review, [partial]), false);
  assert.match(validateBlindWindowCompletion(review, [partial]).issues.join('|'), /UNLABELED_GAP/);
});

test('CompleteBlindCoverageAllowsReveal', () => assert.equal(canReveal(review, [record()]), true));

test('OverlappingBlindSegmentsAreRejected', () => {
  const first = record({ segmentEnd: '2026-01-01T00:01:00Z' }, 'blind-1');
  const second = record({ segmentStart: '2026-01-01T00:00:30Z' }, 'blind-2');
  assert.match(validateBlindWindowCompletion(review, [first, second]).issues.join('|'), /OVERLAP/);
});

test('SegmentOutsideWindowRejected and ZeroLengthSegmentRejected', () => {
  assert.match(validateBlindWindowCompletion(review, [record({ segmentStart: '2025-12-31T23:59:59Z' })]).issues.join('|'), /OUTSIDE_WINDOW/);
  assert.match(validateBlindWindowCompletion(review, [record({ segmentEnd: review.frames[0].timestamp })]).issues.join('|'), /ZERO_OR_NEGATIVE_LENGTH/);
});

test('UnknownSegmentCanExplicitlyCoverAmbiguousInterval and InsufficientTelemetryCanExplicitlyCoverMissingInterval', () => {
  assert.equal(canReveal(review, [record({ manualOperationKind: 'Unknown', manualStringMotion: 'Unknown' })]), true);
  assert.equal(canReveal(review, [record({ manualOperationKind: 'InsufficientTelemetry', manualStringMotion: 'InsufficientTelemetry' })]), true);
});

test('NoNewPreRevealAnnotationAfterReveal and PostRevealDeleteSplitMergeAreBlocked', () => {
  assert.equal(canCreateBlindSegment(true), false);
  assert.equal(canMutateBlindTopology(true), false);
  assert.equal(canCreateBlindSegment(false), true);
});

test('RevealAuditEventRoundTripKeepsWindowFrozen', () => {
  const original = record(); const reveal = createRevealAuditEvent(review, 'A1', 'test', 'v2', 'reveal-1', '2026-01-01T00:04:00Z');
  const restored = annotationsFromCsv(annotationsToCsv([original, reveal]));
  assert.equal(isReviewRevealed(review.reviewId, restored), true);
  assert.equal(canCreateBlindSegment(isReviewRevealed(review.reviewId, restored)), false);
});

test('FutureNetHiddenBeforeReveal', () => {
  assert.equal(canShowFutureNet(false), false);
  assert.equal(canShowFutureNet(true), true);
});

test('PostRevealEditIsTracked and OriginalBlindAnnotationIsImmutable', () => {
  const original = record(); const snapshot = original.preRevealSnapshot;
  const revision = reviseAfterReveal(original, { manualOperationKind: 'Circulation', manualStringMotion: 'Stationary', confidence: 'Ambiguous', evidenceQuality: 'Limited', notes: 'after comparison', segmentStart: base.segmentStart, segmentEnd: base.segmentEnd, transitionIntervalStart: '', transitionIntervalEnd: '' }, 'reviewed overlay', 'revision-1', '2026-01-01T00:04:00Z');
  assert.equal(revision.recordType, 'PostRevealRevision'); assert.equal(revision.originalAnnotationId, original.annotationId); assert.equal(revision.notPartOfPrimaryBlindGroundTruth, true);
  assert.equal(original.preRevealSnapshot, snapshot); assert.equal(original.manualOperationKind, 'TrippingOut');
});

test('PrimaryExportPreservesPreRevealSnapshot and AnnotationExportRoundTrip', () => {
  const original = record(); const revision = reviseAfterReveal(original, { manualOperationKind: 'Circulation', manualStringMotion: 'Stationary', confidence: 'Ambiguous', evidenceQuality: 'Limited', notes: 'after', segmentStart: base.segmentStart, segmentEnd: base.segmentEnd, transitionIntervalStart: '', transitionIntervalEnd: '' }, 'reason', 'revision-1', '2026-01-01T00:04:00Z');
  const primary = annotationsToCsv([original, revision], true); const restored = annotationsFromCsv(primary);
  assert.deepEqual(restored, [original]); assert.equal(primaryBlindRecords([original, revision]).length, 1);
});
