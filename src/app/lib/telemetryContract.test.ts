import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeObservedFlowDelta,
  outletDisplayLabel,
  outletDisplayUnit,
  isTrueFlowSemantic,
  isValveOpeningSemantic,
  readNullableNumber,
} from './telemetryContract.ts';

test('Qout=null Qin=40 → flowDelta=null', () => {
  assert.equal(computeObservedFlowDelta(40, null, 'TrueVolumetricFlow'), null);
});

test('Qin=null Qout=38 → flowDelta=null', () => {
  assert.equal(computeObservedFlowDelta(null, 38, 'TrueVolumetricFlow'), null);
});

test('TrueFlow: Qin=40 Qout=38 → flowDelta=-2', () => {
  assert.equal(computeObservedFlowDelta(40, 38, 'TrueVolumetricFlow'), -2);
});

test('TrueFlow: Qin=40 Qout=43 → flowDelta=+3', () => {
  assert.equal(computeObservedFlowDelta(40, 43, 'TrueReturnFlow'), 3);
});

test('ValveOpeningProxy: Qin=40 Qout=45(%) → flowDelta=null', () => {
  assert.equal(computeObservedFlowDelta(40, 45, 'ValveOpeningProxy'), null);
});

test('UnknownProxy → flowDelta=null', () => {
  assert.equal(computeObservedFlowDelta(40, 42, 'UnknownProxy'), null);
});

test('undefined semantic → flowDelta=null', () => {
  assert.equal(computeObservedFlowDelta(40, 42, undefined), null);
});

test('outlet semantic label: TrueFlow → 出口流量', () => {
  assert.equal(outletDisplayLabel('TrueVolumetricFlow'), '出口流量');
  assert.equal(outletDisplayLabel('TrueReturnFlow'), '出口流量');
});

test('outlet semantic label: proxy → 出口流量', () => {
  assert.equal(outletDisplayLabel('ValveOpeningProxy'), '出口流量');
});

test('outlet semantic label: Unknown → 出口流量', () => {
  assert.equal(outletDisplayLabel('UnknownProxy'), '出口流量');
  assert.equal(outletDisplayLabel(undefined), '出口流量');
});

test('outlet display unit: ValveOpening → %', () => {
  assert.equal(outletDisplayUnit('ValveOpeningProxy', 'L/s'), '%');
});

test('outlet display unit: TrueFlow with configured unit', () => {
  assert.equal(outletDisplayUnit('TrueVolumetricFlow', 'L/s'), 'L/s');
});

test('outlet display unit: TrueFlow without configured unit → L/s default', () => {
  assert.equal(outletDisplayUnit('TrueVolumetricFlow', undefined), 'L/s');
  assert.equal(outletDisplayUnit('TrueReturnFlow', 'unknown'), 'L/s');
});

test('outlet display unit: Unknown → --', () => {
  assert.equal(outletDisplayUnit('UnknownProxy', undefined), '--');
  assert.equal(outletDisplayUnit(undefined, 'unknown'), '--');
});

test('readNullableNumber returns null for missing key', () => {
  assert.equal(readNullableNumber({ a: 1 }, ['b', 'c']), null);
});

test('readNullableNumber returns value for present key', () => {
  assert.equal(readNullableNumber({ flowIn: 40 }, ['flowIn']), 40);
});

test('readNullableNumber returns null for empty string', () => {
  assert.equal(readNullableNumber({ x: '' }, ['x']), null);
});

test('readNullableNumber returns null for non-finite', () => {
  assert.equal(readNullableNumber({ x: 'NaN' }, ['x']), null);
  assert.equal(readNullableNumber({ x: Infinity }, ['x']), null);
});

test('isTrueFlowSemantic identifies true flow variants', () => {
  assert.equal(isTrueFlowSemantic('TrueVolumetricFlow'), true);
  assert.equal(isTrueFlowSemantic('TrueReturnFlow'), true);
  assert.equal(isTrueFlowSemantic('ValveOpeningProxy'), false);
  assert.equal(isTrueFlowSemantic('UnknownProxy'), false);
  assert.equal(isTrueFlowSemantic(undefined), false);
});

test('isValveOpeningSemantic identifies valve opening', () => {
  assert.equal(isValveOpeningSemantic('ValveOpeningProxy'), true);
  assert.equal(isValveOpeningSemantic('TrueVolumetricFlow'), false);
  assert.equal(isValveOpeningSemantic(undefined), false);
});
