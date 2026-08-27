import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fallbackQueueCandidateFromFrame,
  mergeQueueAlertSnapshot,
} from './alertQueueProjection.ts';

const frameOnlyL2 = {
  eventId: 'candidate-27',
  candidateId: 27,
  publicLevel: 2,
  formalEvalLevel: 2,
  reason: '出口流量持续偏离',
  activeSignals: ['flow_out'],
  eventState: 'tracking',
  pumpState: 'Drilling',
  timestamp: '2025-08-25 04:52:58',
  startTime: '2025-08-25 04:52:58',
  sampleCount: 1,
};

test('L2 frame without log_entries is converted into a queue candidate', () => {
  assert.deepEqual(fallbackQueueCandidateFromFrame(frameOnlyL2), frameOnlyL2);
});

test('an empty warning refresh does not remove the same well\'s local L2 queue event', () => {
  const localL2 = {
    wellId: 'rt_000004',
    backendEventId: 'rt_000004:candidate-27',
    backendLevel: 2,
    peakBackendLevel: 2,
  };

  assert.deepEqual(
    mergeQueueAlertSnapshot([localL2], [], 'rt_000004'),
    [localL2],
  );
});

test('raw live lifecycle frames retain the same event through L0 recovery and resolution', () => {
  const base = {
    eventId: 'rt-abc:candidate-1', candidateId: 1, publicLevel: 3, formalEvalLevel: 3,
    reason: 'pressure', activeSignals: ['pressure'], pumpState: 'Drilling',
    timestamp: '2025-08-25T04:52:58Z', startTime: '2025-08-25T04:52:58Z', sampleCount: 1,
  };
  const open = fallbackQueueCandidateFromFrame({ ...base, advisoryLevel: 3, eventState: 'Open' });
  const recovery = fallbackQueueCandidateFromFrame({ ...base, advisoryLevel: 0, eventState: 'Recovery' });
  const resolved = fallbackQueueCandidateFromFrame({ ...base, advisoryLevel: 0, eventState: 'Resolved' });
  assert.equal(open?.eventId, 'rt-abc:candidate-1');
  assert.equal(recovery?.eventId, open?.eventId);
  assert.equal(resolved?.eventId, open?.eventId);
  assert.equal(resolved?.advisoryLevel, 0);
});
