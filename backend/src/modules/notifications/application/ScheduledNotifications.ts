import { EventBus } from '../../../shared/events/EventBus';
import { badRequest, notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { EnrollmentRepository, ScheduleRepository } from '../../schedule/application/ports';
import { UserRepository } from '../../auth/application/ports';
import { planClassReminders, reminderMessage, DEFAULT_REMINDER_MINUTES } from '../domain/reminders';
import { NotificationRepository, ScheduledNotificationRecord, ScheduledNotificationRepository } from './ports';

export interface CreateCustomInput { userId: string; title: string; message: string; fireAt: Date; sessionExternalId?: string }

/** RF-NOT-01: el estudiante programa una notificación propia, opcionalmente ligada a una clase de su horario. */
export class CreateCustomNotificationUseCase implements UseCase<CreateCustomInput, ScheduledNotificationRecord[]> {
  constructor(
    private scheduled: ScheduledNotificationRepository, private schedules: ScheduleRepository,
    private now: () => Date = () => new Date(),
  ) {}

  async execute(i: CreateCustomInput) {
    const title = i.title.trim(); let message = i.message.trim();
    if (!title || title.length > 80) throw badRequest('El título debe tener entre 1 y 80 caracteres');
    if (!message || message.length > 300) throw badRequest('El mensaje debe tener entre 1 y 300 caracteres');
    if (!(i.fireAt.getTime() > this.now().getTime())) throw badRequest('La fecha y hora deben ser futuras');
    if (i.sessionExternalId) {
      const s = await this.schedules.findOne(i.userId, i.sessionExternalId);
      if (!s) throw notFound('Esa clase no está en tu horario');
      message += ` (Clase: ${s.courseName})`;
    }
    await this.scheduled.create({ userId: i.userId, kind: 'CUSTOM', title, message, fireAt: i.fireAt });
    return this.scheduled.listPendingByUser(i.userId);
  }
}

export class ListScheduledUseCase implements UseCase<{ userId: string }, ScheduledNotificationRecord[]> {
  constructor(private scheduled: ScheduledNotificationRepository) {}
  execute({ userId }: { userId: string }) { return this.scheduled.listPendingByUser(userId); }
}

export class CancelScheduledUseCase implements UseCase<{ userId: string; id: string }, void> {
  constructor(private scheduled: ScheduledNotificationRepository) {}
  async execute({ userId, id }: { userId: string; id: string }) {
    if (!(await this.scheduled.cancel(userId, id))) throw notFound('Notificación programada no encontrada');
  }
}

export interface ReminderDeps {
  scheduled: ScheduledNotificationRepository; schedules: ScheduleRepository; enrollments: EnrollmentRepository;
  users: UserRepository; semester: string; timeZone: string; now?: () => Date;
}

/** RF-NOT-02: planifica los recordatorios de clase de todos los estudiantes (lo ejecuta el job cada minuto). */
export async function planReminders(d: ReminderDeps): Promise<number> {
  const now = (d.now ?? (() => new Date()))();
  let created = 0;
  for (const userId of await d.enrollments.listActiveStudentIds(d.semester)) {
    const user = await d.users.findById(userId);
    if (!user || !user.active) continue;
    const lead = user.reminderMinutes ?? DEFAULT_REMINDER_MINUTES;
    for (const { session, dedupKey } of planClassReminders(await d.schedules.findByUser(userId, d.semester), now, lead, d.timeZone)) {
      const m = reminderMessage(session, lead);
      if (await d.scheduled.create({ userId, kind: 'CLASS_REMINDER', ...m, fireAt: now, dedupKey })) created++;
    }
  }
  return created;
}

export interface DispatchDeps {
  scheduled: ScheduledNotificationRepository; notifications: NotificationRepository; bus: EventBus; now?: () => Date;
}

/**
 * Convierte las programadas vencidas en notificaciones reales y publica `NotificationCreated`:
 * desde ahí es el patrón Observer (push SSE + correo + ventana horaria + canal) quien entrega.
 * El reclamo atómico (`claimDue`) evita duplicados si corren dos instancias (escalamiento horizontal).
 */
export async function dispatchDue(d: DispatchDeps, limit = 100): Promise<number> {
  const due = await d.scheduled.claimDue((d.now ?? (() => new Date()))(), limit);
  for (const s of due) {
    const n = await d.notifications.create({ userId: s.userId, kind: s.kind, title: s.title, message: s.message });
    void d.bus.publish('NotificationCreated', { notificationId: n.id, userId: n.userId, title: n.title, message: n.message, kind: n.kind });
  }
  return due.length;
}
