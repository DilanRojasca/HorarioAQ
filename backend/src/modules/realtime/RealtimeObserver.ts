import { EventBus } from '../../shared/events/EventBus';
import { Subscription } from '../../shared/events/types';
import { isWithinSendWindow, SendWindowOptions } from '../../shared/window';
import { UserRepository } from '../auth/application/ports';
import { channelPolicy } from '../notifications/domain/channelPolicy';
import { SseHub } from './SseHub';

export interface RealtimeObserverDeps {
  now?: () => Date;
  window?: SendWindowOptions;
  /** Para respetar el canal preferido (RF-NOT-04); sin él se entrega siempre. */
  users?: UserRepository;
}

/**
 * Observadores de tiempo real (prioridad 30, después de crear la notificación): traducen eventos
 * del dominio a mensajes SSE para el usuario dueño.
 * - `realtime-schedule`: ScheduleChanged → `schedule-changed`, siempre (no sujeto a la ventana).
 * - `realtime-notification`: NotificationCreated → `notification`, solo dentro de la ventana de
 *   envío (RRF-05) y nunca para re-publicaciones (`replay`), que existen solo para el correo.
 *
 * @pattern Observer | Observadores concretos: realtime-* | Empujan ScheduleChanged y NotificationCreated al navegador por SSE.
 */
export function registerRealtimeObserver(bus: EventBus, hub: SseHub, deps: RealtimeObserverDeps = {}): Subscription[] {
  const { now = () => new Date(), window, users } = deps;
  const opts: SendWindowOptions = window ?? {};
  return [
    bus.subscribe('ScheduleChanged', (e) => {
      hub.sendToUser(e.payload.userId, 'schedule-changed', { semester: e.payload.semester, count: e.payload.changes.length });
    }, { name: 'realtime-schedule', priority: 30 }),
    bus.subscribe('NotificationCreated', async (e) => {
      const { replay, notificationId, userId, title, message, kind } = e.payload;
      if (replay === true || !isWithinSendWindow(now(), opts)) return;
      if (users && !channelPolicy((await users.findById(userId))?.notifyChannel).push) return;
      hub.sendToUser(userId, 'notification', { id: notificationId, title, message, kind });
    }, { name: 'realtime-notification', priority: 30 }),
  ];
}
