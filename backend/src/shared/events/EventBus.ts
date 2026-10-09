import { randomUUID } from 'crypto';
import type {
  DeliveryRecord, DeliveryReport, DomainEvent, EventLog, EventMap, EventType, Observer, SubscribeOptions, Subscription,
} from './types';

interface Entry {
  type: EventType;
  observer: Observer<any>;
  name: string;
  priority: number;
  once: boolean;
  retries: number;
  backoffMs: number;
}

export interface EventBusOptions {
  log?: EventLog;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  newId?: () => string;
}

/**
 * Patrón Observer. El bus es el Subject: los observadores se suscriben a un tipo de evento
 * y `publish` los notifica sin que el publicador los conozca.
 *
 * Semántica de entrega:
 * - Los observadores de un evento corren en secuencia: prioridad descendente y, a igual
 *   prioridad, orden de suscripción.
 * - Cada observador está aislado: si falla se reintenta con backoff exponencial
 *   (`backoffMs * 2^(intento-1)`) y, agotados los reintentos, queda FAILED sin afectar a los demás.
 * - Las suscripciones `once` se retiran antes de invocarse.
 * - `publish` nunca rechaza: devuelve un reporte y los fallos del historial solo se registran en consola.
 * - `idle()` espera a todas las publicaciones en vuelo, incluidas las iniciadas desde observadores.
 */
export class EventBus {
  private entries: Entry[] = [];
  private inFlight = new Set<Promise<unknown>>();
  private readonly log?: EventLog;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(opts: EventBusOptions = {}) {
    this.log = opts.log;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? randomUUID;
  }

  subscribe<T extends EventType>(type: T, observer: Observer<T>, options: SubscribeOptions): Subscription {
    const entry: Entry = {
      type, observer, name: options.name,
      priority: options.priority ?? 0, once: options.once ?? false,
      retries: options.retries ?? 2, backoffMs: options.backoffMs ?? 1000,
    };
    this.entries.push(entry);
    return { unsubscribe: () => { this.entries = this.entries.filter((e) => e !== entry); } };
  }

  subscriberCount(type: EventType): number {
    return this.entries.filter((e) => e.type === type).length;
  }

  publish<T extends EventType>(type: T, payload: EventMap[T]): Promise<DeliveryReport> {
    // Se calcula de forma síncrona (antes de cualquier await) para que `once` no se entregue dos veces.
    const event: DomainEvent<T> = { id: this.newId(), type, occurredAt: this.now(), payload };
    const targets = this.entries
      .filter((e) => e.type === type)
      .sort((a, b) => b.priority - a.priority); // sort estable: empate = orden de suscripción
    this.entries = this.entries.filter((e) => !(e.once && targets.includes(e)));

    const run = this.deliver(event, targets).finally(() => this.inFlight.delete(run));
    this.inFlight.add(run);
    return run;
  }

  /** Espera a que no queden publicaciones en vuelo. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  private async deliver(event: DomainEvent, targets: Entry[]): Promise<DeliveryReport> {
    await this.safeLog(() => this.log?.recordEvent(event));
    const deliveries: DeliveryRecord[] = [];
    for (const t of targets) {
      const record = await this.invoke(t, event);
      deliveries.push(record);
      await this.safeLog(() => this.log?.recordDelivery(event.id, record));
    }
    return { eventId: event.id, deliveries };
  }

  private async invoke(t: Entry, event: DomainEvent): Promise<DeliveryRecord> {
    let attempts = 0;
    for (;;) {
      attempts++;
      try {
        await t.observer(event);
        return { observer: t.name, status: 'OK', attempts };
      } catch (err) {
        if (attempts > t.retries) {
          return { observer: t.name, status: 'FAILED', attempts, error: err instanceof Error ? err.message : String(err) };
        }
        await this.sleep(t.backoffMs * 2 ** (attempts - 1));
      }
    }
  }

  private async safeLog(write: () => Promise<void> | undefined): Promise<void> {
    try {
      await write();
    } catch (err) {
      console.error('[eventBus] no se pudo escribir en el historial:', err);
    }
  }
}
