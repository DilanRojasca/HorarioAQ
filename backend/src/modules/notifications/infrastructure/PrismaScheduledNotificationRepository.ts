import { prisma } from '../../../shared/prisma';
import { ScheduledKind, ScheduledNotificationRecord, ScheduledNotificationRepository } from '../application/ports';

const toRecord = (r: { kind: string } & Omit<ScheduledNotificationRecord, 'kind'>): ScheduledNotificationRecord => ({ ...r, kind: r.kind as ScheduledKind });

export class PrismaScheduledNotificationRepository implements ScheduledNotificationRepository {
  async create(n: { userId: string; kind: ScheduledKind; title: string; message: string; fireAt: Date; dedupKey?: string }) {
    if (n.dedupKey && (await prisma.scheduledNotification.findUnique({ where: { dedupKey: n.dedupKey } }))) return false;
    try {
      await prisma.scheduledNotification.create({ data: n });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return false; // carrera: otra instancia la creó primero
      throw e;
    }
  }
  async listPendingByUser(userId: string) {
    return (await prisma.scheduledNotification.findMany({ where: { userId, firedAt: null }, orderBy: { fireAt: 'asc' } })).map(toRecord);
  }
  async cancel(userId: string, id: string) {
    return (await prisma.scheduledNotification.deleteMany({ where: { id, userId, firedAt: null } })).count === 1;
  }
  async claimDue(now: Date, limit: number) {
    const candidates = await prisma.scheduledNotification.findMany({ where: { firedAt: null, fireAt: { lte: now } }, orderBy: { fireAt: 'asc' }, take: limit });
    const won: ScheduledNotificationRecord[] = [];
    for (const c of candidates) {
      const r = await prisma.scheduledNotification.updateMany({ where: { id: c.id, firedAt: null }, data: { firedAt: now } });
      if (r.count === 1) won.push(toRecord({ ...c, firedAt: now }));
    }
    return won;
  }
}
