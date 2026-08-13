import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alert, FlowDataPoint } from '../context/WellControlContext.tsx';
import {
  mergeMonitoringEvents,
  monitoringEventVisualTone,
  projectAlarmEvents,
  projectL1ObservationWindows,
  restoreFollowLatest,
  updateFollowLatestForItems,
  updateFollowLatestForScroll,
  type MonitoringEventStreamItem,
} from './monitoringEventStream.ts';

function flow(time: string, backendLevel: 0 | 1 | 2 = 1, eventId: string | null = 'observation-1'): FlowDataPoint {
  return { time, backendLevel, eventId, flowIn: 0, flowOut: 0 };
}

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    date: '2026-08-13',
    time: '10:02:00',
    lastDate: '2026-08-13',
    lastTime: '10:03:00',
    level: 'warning',
    message: '出口流量持续异常',
    acknowledged: false,
    backendEventId: 'alarm-1',
    currentBackendLevel: 2,
    backendLevel: 2,
    peakBackendLevel: 2,
    formalEvalLevel: 2,
    peakFormalEvalLevel: 2,
    activeSignals: ['flow'],
    eventState: 'active',
    pumpState: 'Drilling',
    count: 3,
    ...overrides,
  };
}

test('L1IsNeutralObservation', () => {
  const [item] = projectL1ObservationWindows([flow('2026-08-13 10:00:00')]);
  assert.equal(item.kind, 'observation');
  assert.equal(monitoringEventVisualTone(item), 'neutral');
});

test('L1DoesNotEnterBackendAlertQueue', () => {
  assert.deepEqual(projectAlarmEvents([alert({ currentBackendLevel: 1, backendLevel: 1, peakBackendLevel: 1 })]), []);
});

test('L1AndL2AppearInSameChronologicalStream', () => {
  const observations = projectL1ObservationWindows([
    flow('2026-08-13 10:00:00'),
    flow('2026-08-13 10:01:00', 0),
  ]);
  const merged = mergeMonitoringEvents(observations, projectAlarmEvents([alert()]));
  assert.deepEqual(merged.map((item) => item.kind), ['observation', 'alarm']);
});

test('SameBackendEventIdProducesOneRow', () => {
  const projected = projectAlarmEvents([
    alert({ id: 1, lastTime: '10:03:00', currentBackendLevel: 2 }),
    alert({ id: 2, lastTime: '10:04:00', currentBackendLevel: 3, backendLevel: 3, peakBackendLevel: 3 }),
  ]);
  assert.equal(projected.length, 1);
  assert.equal(projected[0].currentLevel, 3);
  assert.equal(projected[0].lastTime, '2026-08-13 10:04:00');
});

test('SameBackendEventIdProducesOneRow across L1 and L2 projections', () => {
  const observations = projectL1ObservationWindows([
    flow('2026-08-13 10:00:00', 1, 'shared-event'),
    flow('2026-08-13 10:01:00', 0),
  ]);
  const alarms = projectAlarmEvents([alert({ backendEventId: 'shared-event' })]);
  const merged = mergeMonitoringEvents(observations, alarms);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].kind, 'alarm');
});

test('L2UsesAlarmVisualPriority', () => {
  const [item] = projectAlarmEvents([alert()]);
  assert.equal(item.kind, 'alarm');
  assert.equal(monitoringEventVisualTone(item), 'amber');
});

test('RecoveredL4DoesNotRemainFullRedActiveRow', () => {
  const [item] = projectAlarmEvents([alert({
    currentBackendLevel: 0,
    backendLevel: 0,
    peakBackendLevel: 4,
    lifecycleStatus: 'ended',
  })]);
  assert.equal(item.isActive, false);
  assert.equal(monitoringEventVisualTone(item), 'neutral');
});

test('ended alarm normalizes current urgency while preserving peak', () => {
  const [item] = projectAlarmEvents([alert({
    currentBackendLevel: 4,
    backendLevel: 4,
    peakBackendLevel: 4,
    lifecycleStatus: 'ended',
  })]);
  assert.equal(item.currentLevel, 0);
  assert.equal(item.peakLevel, 4);
  assert.equal(monitoringEventVisualTone(item), 'neutral');
});

test('PeakLevelIsPreservedSeparatelyFromCurrentLevel', () => {
  const [item] = projectAlarmEvents([alert({ currentBackendLevel: 2, backendLevel: 2, peakBackendLevel: 4 })]);
  assert.equal(item.currentLevel, 2);
  assert.equal(item.peakLevel, 4);
});

test('UserScrollPausesAutoFollow', () => {
  const next = updateFollowLatestForScroll({ isFollowing: true, newEventCount: 0, itemCount: 3 }, false);
  assert.equal(next.isFollowing, false);
});

test('NewEventsDoNotStealScrollPosition', () => {
  const result = updateFollowLatestForItems({ isFollowing: false, newEventCount: 0, itemCount: 3 }, 5);
  assert.equal(result.shouldScroll, false);
  assert.equal(result.state.newEventCount, 2);
});

test('FollowLatestRestoresAutoScroll', () => {
  const restored = restoreFollowLatest({ isFollowing: false, newEventCount: 4, itemCount: 8 });
  const result = updateFollowLatestForItems(restored, 9);
  assert.equal(restored.isFollowing, true);
  assert.equal(restored.newEventCount, 0);
  assert.equal(result.shouldScroll, true);
});

test('EmptyStateOnlyWhenNoObservationAndNoAlarm', () => {
  assert.equal(mergeMonitoringEvents([], []).length, 0);
  assert.equal(mergeMonitoringEvents(projectL1ObservationWindows([flow('2026-08-13 10:00:00')]), []).length, 1);
  assert.equal(mergeMonitoringEvents([], projectAlarmEvents([alert()])).length, 1);
});

test('L1DoesNotRequireAck', () => {
  const [item] = projectL1ObservationWindows([flow('2026-08-13 10:00:00')]);
  assert.equal(item.ackStatus, 'not-required');
});

test('consecutive L1 frames form one span and non-L1 closes it', () => {
  const items = projectL1ObservationWindows([
    flow('2026-08-13 10:00:00'),
    flow('2026-08-13 10:00:30'),
    flow('2026-08-13 10:01:00', 0),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].sampleCount, 2);
  assert.equal(items[0].lifecycleStatus, 'ended');
});

test('visual tones encode L3 and active L4 independently of peak history', () => {
  const base: MonitoringEventStreamItem = {
    id: 'x', kind: 'alarm', level: 3, currentLevel: 3, peakLevel: 4,
    startTime: '10:00:00', endTime: '10:01:00', lastTime: '10:01:00',
    message: 'event', lifecycleStatus: 'active', ackStatus: 'unacknowledged',
    duration: 60_000, sampleCount: 2, isActive: true,
  };
  assert.equal(monitoringEventVisualTone(base), 'orange');
  assert.equal(monitoringEventVisualTone({ ...base, currentLevel: 4 }), 'red');
});
