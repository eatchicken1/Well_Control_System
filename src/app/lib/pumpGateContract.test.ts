import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePumpGateDiagnostics } from './pumpGateContract.ts';

test('normalizePumpGateDiagnostics returns null when a Disabled or older backend omits both diagnostics', () => {
  assert.equal(normalizePumpGateDiagnostics({}), null);
  assert.equal(normalizePumpGateDiagnostics({ pumpConfiguration: null, stablePumpingGate: null }), null);
});

test('normalizePumpGateDiagnostics preserves admitted zero and never turns missing SPM into Off', () => {
  const snapshot = normalizePumpGateDiagnostics({
    pumpConfiguration: {
      spm1: 60,
      spm2: 60,
      spm3: 0,
      totalSpm: 120,
      complete: true,
      activeMask: 3,
      configurationSignature: 'mask=011;spm=60.0/60.0/0.0',
      pump1State: 'On',
      pump2State: 'On',
      pump3State: 'Off',
      anyRunning: true,
      allStopped: false,
    },
    stablePumpingGate: {
      mode: 'Shadow',
      status: 'Stable',
      eligibleForPrecursor: true,
      configurationStable: true,
      qinStable: true,
      perPumpRatesStable: true,
      stableSince: '2026-01-01T00:00:00Z',
      lastBoundaryAt: null,
      boundaryReasons: [],
      reason: 'stable dwell satisfied',
    },
  });

  assert.ok(snapshot);
  assert.equal(snapshot!.configuration.spm3, 0);
  assert.equal(snapshot!.configuration.pump3State, 'Off');
  assert.equal(snapshot!.configuration.activeMask, 3);
  assert.equal(snapshot!.gate.status, 'Stable');
  assert.equal(snapshot!.gate.mode, 'Shadow');
  assert.equal(snapshot!.gate.eligibleForPrecursor, true);
});

test('normalizePumpGateDiagnostics accepts snake_case and preserves Unavailable reasons', () => {
  const snapshot = normalizePumpGateDiagnostics({
    pump_configuration: { spm_1: 60, spm_2: 60, spm_3: null, complete: false, active_mask: null, pump_1_state: 'On', pump_2_state: 'On', pump_3_state: 'Unknown' },
    stable_pumping_gate: { mode: 'Shadow', status: 'Unavailable', eligible_for_precursor: false, boundary_reasons: ['TelemetryIncomplete'], reason: 'TelemetryIncomplete' },
  });

  assert.ok(snapshot);
  assert.equal(snapshot!.configuration.spm3, null);
  assert.equal(snapshot!.configuration.pump3State, 'Unknown');
  assert.equal(snapshot!.configuration.activeMask, null);
  assert.equal(snapshot!.gate.mode, 'Shadow');
  assert.deepEqual(snapshot!.gate.boundaryReasons, ['TelemetryIncomplete']);
});
