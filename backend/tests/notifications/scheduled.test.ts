import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/shared/events/EventBus';
import {
  CancelScheduledUseCase, CreateCustomNotificationUseCase, dispatchDue, planReminders,
} from '../../src/modules/notifications/application/ScheduledNotifications';
import { localClock, planClassReminders } from '../../src/modules/notifications/domain/reminders';
import { channelPolicy } from '../../src/modules/notifications/domain/channelPolicy';
import { registerEmailObserver } from '../../src/modules/notifications/application/EmailObserver';
import { InMemoryEnrollmentRepo, InMemoryNotifications, InMemoryScheduleRepo, InMemoryScheduled, InMemoryUsers, session } from '../helpers/inMemory';

const TZ = 'America/Bogota';
// Lunes 3 ago 2026, 07:50 en Bogotá (UTC-5) = 12:50Z
const MON_0750 = new Date('2026-08-03T12:50:00Z');

describe('Recordatorios de clase (RF-NOT-02)', () => {
  it('localClock convierte a la zona horaria', () => {
    expect(localClock(MON_0750, TZ)).toEqual({ weekday: 1, minutes: 470, dateKey: '2026-08-03' });
  });
  it('solo clases activas de hoy que empiezan dentro de la antelación', () => {
    const list = [session({ startTime: '08:00' }), session({ externalId: 'b', startTime: '08:30' }), session({ externalId: 'c', startTime: '07:00' }),
      session({ externalId: 'd', startTime: '08:00', weekday: 2 }), session({ externalId: 'e', startTime: '08:00', status: 'CANCELLED' })];
    expect(planClassReminders(list, MON_0750, 15, TZ).map((p) => p.session.externalId)).toEqual(['u1-ALG-1']);
    expect(planClassReminders(list, MON_0750, 45, TZ)).toHaveLength(2);
  });
  it('el job crea el recordatorio una sola vez por clase y día (idempotente) y lo despacha', async () => {
    const schedules = new InMemoryScheduleRepo(); schedules.rows = [session({ startTime: '08:00' })];
    const scheduled = new InMemoryScheduled(); const notifications = new InMemoryNotifications();
    const users = new InMemoryUsers([{ id: 'u1', name: 'Ana', email: 'a@x', passwordHash: 'h', role: 'STUDENT', active: true }]);
    const deps = { scheduled, schedules, enrollments: new InMemoryEnrollmentRepo(['u1']), users, semester: '2026-2', timeZone: TZ, now: () => MON_0750 };
    expect(await planReminders(deps)).toBe(1);
    expect(await planReminders(deps)).toBe(0);
    const bus = new EventBus({ sleep: async () => {} });
    expect(await dispatchDue({ scheduled, notifications, bus, now: () => MON_0750 })).toBe(1);
    await bus.idle();
    expect(notifications.rows[0]).toMatchObject({ kind: 'CLASS_REMINDER', userId: 'u1' });
    expect(await dispatchDue({ scheduled, notifications, bus, now: () => MON_0750 })).toBe(0);
  });
});

describe('Notificaciones propias (RF-NOT-01)', () => {
  let scheduled: InMemoryScheduled, schedules: InMemoryScheduleRepo, uc: CreateCustomNotificationUseCase;
  const now = new Date('2026-08-03T12:00:00Z');
  beforeEach(() => {
    scheduled = new InMemoryScheduled(); schedules = new InMemoryScheduleRepo(); schedules.rows = [session()];
    uc = new CreateCustomNotificationUseCase(scheduled, schedules, () => now);
  });
  const future = new Date('2026-08-04T12:00:00Z');
  it('programa una notificación y la lista; asociada a una clase añade su nombre', async () => {
    const l = await uc.execute({ userId: 'u1', title: ' Parcial ', message: 'Estudiar', fireAt: future, sessionExternalId: 'u1-ALG-1' });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ title: 'Parcial', message: 'Estudiar (Clase: Algoritmos)', kind: 'CUSTOM' });
  });
  it('valida título, mensaje, fecha futura y clase existente', async () => {
    await expect(uc.execute({ userId: 'u1', title: '', message: 'x', fireAt: future })).rejects.toMatchObject({ status: 400 });
    await expect(uc.execute({ userId: 'u1', title: 'x', message: '', fireAt: future })).rejects.toMatchObject({ status: 400 });
    await expect(uc.execute({ userId: 'u1', title: 'x', message: 'y', fireAt: new Date('2026-08-03T11:00:00Z') })).rejects.toMatchObject({ status: 400 });
    await expect(uc.execute({ userId: 'u1', title: 'x', message: 'y', fireAt: future, sessionExternalId: 'otra' })).rejects.toMatchObject({ status: 404 });
  });
  it('cancelar solo funciona sobre las propias y pendientes', async () => {
    const [n] = await uc.execute({ userId: 'u1', title: 'x', message: 'y', fireAt: future });
    await expect(new CancelScheduledUseCase(scheduled).execute({ userId: 'otro', id: n.id })).rejects.toMatchObject({ status: 404 });
    await new CancelScheduledUseCase(scheduled).execute({ userId: 'u1', id: n.id });
    expect(await scheduled.listPendingByUser('u1')).toEqual([]);
  });
});

describe('Canal preferido (RF-NOT-04) — Strategy', () => {
  it('políticas por canal', () => {
    expect(channelPolicy('IN_APP')).toEqual({ push: true, email: false });
    expect(channelPolicy('EMAIL')).toEqual({ push: false, email: true });
    expect(channelPolicy(undefined)).toEqual({ push: true, email: true });
  });
  it('el observador de correo omite a quien eligió solo la app', async () => {
    const bus = new EventBus({ sleep: async () => {} });
    const notifications = new InMemoryNotifications();
    const users = new InMemoryUsers([{ id: 'u1', name: 'A', email: 'a@x', passwordHash: 'h', role: 'STUDENT', active: true, notifyChannel: 'IN_APP' }]);
    const sent: unknown[] = [];
    registerEmailObserver({ bus, notifications, users, email: { send: async (m) => { sent.push(m); } }, now: () => new Date('2026-08-03T17:00:00Z') });
    const n = await notifications.create({ userId: 'u1', kind: 'CUSTOM', title: 't', message: 'm' });
    await bus.publish('NotificationCreated', { notificationId: n.id, userId: 'u1', title: 't', message: 'm', kind: 'CUSTOM' });
    expect(sent).toEqual([]);
    expect((await notifications.findById(n.id))!.emailSkippedAt).not.toBeNull();
  });
});
