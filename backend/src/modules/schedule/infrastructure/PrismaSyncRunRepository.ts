import { prisma } from '../../../shared/prisma';
import { SyncRunRepository } from '../application/ports';

export class PrismaSyncRunRepository implements SyncRunRepository {
  async start(trigger: string, actorId?: string) {
    const r = await prisma.syncRun.create({ data: { trigger, actorId } });
    return { id: r.id };
  }
  async finish(id: string, r: { status: 'OK' | 'FAILED'; studentsSynced: number; changesCount: number }) {
    await prisma.syncRun.update({ where: { id }, data: { ...r, finishedAt: new Date() } });
  }
  list(limit: number) {
    return prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
  }
}
