import { Prisma, ClassSession as Row } from '@prisma/client';
import { prisma } from '../../../shared/prisma';
import { ClassSession, ScheduleChange, SessionStatus, Weekday } from '../domain/types';
import { ScheduleRepository } from '../application/ports';

const toDomain = (r: Row): ClassSession => ({
  externalId: r.externalId, userId: r.userId, semester: r.semester, courseCode: r.courseCode,
  courseName: r.courseName, teacher: r.teacher, weekday: r.weekday as Weekday, startTime: r.startTime,
  endTime: r.endTime, block: r.block, floor: r.floor, room: r.room, status: r.status as SessionStatus,
});

const toData = (s: ClassSession) => ({
  externalId: s.externalId, userId: s.userId, semester: s.semester, courseCode: s.courseCode,
  courseName: s.courseName, teacher: s.teacher, weekday: s.weekday, startTime: s.startTime,
  endTime: s.endTime, block: s.block, floor: s.floor, room: s.room, status: s.status,
});

const json = (v?: ClassSession) => (v ? (v as unknown as Prisma.InputJsonValue) : Prisma.JsonNull);

export class PrismaScheduleRepository implements ScheduleRepository {
  async findByUser(userId: string, semester: string) {
    return (await prisma.classSession.findMany({ where: { userId, semester } })).map(toDomain);
  }

  async findOne(userId: string, externalId: string) {
    const r = await prisma.classSession.findUnique({ where: { userId_externalId: { userId, externalId } } });
    return r ? toDomain(r) : null;
  }

  async applyChanges(userId: string, _semester: string, changes: ScheduleChange[]) {
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const c of changes) {
      const where = { userId_externalId: { userId, externalId: c.externalId } };
      if (c.type === 'CANCELLED') {
        ops.push(prisma.classSession.update({ where, data: { status: 'CANCELLED' } }));
      } else {
        const data = toData(c.after!);
        ops.push(prisma.classSession.upsert({ where, create: data, update: data }));
      }
      ops.push(prisma.scheduleChange.create({
        data: { userId, externalId: c.externalId, type: c.type, before: json(c.before), after: json(c.after) },
      }));
    }
    await prisma.$transaction(ops);
  }
}
