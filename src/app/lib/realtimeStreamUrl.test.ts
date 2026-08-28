import assert from 'node:assert/strict';
import test from 'node:test';
import { withMonitoringModeQuery } from './realtimeStreamUrl.ts';

test('realtime stream URL declares the realtime wire mode', () => {
  const url = withMonitoringModeQuery(new URL('http://localhost/api/realtime/wells/J001/stream'), 'realtime');
  assert.equal(url.searchParams.get('monitoringMode'), 'realtime');
});

test('history replay keeps its explicit backend wire mode', () => {
  const url = withMonitoringModeQuery(new URL('http://localhost/api/realtime/wells/J001/stream'), 'historyReplay');
  assert.equal(url.searchParams.get('monitoringMode'), 'history_replay');
});
