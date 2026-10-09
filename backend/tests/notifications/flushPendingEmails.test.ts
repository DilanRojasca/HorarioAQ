import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { flushPendingEmails } from '../../src/modules/notifications/application/flushPendingEmails';
import { registerEmailObserver } from '../../src/modules/notifications/application/EmailObserver';
import { MAX_EMAIL_ATTEMPTS } from '../../src/modules/notifications/application/ports';
import { InMemoryNotifications, InMemoryUsers, RecordingEmail } from '../helpers/inMemory';

const NOW = new Date('2026-10-09T15:00:00Z'); // 10:00 Bogotá
const OUTSIDE = new Date('2026-10-09T08:00:00Z'); // 03:00 Bogotá
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('flushPendingEmails', () => {
  let repo: InMemoryNotifications, bus: EventBus, published: string[], replays: Array<boolean | undefined>;
  const flush = (over: object = {}) => flushPendingEmails({ notifications: repo, bus, now: () => NOW, ...over });
  const make = async (title: string, createdAt: Date) => {
    const n = await repo.create({ userId: 'u1', kind: 'SCHEDULE_ADDED', title, message: title });
    n.createdAt = createdAt;
    return n;
  };

  beforeEach(() => {
    repo = new InMemoryNotifications();
    bus = new EventBus({ sleep: async () => {} });
    published = [];
    replays = [];
    bus.subscribe('NotificationCreated', (e) => { published.push(e.payload.notificationId); replays.push(e.payload.replay); }, { name: 'spy' });
  });

  it('dentro de la ventana re-publica las pendientes, las más antiguas primero, con replay: true', async () => {
    const newer = await make('B', hoursAgo(1));
    const older = await make('A', hoursAgo(5));
    expect(await flush()).toBe(2);
    await bus.idle();
    expect(published).toEqual([older.id, newer.id]);
    expect(replays).toEqual([true, true]);
  });

  it('no re-publica las ya enviadas', async () => {
    const sent = await make('A', hoursAgo(1));
    const pending = await make('B', hoursAgo(1));
    await repo.claimEmail(sent.id, NOW);
    expect(await flush()).toBe(1);
    await bus.idle();
    expect(published).toEqual([pending.id]);
  });

  it('ventana de 48 h por defecto y sinceHours configurable', async () => {
    await make('vieja', hoursAgo(50));
    const fresh = await make('nueva', hoursAgo(47));
    expect(await flush()).toBe(1);
    await bus.idle();
    expect(published).toEqual([fresh.id]);
    expect(await flush({ sinceHours: 72 })).toBe(2);
  });

  it('tope de 100 notificaciones por ejecución', async () => {
    for (let i = 0; i < 101; i++) await make(`n${i}`, hoursAgo(1));
    expect(await flush()).toBe(100);
  });

  it('fuera de la ventana devuelve 0 sin consultar al repositorio', async () => {
    let queried = false;
    repo.listPendingEmail = async () => { queried = true; return []; };
    expect(await flush({ now: () => OUTSIDE })).toBe(0);
    expect(queried).toBe(false);
  });

  it('sin pendientes no publica nada', async () => {
    expect(await flush()).toBe(0);
    await bus.idle();
    expect(published).toEqual([]);
  });

  it('las omitidas y las que alcanzaron el tope de intentos no se recogen y no bloquean a las nuevas', async () => {
    const skipped = await make('omitida', hoursAgo(10));
    const stuck = await make('atascada', hoursAgo(9));
    const fresh = await make('nueva', hoursAgo(1));
    await repo.markEmailSkipped(skipped.id, NOW);
    stuck.emailAttempts = MAX_EMAIL_ATTEMPTS;
    expect(await flush()).toBe(1);
    await bus.idle();
    expect(published).toEqual([fresh.id]);
    stuck.emailAttempts = MAX_EMAIL_ATTEMPTS - 1;
    expect(await flush()).toBe(2);
  });

  it('ejecuciones solapadas: la segunda vuelve de inmediato con 0', async () => {
    await make('A', hoursAgo(1));
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const orig = repo.listPendingEmail.bind(repo);
    repo.listPendingEmail = async (s, l) => { await gate; return orig(s, l); };
    const first = flush();
    expect(await flush()).toBe(0);
    release();
    expect(await first).toBe(1);
    expect(await flush()).toBe(1); // la guarda se libera al terminar
  });

  it('la guarda se libera aunque la ejecución falle', async () => {
    repo.listPendingEmail = async () => { throw new Error('bd caída'); };
    await expect(flush()).rejects.toThrow('bd caída');
    repo.listPendingEmail = async () => [];
    expect(await flush()).toBe(0);
  });

  it('integración: usuario inexistente se marca omitida y no vuelve a recogerse; el resto se envía una vez', async () => {
    const ghost = await make('fantasma', hoursAgo(3));
    ghost.userId = 'no-existe';
    const ok = await make('ok', hoursAgo(1));
    const email = new RecordingEmail();
    registerEmailObserver({
      bus, notifications: repo, email, now: () => NOW,
      users: new InMemoryUsers([{ id: 'u1', name: 'Ana', email: 'ana@horariouni.test', passwordHash: 'h', role: 'STUDENT', active: true }]),
    });
    expect(await flush()).toBe(2);
    await bus.idle();
    expect(email.sent.map((m) => m.subject)).toEqual(['ok']);
    expect(ghost.emailSkippedAt).not.toBeNull();
    expect(ok.emailedAt).toEqual(NOW);
    expect(await flush()).toBe(0);
  });
});
