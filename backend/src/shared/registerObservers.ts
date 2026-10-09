import type { UserRepository } from '../modules/auth/application/ports';
import { registerAuditObserver } from '../modules/audit/auditObserver';
import { registerEmailObserver } from '../modules/notifications/application/EmailObserver';
import { registerNotificationObserver } from '../modules/notifications/application/NotificationObserver';
import { EmailPort, NotificationRepository } from '../modules/notifications/application/ports';
import { registerRealtimeObserver } from '../modules/realtime/RealtimeObserver';
import { SseHub } from '../modules/realtime/SseHub';
import type { SyncRunRepository } from '../modules/schedule/application/ports';
import { registerSyncStatsObserver } from '../modules/schedule/observers/syncStatsObserver';
import { EventBus } from './events/EventBus';
import type { AuditPort } from './ports';

export interface ObserverDeps {
  audit: AuditPort;
  syncRuns: SyncRunRepository;
  notifications: NotificationRepository;
  users: UserRepository;
  email: EmailPort;
  hub: SseHub;
  sendWindow: { start: number; end: number; timeZone: string };
  now?: () => Date;
}

/**
 * Único lugar donde se suscriben todos los observadores del bus (los usa `wire()` y las pruebas).
 * Orden de entrega, por prioridad:
 * - ScheduleChanged: `audit` (100) → `notifications` (50) → `realtime-schedule` (30).
 * - SyncCompleted: `sync-stats` (40).
 * - NotificationCreated: `realtime-notification` (30) → `email` (10).
 */
export function registerObservers(bus: EventBus, deps: ObserverDeps): void {
  const { audit, syncRuns, notifications, users, email, hub, sendWindow, now } = deps;
  registerAuditObserver(bus, audit);
  registerSyncStatsObserver(bus, syncRuns);
  registerNotificationObserver(bus, notifications);
  registerEmailObserver({ bus, notifications, users, email, window: sendWindow, now });
  registerRealtimeObserver(bus, hub, { window: sendWindow, now });
}
