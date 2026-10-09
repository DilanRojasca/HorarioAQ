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

let running = false; // evita que ejecuciones solapadas del cron envíen lo mismo dos veces

/**
 * Re-publica NotificationCreated (con `replay: true`) por cada notificación con correo pendiente de
 * las últimas `sinceHours` (48 por defecto, máx. 100, las más antiguas primero), solo dentro de la
 * ventana de envío. Las omitidas o con demasiados intentos fallidos no entran en la lista.
 * Si ya hay una ejecución en curso, devuelve 0 de inmediato. Devuelve cuántas re-publicó.
 */
export async function flushPendingEmails(deps: FlushDeps): Promise<number> {
  const { notifications, bus, now = () => new Date(), window, sinceHours = 48 } = deps;
  const at = now();
  if (!isWithinSendWindow(at, window ?? {})) return 0;
  if (running) return 0;
  running = true;
  try {
    const pending = await notifications.listPendingEmail(new Date(at.getTime() - sinceHours * 3_600_000), 100);
    for (const n of pending) {
      await bus.publish('NotificationCreated', {
        notificationId: n.id, userId: n.userId, title: n.title, message: n.message, kind: n.kind, replay: true,
      });
    }
    return pending.length;
  } finally {
    running = false;
  }
}
