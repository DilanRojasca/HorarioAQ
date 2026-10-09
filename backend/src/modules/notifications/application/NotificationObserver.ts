import { EventBus } from '../../../shared/events/EventBus';
import { Subscription } from '../../../shared/events/types';
import { describeChange } from '../domain/messages';
import { NotificationRepository } from './ports';

/**
 * Observador de notificaciones en la app: por cada cambio de ScheduleChanged crea una
 * notificación y publica NotificationCreated (dentro del observador, para que `bus.idle()`
 * la cubra). Si un cambio falla se siguen procesando los demás y al final se lanza el primer
 * error, de modo que el bus reintente; las notificaciones ya creadas no se duplican.
 */
export function registerNotificationObserver(bus: EventBus, repo: NotificationRepository): Subscription[] {
  const done = new Map<string, Set<number>>(); // eventId -> índices de cambios ya notificados
  return [
    bus.subscribe('ScheduleChanged', async (e) => {
      const finished = done.get(e.id) ?? new Set<number>();
      done.set(e.id, finished);
      let firstError: unknown;
      for (const [i, change] of e.payload.changes.entries()) {
        if (finished.has(i)) continue;
        try {
          const d = describeChange(change);
          const rec = await repo.create({ userId: e.payload.userId, kind: d.kind, title: d.title, message: d.message });
          finished.add(i);
          await bus.publish('NotificationCreated', {
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
