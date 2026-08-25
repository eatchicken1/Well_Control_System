import assert from 'node:assert/strict';
import test from 'node:test';
import { outletSignalSemanticFromSettings } from './systemSettingsApi.ts';

test('reads the persisted outlet semantic from the system-setting row', () => {
  assert.equal(outletSignalSemanticFromSettings([
    { key: 'outlet_signal_semantic', label: '出口通道定义', value: 'ValveOpeningProxy' },
  ]), 'ValveOpeningProxy');
});

test('accepts the backend option field name when reading older snapshots', () => {
  assert.equal(outletSignalSemanticFromSettings([
    { key: 'OutletSignalSemantic', label: 'OutletSignalSemantic', value: 'TrueVolumetricFlow' },
  ]), 'TrueVolumetricFlow');
});

test('fails closed when the setting is absent or unsupported', () => {
  assert.equal(outletSignalSemanticFromSettings([]), null);
  assert.equal(outletSignalSemanticFromSettings([
    { key: 'outlet_signal_semantic', label: '出口通道定义', value: 'UnknownProxy' },
  ]), null);
});
