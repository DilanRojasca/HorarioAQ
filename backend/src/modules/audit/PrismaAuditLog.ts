import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma';
import { AuditEntry, AuditPort, AuditReader, AuditRecord } from '../../shared/ports';

export class PrismaAuditLog implements AuditPort, AuditReader {
  async record(e: AuditEntry) {
    await prisma.auditLog.create({
      data: {
        actorId: e.actorId, action: e.action, entity: e.entity,
        detail: e.detail === undefined ? Prisma.JsonNull : (e.detail as Prisma.InputJsonValue),
      },
    });
  }

  async listRecent(limit: number, filter: { action?: string } = {}) {
    const rows = await prisma.auditLog.findMany({
      where: filter.action ? { action: filter.action } : {}, orderBy: { createdAt: 'desc' }, take: limit,
    });
    return rows.map((r) => ({ id: r.id, actorId: r.actorId ?? undefined, action: r.action, entity: r.entity, detail: r.detail, createdAt: r.createdAt }) as AuditRecord);
  }
}
