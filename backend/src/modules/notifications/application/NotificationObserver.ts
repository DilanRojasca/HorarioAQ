import { EventBus } from '../../../shared/events/EventBus';
import { Subscription } from '../../../shared/events/types';
import { describeChange } from '../domain/messages';
import { NotificationRepository } from './ports';

/**
 * Observador de notificaciones en la app: por cada cambio de ScheduleChanged crea una
 * notificación y publica NotificationCreated. La carga inicial (`initialLoad`) es silenciosa: no
 * crea notificaciones. La publicación anidada es "dispara y olvida" (`void`): `bus.publish` registra
 * la entrega en vuelo de forma síncrona, así que `bus.idle()` la cubre igualmente, y un correo lento
 * o fallido nunca retrasa a los demás observadores ni la sincronización. Si un cambio falla se siguen procesando los demás y al final se lanza el primer
 * error, de modo que el bus reintente; las notificaciones ya creadas no se duplican.
 */
export function registerNotificationObserver(bus: EventBus, repo: NotificationRepository): Subscription[] {
  const done = new Map<string, Set<number>>(); // eventId -> índices de cambios ya notificados
  return [
    bus.subscribe('ScheduleChanged', async (e) => {
      if (e.payload.initialLoad) return;
      const finished = done.get(e.id) ?? new Set<number>();
      done.set(e.id, finished);
      let firstError: unknown;
      for (const [i, change] of e.payload.changes.entries()) {
        if (finished.has(i)) continue;
        try {
          const d = describeChange(change);
          const rec = await repo.create({ userId: e.payload.userId, kind: d.kind, title: d.title, message: d.message });
          finished.add(i);
          void bus.publish('NotificationCreated', {
            notificationId: rec.id, userId: rec.userId, title: rec.title, message: rec.message, kind: rec.kind,
          });
        } catch (err) {
          firstError ??= err;
        }
      }
      if (firstError === undefined) done.delete(e.id);
      else throw firstError;
    }, { name: 'notifications', priority: 50 }),
  ];
}
