import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSourceDateTime,
  formatSourceDate,
  formatSourceTime,
  parseSourceDateMs,
  shiftSourceTimestamp,
  toSourceDateTimeOffset,
} from './sourceTime.ts';

test('offset-less source civil time is always interpreted as UTC+08:00', () => {
  assert.equal(
    parseSourceDateMs('2026-08-28 23:00:00'),
    Date.parse('2026-08-28T15:00:00.000Z'),
  );
});

test('offset-aware timestamps preserve their instant and display in source time', () => {
  const instant = '2026-08-28T15:00:00.1234567Z';
  assert.equal(formatSourceDateTime(instant), '2026-08-28 23:00:00');
  assert.equal(formatSourceDate(instant), '2026-08-28');
  assert.equal(formatSourceTime(instant), '23:00:00');
});

test('API cursor conversion does not depend on the browser timezone', () => {
  assert.equal(toSourceDateTimeOffset('2026-08-28 23:00:00.123456'), '2026-08-28T23:00:00.123456+08:00');
  assert.equal(toSourceDateTimeOffset('2026-08-28T15:00:00Z'), '2026-08-28T15:00:00.000Z');
});

test('source-civil cursor shifting keeps the exact second boundary', () => {
  assert.equal(shiftSourceTimestamp('2026-08-28 23:00:00', 1000), '2026-08-28 23:00:01');
  assert.equal(shiftSourceTimestamp('2026-08-28 23:59:59', 1000), '2026-08-29 00:00:00');
});

