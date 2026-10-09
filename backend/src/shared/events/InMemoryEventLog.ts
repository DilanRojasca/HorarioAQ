import type { DeliveryRecord, DomainEvent, EventLog, EventLogEntry } from './types';

/** Historial en memoria, para pruebas. */
export class InMemoryEventLog implements EventLog {
  events: DomainEvent[] = [];
  deliveries: Array<{ eventId: string; delivery: DeliveryRecord }> = [];

  async recordEvent(e: DomainEvent) { this.events.push(e); }

  async recordDelivery(eventId: string, d: DeliveryRecord) { this.deliveries.push({ eventId, delivery: d }); }

  async listRecent(limit: number): Promise<EventLogEntry[]> {
    return [...this.events]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit)
      .map((e) => ({
        id: e.id, type: e.type, payload: e.payload, occurredAt: e.occurredAt,
        deliveries: this.deliveries.filter((d) => d.eventId === e.id).map((d) => ({ ...d.delivery, deliveredAt: new Date() })),
      }));
  }
}
