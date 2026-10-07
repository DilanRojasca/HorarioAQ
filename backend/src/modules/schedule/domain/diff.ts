import { ClassSession, ScheduleChange } from './types';

const FIELDS: Array<keyof ClassSession> = [
  'courseCode', 'courseName', 'teacher', 'weekday', 'startTime', 'endTime',
  'block', 'floor', 'room', 'status',
];

const sameContent = (a: ClassSession, b: ClassSession) => FIELDS.every((f) => a[f] === b[f]);

export function diffSchedules(local: ClassSession[], remote: ClassSession[]): ScheduleChange[] {
  const localMap = new Map(local.map((s) => [s.externalId, s]));
  const remoteMap = new Map(remote.map((s) => [s.externalId, s]));
  const changes: ScheduleChange[] = [];

  for (const r of remote) {
    const l = localMap.get(r.externalId);
    if (!l) {
      if (r.status === 'ACTIVE') changes.push({ type: 'ADDED', externalId: r.externalId, userId: r.userId, after: r });
    } else if (l.status === 'ACTIVE' && r.status === 'CANCELLED') {
      changes.push({ type: 'CANCELLED', externalId: r.externalId, userId: r.userId, before: l, after: r });
    } else if (!sameContent(l, r)) {
      changes.push({ type: 'UPDATED', externalId: r.externalId, userId: r.userId, before: l, after: r });
    }
  }

  for (const l of local) {
    if (l.status === 'ACTIVE' && !remoteMap.has(l.externalId)) {
      changes.push({
        type: 'CANCELLED', externalId: l.externalId, userId: l.userId,
        before: l, after: { ...l, status: 'CANCELLED' },
      });
    }
  }
  return changes;
}
