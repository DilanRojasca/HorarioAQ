import { prisma } from '../../../shared/prisma';
import { Weekday } from '../../schedule/domain/types';
import { GapActivityRecord, GapKey, GapRepository, GapSlotRecord, GapStatus } from '../application/ports';

/** Solo los 3 campos de la clave: si llega un objeto con más campos (p. ej. un hueco completo) no se cuelan a la base. */
const key = (k: GapKey) => ({ weekday: k.weekday, startTime: k.startTime, endTime: k.endTime });
const where = (userId: string, k: GapKey) => ({ userId_weekday_startTime_endTime: { userId, ...key(k) } });

/** @pattern Repository | Implementación con Prisma/PostgreSQL | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. */
export class PrismaGapRepository implements GapRepository {
  async listActivities(userId: string) {
    return (await prisma.gapActivity.findMany({ where: { userId } })).map((a) => ({ ...a, weekday: a.weekday as Weekday }) as GapActivityRecord);
  }
  async listSlots(userId: string) {
    return (await prisma.gapSlot.findMany({ where: { userId } })).map((s) => ({ ...s, weekday: s.weekday as Weekday, status: s.status as GapStatus }) as GapSlotRecord);
  }
  async findActivity(userId: string, k: GapKey) {
    const a = await prisma.gapActivity.findUnique({ where: where(userId, k) });
    return a ? { ...a, weekday: a.weekday as Weekday } : null;
  }
  async createActivity(userId: string, k: GapKey, title: string) {
    try {
      const a = await prisma.gapActivity.create({ data: { userId, ...key(k), title } });
      return { ...a, weekday: a.weekday as Weekday };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return null; // restricción única: ya había una actividad en ese hueco
      throw e;
    }
  }
  async updateActivity(userId: string, k: GapKey, title: string) {
    const r = await prisma.gapActivity.updateMany({ where: { userId, ...key(k) }, data: { title } });
    return r.count === 0 ? null : this.findActivity(userId, k);
  }
  async deleteActivity(userId: string, k: GapKey) {
    return (await prisma.gapActivity.deleteMany({ where: { userId, ...key(k) } })).count > 0;
  }
  async upsertSlot(userId: string, k: GapKey, status: GapStatus) {
    await prisma.gapSlot.upsert({ where: where(userId, k), create: { userId, ...key(k), status }, update: { status } });
  }
}
