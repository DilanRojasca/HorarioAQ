import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { registerObservers } from '../../src/shared/registerObservers';
import { SseHub } from '../../src/modules/realtime/SseHub';
import {
  InMemoryNotifications, InMemorySyncRuns, InMemoryUsers, RecordingAudit, RecordingEmail, session,
} from '../helpers/inMemory';

const INSIDE = new Date('2026-10-09T15:00:00Z'); // 10:00 Bogotá

describe('registerObservers', () => {
  const setup = () => {
    const log = new InMemoryEventLog();
    const bus = new EventBus({ log, sleep: async () => {} });
    const deps = {
      audit: new RecordingAudit(), syncRuns: new InMemorySyncRuns(), notifications: new InMemoryNotifications(),
      users: new InMemoryUsers([{ id: 'u1', name: 'Ana', email: 'ana@horariouni.test', passwordHash: 'h', role: 'STUDENT', active: true }]),
      email: new RecordingEmail(), hub: new SseHub(), sendWindow: { start: 6, end: 22, timeZone: 'America/Bogota' }, now: () => INSIDE,
    };
    registerObservers(bus, deps);
    const order = (type: string) => log.events.filter((e) => e.type === type).map((e) =>
      log.deliveries.filter((d) => d.eventId === e.id).map((d) => d.delivery.observer));
    return { bus, log, deps, order };
  };

  it('ScheduleChanged: audit → notifications → realtime-schedule; NotificationCreated: realtime-notification → email', async () => {
    const { bus, deps, order } = setup();
    const s = session({ externalId: 'u1-X' });
    await bus.publish('ScheduleChanged', {
      userId: 'u1', semester: '2026-2', initialLoad: false,
      changes: [{ type: 'ADDED', externalId: 'u1-X', userId: 'u1', after: s }],
    });
    await bus.idle();
    expect(order('ScheduleChanged')).toEqual([['audit', 'notifications', 'realtime-schedule']]);
    expect(order('NotificationCreated')).toEqual([['realtime-notification', 'email']]);
    expect(deps.audit.entries).toHaveLength(1);
    expect(deps.email.sent).toHaveLength(1);
  });

  it('SyncCompleted: sync-stats guarda el desglose en la corrida', async () => {
    const { bus, deps, order } = setup();
    const run = await deps.syncRuns.tryStart('MANUAL');
    await bus.publish('SyncCompleted', {
      runId: run!.id, trigger: 'MANUAL', studentsSynced: 1, changesCount: 3, failures: 0,
      changesByType: { ADDED: 1, UPDATED: 1, CANCELLED: 1 },
    });
    expect(order('SyncCompleted')).toEqual([['sync-stats']]);
    expect(deps.syncRuns.runs[0].stats).toEqual({ added: 1, updated: 1, cancelled: 1 });
  });
});
