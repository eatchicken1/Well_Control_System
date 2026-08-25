import assert from 'node:assert/strict';
import test from 'node:test';
import { determineAlarmCue, getAlarmSoundPreference, type AlarmCueSource } from './alarmNotification.ts';

function event(eventId: string, level: number, acknowledged = false): AlarmCueSource {
  return { eventId, level, acknowledged };
}

test('first hydration is silent and does not replay historical alarms', () => {
  const result = determineAlarmCue([event('l3-existing', 3)], new Map(), false);
  assert.equal(result.cue, null);
  assert.equal(result.nextLevels.get('l3-existing'), 3);
});

test('sound is opt-in until a browser user gesture enables it', () => {
  assert.equal(getAlarmSoundPreference(), false);
});

test('a new L2 event receives a visual-only cue', () => {
  const result = determineAlarmCue([event('l2-new', 2)], new Map(), true);
  assert.deepEqual(result.cue, { eventId: 'l2-new', level: 2, playSound: false });
});

test('a new L3+ event receives the highest-priority audible cue', () => {
  const result = determineAlarmCue([event('l3-new', 3), event('l4-new', 4)], new Map(), true);
  assert.deepEqual(result.cue, { eventId: 'l4-new', level: 4, playSound: true });
});

test('an unchanged polling result never replays a sound', () => {
  const result = determineAlarmCue([event('l3-existing', 3)], new Map([['l3-existing', 3]]), true);
  assert.equal(result.cue, null);
});

test('a transient empty reconnect does not forget an event ID', () => {
  const disconnected = determineAlarmCue([], new Map([['l3-existing', 3]]), true);
  const reconnected = determineAlarmCue([event('l3-existing', 3)], disconnected.nextLevels, true);
  assert.equal(reconnected.cue, null);
});

test('an escalation cues once while acknowledgement suppresses notifications', () => {
  const escalated = determineAlarmCue([event('same-event', 4)], new Map([['same-event', 3]]), true);
  assert.deepEqual(escalated.cue, { eventId: 'same-event', level: 4, playSound: true });
  const acknowledged = determineAlarmCue([event('same-event', 4, true)], new Map([['same-event', 3]]), true);
  assert.equal(acknowledged.cue, null);
});
