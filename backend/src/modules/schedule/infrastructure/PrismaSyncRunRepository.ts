import { prisma } from '../../../shared/prisma';
import { SyncRunRepository, SyncRunRecord, SyncStats } from '../application/ports';

const LOCK_KEY = 727_368_001; // clave arbitraria del advisory lock de sincronización
const STALE_MS = 3_600_000; // una corrida RUNNING de más de 1 h se considera obsoleta

export class PrismaSyncRunRepository implements SyncRunRepository {
  /** Comprobación + inserción bajo un advisory lock transaccional: seguro entre réplicas. */
  async tryStart(trigger: string, actorId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      const running = await tx.syncRun.findFirst({
        where: { status: 'RUNNING', startedAt: { gt: new Date(Date.now() - STALE_MS) } },
        select: { id: true },
      });
      if (running) return null;
      const r = await tx.syncRun.create({ data: { trigger, actorId } });
      return { id: r.id };
    });
  }
  async finish(id: string, r: { status: 'OK' | 'FAILED' | 'PARTIAL'; studentsSynced: number; changesCount: number }) {
    await prisma.syncRun.update({ where: { id }, data: { ...r, finishedAt: new Date() } });
  }
  async saveStats(id: string, stats: SyncStats) {
    await prisma.syncRun.update({ where: { id }, data: { stats } });
  }
  async list(limit: number) {
    const rows = await prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
    return rows.map((r): SyncRunRecord => ({ ...r, stats: r.stats as SyncStats | null }));
  }
}
