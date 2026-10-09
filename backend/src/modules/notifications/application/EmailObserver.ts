import { EventBus } from '../../../shared/events/EventBus';
import { Subscription } from '../../../shared/events/types';
import { isWithinSendWindow, SendWindowOptions } from '../../../shared/window';
import { UserRepository } from '../../auth/application/ports';
import { EmailPort, NotificationRepository } from './ports';

export interface EmailObserverDeps {
  bus: EventBus;
  notifications: NotificationRepository;
  users: UserRepository;
  email: EmailPort;
  now?: () => Date;
  window?: { start: number; end: number; timeZone: string };
}

/**
 * Observador de correo (nombre `email`, prioridad 10: corre después del de notificaciones en la app).
 * Escucha NotificationCreated y envía el correo solo dentro de la ventana de envío (RRF-05); fuera
 * de ella la notificación queda pendiente y la recoge el job de pendientes. Es idempotente: si la
 * notificación ya tiene `emailedAt` no hace nada, por lo que puede re-publicarse sin duplicar correos.
 * Si el envío falla, el error se propaga al bus para que reintente (3 reintentos).
 */
export function registerEmailObserver(deps: EmailObserverDeps): Subscription[] {
  const { bus, notifications, users, email, now = () => new Date(), window } = deps;
  const opts: SendWindowOptions = window ?? {};
  return [
    bus.subscribe('NotificationCreated', async (e) => {
      const at = now();
      if (!isWithinSendWindow(at, opts)) return;
      const n = await notifications.findById(e.payload.notificationId);
      if (!n || n.emailedAt) return;
      const user = await users.findById(n.userId);
      if (!user || !user.active) return;
      await email.send({ to: user.email, subject: n.title, text: n.message });
      await notifications.markEmailed(n.id, at);
    }, { name: 'email', priority: 10, retries: 3 }),
  ];
}
