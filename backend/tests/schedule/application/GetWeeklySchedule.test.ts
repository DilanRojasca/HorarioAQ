import { describe, it, expect } from 'vitest';
import { GetWeeklyScheduleUseCase } from '../../../src/modules/schedule/application/GetWeeklySchedule';
import { InMemoryEnrollmentRepo, InMemoryScheduleRepo, session } from '../../helpers/inMemory';

const setup = () => {
  const repo = new InMemoryScheduleRepo();
  repo.rows = [
    session({ externalId: 'a', weekday: 2, startTime: '08:00' }),
    session({ externalId: 'b', weekday: 1, startTime: '14:00' }),
    session({ externalId: 'c', weekday: 1, startTime: '08:00', status: 'CANCELLED' }),
    session({ externalId: 'd', userId: 'u2', weekday: 3 }),
  ];
  return new GetWeeklyScheduleUseCase(repo, new InMemoryEnrollmentRepo(['u1', 'u2']), '2026-2');
};

describe('GetWeeklyScheduleUseCase', () => {
  it('devuelve solo sesiones activas del usuario, ordenadas', async () => {
    const r = await setup().execute({ requesterId: 'u1', requesterRole: 'STUDENT' });
    expect(r.enrolled).toBe(true);
    expect(r.sessions.map((s) => s.externalId)).toEqual(['b', 'a']);
  });
  it('estudiante no puede ver a otro (RRF-04)', async () => {
    await expect(setup().execute({ requesterId: 'u1', requesterRole: 'STUDENT', targetUserId: 'u2' }))
      .rejects.toMatchObject({ status: 403 });
  });
  it('admin puede ver a otro', async () => {
    const r = await setup().execute({ requesterId: 'admin', requesterRole: 'ADMIN', targetUserId: 'u2' });
    expect(r.userId).toBe('u2');
    expect(r.sessions).toHaveLength(1);
  });
  it('sin matrícula vigente: enrolled=false y lista vacía (RRF-01)', async () => {
    const uc = new GetWeeklyScheduleUseCase(new InMemoryScheduleRepo(), new InMemoryEnrollmentRepo([]), '2026-2');
    const r = await uc.execute({ requesterId: 'u1', requesterRole: 'STUDENT' });
    expect(r).toMatchObject({ enrolled: false, sessions: [] });
  });
});
