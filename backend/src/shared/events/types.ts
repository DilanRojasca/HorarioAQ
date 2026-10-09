import type { ScheduleChange } from '../../modules/schedule/domain/types';

export type NotificationKind = 'SCHEDULE_ADDED' | 'SCHEDULE_UPDATED' | 'SCHEDULE_CANCELLED';

/** Catálogo de eventos del dominio: tipo → forma del payload. */
export interface EventMap {
  ScheduleChanged: { userId: string; semester: string; changes: ScheduleChange[] };
  SyncCompleted: {
    runId: string; trigger: 'MANUAL' | 'CRON'; studentsSynced: number; changesCount: number; failures: number;
    changesByType: { ADDED: number; UPDATED: number; CANCELLED: number };
  };
  SyncFailed: { runId: string; trigger: 'MANUAL' | 'CRON'; message: string };
  NotificationCreated: {
    notificationId: string; userId: string; title: string; message: string; kind: NotificationKind;
    /** true cuando es una re-publicación (job de pendientes): solo el correo debe reaccionar. */
    replay?: boolean;
  };
}
export type EventType = keyof EventMap;

export interface DomainEvent<T extends EventType = EventType> {
  id: string;
  type: T;
  occurredAt: Date;
  payload: EventMap[T];
}

export type Observer<T extends EventType> = (event: DomainEvent<T>) => void | Promise<void>;

export interface SubscribeOptions {
  /** Nombre del observador; aparece en el historial de entregas. */
  name: string;
  /** Mayor prioridad se ejecuta antes (por defecto 0). */
  priority?: number;
  /** Se da de baja solo antes de su primera entrega. */
  once?: boolean;
  /** Reintentos tras el primer fallo (por defecto 2). */
  retries?: number;
  /** Espera base del backoff exponencial en ms (por defecto 1000). */
  backoffMs?: number;
}

export interface Subscription { unsubscribe(): void }

export interface DeliveryRecord { observer: string; status: 'OK' | 'FAILED'; attempts: number; error?: string }
export interface DeliveryReport { eventId: string; deliveries: DeliveryRecord[] }

export interface EventLogEntry {
  id: string;
  type: string;
  payload: unknown;
  occurredAt: Date;
  deliveries: Array<DeliveryRecord & { deliveredAt: Date }>;
}

/** Puerto del historial de eventos y entregas. */
export interface EventLog {
  recordEvent(e: DomainEvent): Promise<void>;
  recordDelivery(eventId: string, d: DeliveryRecord): Promise<void>;
  listRecent(limit: number): Promise<EventLogEntry[]>;
}
