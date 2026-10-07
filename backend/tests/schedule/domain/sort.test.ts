import { describe, it, expect } from 'vitest';
import { sortSessions, activeSessions } from '../../../src/modules/schedule/domain/sort';
import { ClassSession } from '../../../src/modules/schedule/domain/types';

const s = (weekday: number, startTime: string, status = 'ACTIVE') =>
  ({ weekday, startTime, status, externalId: `${weekday}${startTime}` }) as unknown as ClassSession;

describe('sort', () => {
  it('ordena por día y hora', () => {
    const r = sortSessions([s(2, '08:00'), s(1, '14:00'), s(1, '08:00')]);
    expect(r.map((x) => x.externalId)).toEqual(['108:00', '114:00', '208:00']);
  });
  it('activeSessions filtra canceladas', () => {
    expect(activeSessions([s(1, '08:00'), s(1, '09:00', 'CANCELLED')])).toHaveLength(1);
  });
});
