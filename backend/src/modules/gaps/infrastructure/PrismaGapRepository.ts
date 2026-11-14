import { prisma } from '../../../shared/prisma';
import { Weekday } from '../../schedule/domain/types';
import { GapActivityRecord, GapKey, GapRepository, GapSlotRecord, GapStatus } from '../application/ports';

const where = (userId: string, k: GapKey) => ({ userId_weekday_startTime_endTime: { userId, weekday: k.weekday, startTime: k.startTime, endTime: k.endTime } });

export class PrismaGapRepository implements GapRepository {
  async listActivities(userId: string) {
    return (await prisma.gapActivity.findMany({ where: { userId } })).map((a) => ({ ...a, weekday: a.weekday as Weekday }) as GapActivityRecord);
  }
  async listSlots(userId: string) {
    return (await prisma.gapSlot.findMany({ where: { userId } })).map((s) => ({ ...s, weekday: s.weekday as Weekday, status: s.status as GapStatus }) as GapSlotRecord);
  }
  async upsertActivity(userId: string, k: GapKey, title: string) {
    const a = await prisma.gapActivity.upsert({ where: where(userId, k), create: { userId, ...k, title }, update: { title } });
    return { ...a, weekday: a.weekday as Weekday };
  }
  async deleteActivity(userId: string, k: GapKey) {
    return (await prisma.gapActivity.deleteMany({ where: { userId, ...k } })).count > 0;
  }
  async upsertSlot(userId: string, k: GapKey, status: GapStatus) {
    await prisma.gapSlot.upsert({ where: where(userId, k), create: { userId, ...k, status }, update: { status } });
  }
}
