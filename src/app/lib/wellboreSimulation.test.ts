import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWellboreSimulationModel } from './wellboreSimulation.ts';

function baseInput(overrides: Partial<Parameters<typeof buildWellboreSimulationModel>[0]> = {}) {
  return {
    backendLevel: 2 as const,
    flowIn: 40,
    flowOut: 43,
    flowDelta: null,
    pitGain: 0.5,
    pitVolume: 100,
    drillPipePressure: 18,
    casingPressure: 0.5,
    totalGas: 0.6,
    ...overrides,
  };
}

test('wellboreSimulation does not recompute flowDelta from flowIn/flowOut when input.flowDelta is null', () => {
  // flowOut - flowIn would be +3 if recomputed locally, but the caller
  // determined flowDelta is not computable (e.g. semantic is not true flow)
  // and passed null. The model must not fabricate a delta from raw flowIn/flowOut.
  const model = buildWellboreSimulationModel(baseInput({ flowDelta: null }));
  assert.equal(model.kickDiagnostics.severity, 0.48);
});

test('kickDiagnostics no longer exposes a synthetic influxRate/migrationVelocity', () => {
  // Round 2 cleanup: these were never physics-model outputs and were never
  // read by any UI component - removed rather than kept as fake-physical
  // fields a future caller could mistake for algorithm output.
  const model = buildWellboreSimulationModel(baseInput({ flowDelta: 3 }));
  assert.equal('influxRate' in model.kickDiagnostics, false);
  assert.equal('migrationVelocity' in model.kickDiagnostics, false);
});
