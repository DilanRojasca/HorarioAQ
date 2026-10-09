import { prisma } from '../../../shared/prisma';
import { NotificationKind } from '../../../shared/events/types';
import { NotificationRecord, NotificationRepository } from '../application/ports';

type Row = Omit<NotificationRecord, 'kind'> & { kind: string };
const toRecord = (r: Row): NotificationRecord => ({ ...r, kind: r.kind as NotificationKind });

export class PrismaNotificationRepository implements NotificationRepository {
  async create(n: { userId: string; kind: NotificationKind; title: string; message: string }) {
    return toRecord(await prisma.notification.create({ data: n }));
  }

  async listByUser(userId: string, opts: { unreadOnly?: boolean; limit: number }) {
    const rows = await prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    });
    return rows.map(toRecord);
  }

  countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const owned = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) return false;
    await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return true;
  }

  async markAllRead(userId: string) {
    const r = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return r.count;
  }

  async findById(id: string) {
    const r = await prisma.notification.findUnique({ where: { id } });
    return r ? toRecord(r) : null;
  }

  async markEmailed(id: string, at: Date) {
    await prisma.notification.update({ where: { id }, data: { emailedAt: at } });
  }

  async listPendingEmail(since: Date, limit: number) {
    const rows = await prisma.notification.findMany({
      where: { emailedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map(toRecord);
  }
}
