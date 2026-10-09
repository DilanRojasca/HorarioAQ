import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { registerEmailObserver } from '../../src/modules/notifications/application/EmailObserver';
import { InMemoryNotifications, InMemoryUsers, RecordingEmail } from '../helpers/inMemory';
import { registerNotificationObserver } from '../../src/modules/notifications/application/NotificationObserver';
import { ConsoleEmailAdapter } from '../../src/modules/notifications/infrastructure/ConsoleEmailAdapter';
import { session } from '../helpers/inMemory';
import { User } from '../../src/modules/auth/application/ports';

const user = (over: Partial<User> = {}): User => ({
  id: 'u1', name: 'Ana', email: 'ana@horariouni.test', passwordHash: 'h', role: 'STUDENT', active: true, ...over,
});
const INSIDE = new Date('2026-10-09T15:00:00Z'); // 10:00 Bogotá
const OUTSIDE = new Date('2026-10-09T08:00:00Z'); // 03:00 Bogotá

describe('registerEmailObserver', () => {
  let repo: InMemoryNotifications, users: InMemoryUsers, email: RecordingEmail, log: InMemoryEventLog, bus: EventBus;
  let now: Date;
  let notificationId: string;

  const publish = () => bus.publish('NotificationCreated', {
    notificationId, userId: 'u1', title: 'Clase cancelada', message: 'Algoritmos', kind: 'SCHEDULE_CANCELLED',
  });

  beforeEach(async () => {
    repo = new InMemoryNotifications();
    users = new InMemoryUsers([user()]);
    email = new RecordingEmail();
    log = new InMemoryEventLog();
    bus = new EventBus({ log, sleep: async () => {} });
    now = INSIDE;
    registerEmailObserver({ bus, notifications: repo, users, email, now: () => now });
    notificationId = (await repo.create({ userId: 'u1', kind: 'SCHEDULE_CANCELLED', title: 'Clase cancelada', message: 'Algoritmos' })).id;
  });

  it('dentro de la ventana envía el correo y marca emailedAt', async () => {
    await publish();
    expect(email.sent).toEqual([{ to: 'ana@horariouni.test', subject: 'Clase cancelada', text: 'Algoritmos' }]);
    expect(repo.rows[0].emailedAt).toEqual(INSIDE);
  });

  it('sigue enviando el correo de las re-publicaciones (replay)', async () => {
    await bus.publish('NotificationCreated', {
      notificationId, userId: 'u1', title: 'Clase cancelada', message: 'Algoritmos', kind: 'SCHEDULE_CANCELLED', replay: true,
    });
    expect(email.sent).toHaveLength(1);
  });

  it('fuera de la ventana no envía y queda pendiente, sin error', async () => {
    now = OUTSIDE;
    const report = await publish();
    expect(email.sent).toHaveLength(0);
    expect(repo.rows[0].emailedAt).toBeNull();
    expect(report.deliveries[0]).toMatchObject({ observer: 'email', status: 'OK' });
  });

  it('es idempotente: si ya tiene emailedAt no reenvía', async () => {
    await publish();
    await publish();
    expect(email.sent).toHaveLength(1);
  });

  it('usuario inexistente o inactivo: no envía y no falla', async () => {
    users.users = [];
    let report = await publish();
    expect(report.deliveries[0].status).toBe('OK');
    users.users = [user({ active: false })];
    report = await publish();
    expect(report.deliveries[0].status).toBe('OK');
    expect(email.sent).toHaveLength(0);
    expect(repo.rows[0].emailedAt).toBeNull();
    expect(repo.rows[0].emailSkippedAt).toEqual(INSIDE); // terminal: el job de pendientes ya no la recoge
    expect(await repo.listPendingEmail(new Date(0), 10)).toHaveLength(0);
  });

  it('dos entregas concurrentes de la misma notificación envían exactamente un correo', async () => {
    await Promise.all([publish(), publish()]);
    expect(email.sent).toHaveLength(1);
    expect(email.attempts).toBe(1);
  });

  it('si send falla libera el reclamo y suma un intento por fallo; un reintento posterior envía una sola vez', async () => {
    email.failWith = new Error('SMTP caído');
    await publish();
    expect(repo.rows[0]).toMatchObject({ emailedAt: null, emailAttempts: 4 });
    email.failWith = undefined;
    await Promise.all([publish(), publish()]);
    expect(email.sent).toHaveLength(1);
    expect(repo.rows[0].emailedAt).toEqual(INSIDE);
  });

  it('si liberar el reclamo falla se prefiere no duplicar: queda reclamada, se registra y el reintento no reenvía', async () => {
    email.failWith = new Error('SMTP caído');
    repo.releaseEmail = async () => { throw new Error('bd caída'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = await publish();
    expect(report.deliveries[0]).toMatchObject({ status: 'OK', attempts: 2 }); // 1.er intento falla; el 2.º ve el reclamo y no envía
    expect(email.attempts).toBe(1);
    expect(repo.rows[0].emailedAt).toEqual(INSIDE);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('una notificación ya omitida no se vuelve a evaluar', async () => {
    repo.rows[0].emailSkippedAt = INSIDE;
    await publish();
    expect(email.sent).toHaveLength(0);
  });

  it('notificación inexistente: no envía y no falla', async () => {
    notificationId = 'no-existe';
    const report = await publish();
    expect(report.deliveries[0].status).toBe('OK');
    expect(email.sent).toHaveLength(0);
  });

  it('si send falla el bus reintenta, queda FAILED con intentos y no marca enviado', async () => {
    email.failWith = new Error('SMTP caído');
    const report = await publish();
    expect(report.deliveries[0]).toMatchObject({ observer: 'email', status: 'FAILED', attempts: 4, error: 'SMTP caído' });
    expect(email.attempts).toBe(4);
    expect(repo.rows[0].emailedAt).toBeNull();
  });

  it('un reintento exitoso tras un fallo transitorio marca enviado', async () => {
    email.failTimes = 2;
    const report = await publish();
    expect(report.deliveries[0]).toMatchObject({ status: 'OK', attempts: 3 });
    expect(email.sent).toHaveLength(1);
    expect(repo.rows[0].emailedAt).not.toBeNull();
  });

  it('cadena completa con ConsoleEmailAdapter: ScheduleChanged -> notificación -> correo en consola -> emailedAt', async () => {
    const lines: string[] = [];
    const b = new EventBus({ sleep: async () => {} });
    const r = new InMemoryNotifications();
    registerNotificationObserver(b, r);
    registerEmailObserver({ bus: b, notifications: r, users, email: new ConsoleEmailAdapter((l) => lines.push(l)), now: () => now });
    const s = session({ externalId: 'u1-X', courseName: 'Cálculo' });
    await b.publish('ScheduleChanged', { userId: 'u1', semester: '2026-2', changes: [{ type: 'ADDED', externalId: 'u1-X', userId: 'u1', after: s }], initialLoad: false });
    await b.idle();
    expect(lines).toEqual(['[email:console] para=ana@horariouni.test asunto=Nueva clase: Cálculo']);
    expect(r.rows[0].emailedAt).toEqual(INSIDE);
  });
});
