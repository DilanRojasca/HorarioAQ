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
  async upsertActivity(userId: string, k: GapKey, title: string) {
    const a = await prisma.gapActivity.upsert({ where: where(userId, k), create: { userId, ...key(k), title }, update: { title } });
    return { ...a, weekday: a.weekday as Weekday };
  }
  async deleteActivity(userId: string, k: GapKey) {
    return (await prisma.gapActivity.deleteMany({ where: { userId, ...key(k) } })).count > 0;
  }
  async upsertSlot(userId: string, k: GapKey, status: GapStatus) {
    await prisma.gapSlot.upsert({ where: where(userId, k), create: { userId, ...key(k), status }, update: { status } });
  }
}
