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
  assert.equal(model.kickDiagnostics.influxRate, null);
});

test('Paddle (ValveOpeningProxy) semantics: flowDelta null means no quantitative influxRate', () => {
  const model = buildWellboreSimulationModel(baseInput({ flowIn: 40, flowOut: 45, flowDelta: null }));
  assert.equal(model.kickDiagnostics.influxRate, null);
  assert.equal(model.kickDiagnostics.migrationVelocity, undefined);
});

test('Unknown outlet semantics: flowDelta null means no quantitative flow-balance claim', () => {
  const model = buildWellboreSimulationModel(baseInput({ flowDelta: null }));
  assert.equal(model.kickDiagnostics.influxRate, null);
});

test('True flow semantics with a real signed flowDelta drives a visualization-only influxRate', () => {
  const model = buildWellboreSimulationModel(baseInput({ flowDelta: 3 }));
  assert.notEqual(model.kickDiagnostics.influxRate, null);
  assert.equal(model.kickDiagnostics.influxRateSource, 'visualization-only');
  assert.equal(model.kickDiagnostics.migrationVelocitySource, 'visualization-only');
});

test('negative flowDelta (loss, not gain) does not produce a positive influxRate contribution', () => {
  const lossModel = buildWellboreSimulationModel(baseInput({ flowDelta: -5 }));
  const noFlowModel = buildWellboreSimulationModel(baseInput({ flowDelta: 0 }));
  // Both should clamp the flow contribution to the diagnostic at the floor,
  // i.e. a loss must not count as return-flow evidence.
  assert.ok((lossModel.kickDiagnostics.influxRate ?? 0) <= (noFlowModel.kickDiagnostics.influxRate ?? 0) + 1e-9);
});

test('backendLevel 0 (normal) never produces a kick influxRate regardless of flowDelta', () => {
  const model = buildWellboreSimulationModel(baseInput({ backendLevel: 0, flowDelta: 5 }));
  assert.equal(model.kickDiagnostics.influxRate, null);
});
