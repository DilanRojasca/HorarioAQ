import { EventBus } from '../../../shared/events/EventBus';
import { isWithinSendWindow } from '../../../shared/window';
import { NotificationRepository } from './ports';

export interface FlushDeps {
  notifications: NotificationRepository;
  bus: EventBus;
  now?: () => Date;
  window?: { start: number; end: number; timeZone: string };
  sinceHours?: number;
}

/**
 * Re-publica NotificationCreated por cada notificación con correo pendiente de las últimas
 * `sinceHours` (48 por defecto), solo dentro de la ventana de envío. Devuelve cuántas re-publicó.
 */
export async function flushPendingEmails(deps: FlushDeps): Promise<number> {
  const { notifications, bus, now = () => new Date(), window, sinceHours = 48 } = deps;
  const at = now();
  if (!isWithinSendWindow(at, window ?? {})) return 0;
  const pending = await notifications.listPendingEmail(new Date(at.getTime() - sinceHours * 3_600_000), 100);
  for (const n of pending) {
    await bus.publish('NotificationCreated', {
      notificationId: n.id, userId: n.userId, title: n.title, message: n.message, kind: n.kind, replay: true,
    });
  }
  return pending.length;
}
