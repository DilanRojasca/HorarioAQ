import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { DeliveryRecord, DomainEvent, EventLog, EventLogEntry } from './types';

export class PrismaEventLog implements EventLog {
  async recordEvent(e: DomainEvent) {
    await prisma.domainEvent.create({
      data: { id: e.id, type: e.type, payload: e.payload as unknown as Prisma.InputJsonValue, occurredAt: e.occurredAt },
    });
  }

  async recordDelivery(eventId: string, d: DeliveryRecord) {
    await prisma.eventDelivery.create({
      data: { eventId, observer: d.observer, status: d.status, attempts: d.attempts, error: d.error },
    });
  }

  async listRecent(limit: number): Promise<EventLogEntry[]> {
    const rows = await prisma.domainEvent.findMany({
      orderBy: { occurredAt: 'desc' }, take: limit,
      include: { deliveries: { orderBy: { deliveredAt: 'asc' } } },
    });
    return rows.map((r) => ({
      id: r.id, type: r.type, payload: r.payload, occurredAt: r.occurredAt,
      deliveries: r.deliveries.map((d) => ({
        observer: d.observer, status: d.status as 'OK' | 'FAILED', attempts: d.attempts,
        error: d.error ?? undefined, deliveredAt: d.deliveredAt,
      })),
    }));
  }
}
