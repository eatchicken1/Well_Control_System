import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePrecursorEligibility } from './precursorEligibilityContract.ts';

test('normalizePrecursorEligibility returns null when PumpGate is Disabled or an older backend omits the diagnostic', () => {
  assert.equal(normalizePrecursorEligibility({}), null);
  assert.equal(normalizePrecursorEligibility({ precursorEligibility: null }), null);
});

test('normalizePrecursorEligibility preserves backend statuses, roles, and machine-readable reasons without inference', () => {
  const snapshot = normalizePrecursorEligibility({
    precursorEligibility: {
      pumpGateMode: 'Shadow',
      eventTime: '2026-01-01T00:00:00Z',
      hydraulic: { status: 'Stable', eligible: true, reasons: [], reason: 'stable' },
      pressure: { status: 'Eligible', hydraulicEligible: true, operationEligible: true, telemetryAvailable: true, reasons: [], reason: 'interpretable' },
      mechanical: {
        status: 'Blocked', hydraulicEligible: true, operationEligible: true, mechanicalTransient: true, reasons: ['MechanicalTransient'], reason: 'transient',
        channels: [
          { channel: 'wob', role: 'ControlInput', status: 'Blocked', operationApplicable: true, hydraulicEligible: true, telemetryAvailable: true, reasons: ['MechanicalTransient'], reason: 'control changed' },
          { channel: 'hook_height', role: 'MotionContext', status: 'Eligible', operationApplicable: true, hydraulicEligible: true, telemetryAvailable: true, reasons: ['ObservedAsMotionContext'], reason: 'context only' },
        ],
      },
      reason: 'diagnostic only',
    },
  });

  assert.ok(snapshot);
  assert.equal(snapshot!.pumpGateMode, 'Shadow');
  assert.equal(snapshot!.hydraulic.status, 'Stable');
  assert.equal(snapshot!.pressure.status, 'Eligible');
  assert.equal(snapshot!.mechanical.channels[0].role, 'ControlInput');
  assert.equal(snapshot!.mechanical.channels[1].status, 'Eligible');
  assert.deepEqual(snapshot!.mechanical.reasons, ['MechanicalTransient']);
});
