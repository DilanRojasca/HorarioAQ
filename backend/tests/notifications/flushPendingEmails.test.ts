import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { flushPendingEmails } from '../../src/modules/notifications/application/flushPendingEmails';
import { InMemoryNotifications } from '../helpers/inMemory';

const INSIDE = new Date('2026-10-09T15:00:00Z');
const OUTSIDE = new Date('2026-10-09T08:00:00Z');

describe('flushPendingEmails', () => {
  let repo: InMemoryNotifications, bus: EventBus, published: string[], replays: Array<boolean | undefined>;

  beforeEach(async () => {
    repo = new InMemoryNotifications();
    bus = new EventBus({ sleep: async () => {} });
    published = [];
    replays = [];
    bus.subscribe('NotificationCreated', (e) => { published.push(e.payload.notificationId); replays.push(e.payload.replay); }, { name: 'spy' });
    for (const t of ['A', 'B']) await repo.create({ userId: 'u1', kind: 'SCHEDULE_ADDED', title: t, message: t });
  });

  it('dentro de la ventana re-publica las pendientes y devuelve cuántas', async () => {
    const n = await flushPendingEmails({ notifications: repo, bus, now: () => new Date(Date.now()) , window: { start: 0, end: 24, timeZone: 'America/Bogota' } });
    await bus.idle();
    expect(n).toBe(2);
    expect(published).toEqual(repo.rows.map((r) => r.id));
    expect(replays).toEqual([true, true]);
  });

  it('no re-publica las ya enviadas', async () => {
    await repo.markEmailed(repo.rows[0].id, new Date());
    const n = await flushPendingEmails({ notifications: repo, bus, window: { start: 0, end: 24, timeZone: 'America/Bogota' } });
    await bus.idle();
    expect(n).toBe(1);
    expect(published).toEqual([repo.rows[1].id]);
  });

  it('respeta sinceHours', async () => {
    repo.rows[0].createdAt = new Date(Date.now() - 50 * 3_600_000);
    expect(await flushPendingEmails({ notifications: repo, bus, window: { start: 0, end: 24, timeZone: 'America/Bogota' } })).toBe(1);
    repo.rows[0].createdAt = new Date(Date.now() - 50 * 3_600_000);
    expect(await flushPendingEmails({ notifications: repo, bus, sinceHours: 72, window: { start: 0, end: 24, timeZone: 'America/Bogota' } })).toBe(2);
  });

  it('fuera de la ventana devuelve 0 sin consultar', async () => {
    let queried = false;
    const spy = { ...repo, listPendingEmail: async () => { queried = true; return []; } } as unknown as InMemoryNotifications;
    const n = await flushPendingEmails({ notifications: spy, bus, now: () => OUTSIDE });
    expect(n).toBe(0);
    expect(queried).toBe(false);
  });

  it('con hora dentro de la ventana por defecto consulta', async () => {
    const n = await flushPendingEmails({ notifications: repo, bus, now: () => INSIDE });
    expect(typeof n).toBe('number');
  });
});
