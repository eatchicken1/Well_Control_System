import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOperationContextV2 } from './operationContextV2Contract.ts';

test('normalizeOperationContextV2 preserves the SHADOW diagnostic and returns null for missing or Disabled contracts', () => {
  assert.equal(normalizeOperationContextV2({}), null);
  assert.equal(normalizeOperationContextV2({ operationContextV2: { mode: 'Disabled' } }), null);
  const snapshot = normalizeOperationContextV2({ operationContextV2: {
    mode: 'ShadowV2', shadowOnly: true, status: 'CandidatePending',
    candidate: { available: true, fineLabel: '旋转钻进', kind: 'RotaryDrilling', category: 'Drilling' },
    confirmedFineLabel: '滑动钻进', hydraulicStatus: 'Boundary', hydraulicBoundary: true,
    trustedDepth: { status: 'PositiveChangePending', trustedMeasuredDepth: 3000 },
    stringMotion: { state: 'Stationary' }, validationFlags: ['WobMissingNonBlocking'],
  } });
  assert.equal(snapshot?.mode, 'ShadowV2');
  assert.equal(snapshot?.shadowOnly, true);
  assert.equal(snapshot?.candidate.fineLabel, '旋转钻进');
  assert.equal(snapshot?.trustedDepth.trustedMeasuredDepth, 3000);
});
