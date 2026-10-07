import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma';
import { AuditEntry, AuditPort } from '../../shared/ports';

export class PrismaAuditLog implements AuditPort {
  async record(e: AuditEntry) {
    await prisma.auditLog.create({
      data: {
        actorId: e.actorId, action: e.action, entity: e.entity,
        detail: e.detail === undefined ? Prisma.JsonNull : (e.detail as Prisma.InputJsonValue),
      },
    });
  }
}
