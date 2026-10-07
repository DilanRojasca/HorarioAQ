import { describe, it, expect, beforeEach } from 'vitest';
import { SyncScheduleUseCase } from '../../../src/modules/schedule/application/SyncSchedule';
import { InMemoryEventBus } from '../../../src/shared/eventBus';
import {
  FakeInstitutional, InMemoryEnrollmentRepo, InMemoryScheduleRepo, InMemorySyncRuns, session,
} from '../../helpers/inMemory';

describe('SyncScheduleUseCase', () => {
  let schedules: InMemoryScheduleRepo, inst: FakeInstitutional, runs: InMemorySyncRuns;
  let bus: InMemoryEventBus, events: any[], uc: SyncScheduleUseCase, enroll: InMemoryEnrollmentRepo;

  beforeEach(() => {
    schedules = new InMemoryScheduleRepo();
    inst = new FakeInstitutional();
    runs = new InMemorySyncRuns();
    bus = new InMemoryEventBus();
    events = [];
    bus.subscribe('ScheduleChanged', (e) => { events.push(e); });
    enroll = new InMemoryEnrollmentRepo(['u1', 'u2']);
    uc = new SyncScheduleUseCase(
      { schedules, enrollments: enroll, institutional: inst, syncRuns: runs, bus },
      { semester: '2026-2', concurrency: 2 },
    );
  });

  it('importa horario nuevo y emite ScheduleChanged', async () => {
    inst.data.set('u1', [session()]);
    const r = await uc.execute({ trigger: 'MANUAL', actorId: 'admin' });
    await new Promise((x) => setTimeout(x, 0));
    expect(r).toMatchObject({ studentsSynced: 2, changesCount: 1 });
    expect(schedules.rows).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ userId: 'u1', semester: '2026-2' });
    expect(runs.runs[0]).toMatchObject({ status: 'OK', changesCount: 1, trigger: 'MANUAL' });
  });

  it('solo sincroniza estudiantes con matrícula vigente (RRF-01)', async () => {
    enroll.active = ['u1'];
    inst.data.set('u2', [session({ userId: 'u2', externalId: 'u2-ALG-1' })]);
    await uc.execute({ trigger: 'CRON' });
    expect(inst.calls).toBe(1);
    expect(schedules.rows).toHaveLength(0);
  });

  it('segunda sincronización idéntica no genera cambios ni eventos', async () => {
    inst.data.set('u1', [session()]);
    await uc.execute({ trigger: 'MANUAL' });
    events.length = 0;
    const r = await uc.execute({ trigger: 'MANUAL' });
    expect(r.changesCount).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('marca la corrida FAILED si el adaptador lanza', async () => {
    inst.fetchSchedule = async () => { throw new Error('institución caída'); };
    await expect(uc.execute({ trigger: 'MANUAL' })).rejects.toThrow('institución caída');
    expect(runs.runs[0].status).toBe('FAILED');
  });
});
