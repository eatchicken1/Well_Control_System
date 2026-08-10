import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPolylineModel, frameAtTimestamp, transitionTimeline } from './operationAnnotationVisualization.ts';

const review = {
  reviewId: 'OPR-0001', eventKey: 'hidden', windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-01-01T00:00:12Z',
  frames: [
    { timestamp: '2026-01-01T00:00:00Z', signals: { spp: { value: 1, unit: 'MPa', available: true } } },
    { timestamp: '2026-01-01T00:00:03Z', signals: { spp: { value: 2, unit: 'MPa', available: true } } },
    { timestamp: '2026-01-01T00:00:06Z', signals: { spp: { value: null, unit: 'MPa', available: false } } },
    { timestamp: '2026-01-01T00:00:09Z', signals: { spp: { value: 3, unit: 'MPa', available: true } } },
  ],
} as const;

test('MissingTelemetryBreaksPolyline and UnavailableTelemetryIsNotVisuallyInterpolated', () => {
  const model = buildPolylineModel(review, 'spp');
  assert.deepEqual(model.segments.map((segment) => segment.map((point) => point.index)), [[0, 1], [3]]);
  assert.deepEqual(model.missingIndexes, [2]);
});

test('SharedCursorUsesSameTimestampAcrossPanels', () => {
  assert.equal(frameAtTimestamp(review, '2026-01-01T00:00:03Z')?.timestamp, '2026-01-01T00:00:03Z');
});

test('RevealTimelineNotOnlyLastFrame', () => {
  const frames = [{ timestamp: 'a', label: 'A' }, { timestamp: 'b', label: 'B' }, { timestamp: 'c', label: 'B' }];
  assert.deepEqual(transitionTimeline(frames, (frame) => frame.timestamp, ['label']).map((frame) => frame.timestamp), ['a', 'b']);
});
