import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { SseHub, SseWritable } from '../../src/modules/realtime/SseHub';
import { registerRealtimeObserver } from '../../src/modules/realtime/RealtimeObserver';
import { session } from '../helpers/inMemory';

const INSIDE = new Date('2026-10-09T15:00:00Z'); // 10:00 Bogotá
const NIGHT = new Date('2026-10-09T08:00:00Z'); // 03:00 Bogotá

const sink = () => {
  const chunks: string[] = [];
  const res: SseWritable = { write: (c) => { chunks.push(c); return true; }, end: () => {}, on: () => res };
  return { res, events: () => chunks.join('').split('\n\n').filter((f) => f.includes('event: ') && !f.includes('ready')) };
};
const note = { notificationId: 'n1', userId: 'u1', title: 'T', message: 'M', kind: 'SCHEDULE_ADDED' as const };

describe('registerRealtimeObserver', () => {
  let bus: EventBus, hub: SseHub, out: ReturnType<typeof sink>, now: Date;

  beforeEach(() => {
    bus = new EventBus({ sleep: async () => {} });
    hub = new SseHub();
    out = sink();
    hub.connect('u1', out.res);
    now = INSIDE;
    registerRealtimeObserver(bus, hub, { now: () => now });
  });

  const change = () => {
    const s = session();
    return { type: 'ADDED' as const, externalId: s.externalId, userId: 'u1', after: s };
  };

  it('schedule-changed se envía siempre, incluso a las 03:00 Bogotá', async () => {
    now = NIGHT;
    await bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [change(), change()], initialLoad: false });
    await bus.idle();
    expect(out.events()).toEqual(['event: schedule-changed\ndata: {"semester":"2026-2","count":2}']);
  });

  it('notification se envía dentro de la ventana', async () => {
    await bus.publish('NotificationCreated', note);
    await bus.idle();
    expect(out.events()).toEqual([
      'event: notification\ndata: {"id":"n1","title":"T","message":"M","kind":"SCHEDULE_ADDED"}',
    ]);
  });

  it('notification no se envía fuera de la ventana', async () => {
    now = NIGHT;
    await bus.publish('NotificationCreated', note);
    await bus.idle();
    expect(out.events()).toEqual([]);
  });

  it('ignora las re-publicaciones (replay) para no duplicar el push', async () => {
    await bus.publish('NotificationCreated', { ...note, replay: true });
    await bus.idle();
    expect(out.events()).toEqual([]);
  });

  it('sin conexiones del usuario no falla', async () => {
    await bus.publish('NotificationCreated', { ...note, userId: 'otro' });
    const report = await bus.publish('ScheduleChanged', { userId: 'otro', semester: 's', changes: [], initialLoad: false });
    await bus.idle();
    expect(report.deliveries.every((d) => d.status === 'OK')).toBe(true);
  });
});
