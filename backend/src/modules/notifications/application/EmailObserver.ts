import { EventBus } from '../../../shared/events/EventBus';
import { Subscription } from '../../../shared/events/types';
import { isWithinSendWindow, SendWindowOptions } from '../../../shared/window';
import { UserRepository } from '../../auth/application/ports';
import { EMAIL_OBSERVER_RETRIES, EmailPort, NotificationRepository } from './ports';

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
 * de ella la notificación queda pendiente y la recoge el job de pendientes.
 * Sin duplicados: antes de enviar RECLAMA la notificación de forma atómica (`claimEmail`) y solo
 * envía quien gana el reclamo, así que entregas concurrentes o re-publicaciones no repiten el correo.
 * Si el envío falla libera el reclamo, suma un intento fallido y propaga el error para que el bus
 * reintente (3 reintentos). Usuario inexistente o inactivo: se marca omitida (terminal).
 */
export function registerEmailObserver(deps: EmailObserverDeps): Subscription[] {
  const { bus, notifications, users, email, now = () => new Date(), window } = deps;
  const opts: SendWindowOptions = window ?? {};
  return [
    bus.subscribe('NotificationCreated', async (e) => {
      const at = now();
      if (!isWithinSendWindow(at, opts)) return;
      const n = await notifications.findById(e.payload.notificationId);
      if (!n || n.emailedAt || n.emailSkippedAt) return;
      const user = await users.findById(n.userId);
      if (!user || !user.active) {
        await notifications.markEmailSkipped(n.id, at);
        return;
      }
      if (!(await notifications.claimEmail(n.id, at))) return; // otra entrega ya la reclamó
      try {
        await email.send({ to: user.email, subject: n.title, text: n.message });
      } catch (err) {
        try {
          await notifications.releaseEmail(n.id);
          await notifications.recordEmailFailure(n.id);
        } catch (e) {
          console.error('[email] no se pudo liberar el reclamo de', n.id, e);
        }
        throw err;
      }
    }, { name: 'email', priority: 10, retries: EMAIL_OBSERVER_RETRIES }),
  ];
}
