import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { registerNotificationObserver } from '../../src/modules/notifications/application/NotificationObserver';
import { InMemoryNotifications, session } from '../helpers/inMemory';
import { ScheduleChange } from '../../src/modules/schedule/domain/types';

const added = (n: number): ScheduleChange => {
  const s = session({ externalId: `u1-C${n}`, courseName: `Curso ${n}` });
  return { type: 'ADDED', externalId: s.externalId, userId: 'u1', after: s };
};

describe('registerNotificationObserver', () => {
  let repo: InMemoryNotifications, log: InMemoryEventLog, bus: EventBus;
  let created: Array<{ notificationId: string; userId: string; title: string; message: string; kind: string }>;

  beforeEach(() => {
    repo = new InMemoryNotifications();
    log = new InMemoryEventLog();
    bus = new EventBus({ log, sleep: async () => {} });
    created = [];
    bus.subscribe('NotificationCreated', (e) => { created.push(e.payload); }, { name: 'spy' });
    registerNotificationObserver(bus, repo);
  });

  it('crea una notificación por cambio, en orden, y publica NotificationCreated por cada una', async () => {
    await bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [added(1), added(2)], initialLoad: false });
    await bus.idle();
    expect(repo.rows.map((r) => r.title)).toEqual(['Nueva clase: Curso 1', 'Nueva clase: Curso 2']);
    expect(repo.rows.every((r) => r.userId === 'u1' && r.readAt === null && r.emailedAt === null)).toBe(true);
    expect(created).toHaveLength(2);
    expect(created[0]).toEqual({
      notificationId: repo.rows[0].id, userId: 'u1', title: repo.rows[0].title,
      message: repo.rows[0].message, kind: 'SCHEDULE_ADDED',
    });
    expect(created[1].notificationId).toBe(repo.rows[1].id);
  });

  it('bus.idle() cubre la publicación anidada de NotificationCreated', async () => {
    let finished = false;
    bus.subscribe('NotificationCreated', async () => {
      await new Promise((r) => setTimeout(r, 20));
      finished = true;
    }, { name: 'slow' });
    // No se espera el report de publish: solo idle().
    void bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [added(1)], initialLoad: false });
    await bus.idle();
    expect(finished).toBe(true);
    expect(log.events.map((e) => e.type)).toContain('NotificationCreated');
  });

  it('la carga inicial (initialLoad) es silenciosa: no crea notificaciones ni publica NotificationCreated', async () => {
    const report = await bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [added(1), added(2)], initialLoad: true });
    await bus.idle();
    expect(report.deliveries).toEqual([{ observer: 'notifications', status: 'OK', attempts: 1 }]);
    expect(repo.rows).toHaveLength(0);
    expect(created).toHaveLength(0);
  });

  it('la publicación anidada es dispara-y-olvida: un observador lento de NotificationCreated no retrasa el reporte', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let finished = false;
    bus.subscribe('NotificationCreated', async () => { await gate; finished = true; }, { name: 'slow' });
    const report = await bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [added(1)], initialLoad: false });
    expect(report.deliveries[0]).toMatchObject({ observer: 'notifications', status: 'OK' });
    expect(finished).toBe(false); // el reporte llegó con la entrega anidada aún en vuelo
    release();
    await bus.idle();
    expect(finished).toBe(true);
  });

  it('si el repositorio falla, el bus lo registra FAILED tras reintentos sin lanzar, y no duplica las ya creadas', async () => {
    const orig = repo.create.bind(repo);
    let calls = 0;
    repo.create = async (n) => {
      calls++;
      if (n.title.endsWith('2')) throw new Error('bd caída');
      return orig(n);
    };
    const report = await bus.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [added(1), added(2), added(3)], initialLoad: false });
    await bus.idle();
    expect(report.deliveries).toEqual([{ observer: 'notifications', status: 'FAILED', attempts: 3, error: 'bd caída' }]);
    expect(repo.rows.map((r) => r.title)).toEqual(['Nueva clase: Curso 1', 'Nueva clase: Curso 3']);
    expect(calls).toBe(5); // 1.er intento: 3 cambios; 2 reintentos: solo el que falló (los ya creados no se repiten)
    expect(created).toHaveLength(2);
  });
});
