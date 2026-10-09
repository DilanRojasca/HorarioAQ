import { describe, it, expect, beforeEach } from 'vitest';
import { SyncScheduleUseCase } from '../../../src/modules/schedule/application/SyncSchedule';
import { EventBus } from '../../../src/shared/events/EventBus';
import {
  FakeInstitutional, InMemoryEnrollmentRepo, InMemoryScheduleRepo, InMemorySyncRuns, session,
} from '../../helpers/inMemory';

describe('SyncScheduleUseCase', () => {
  let schedules: InMemoryScheduleRepo, inst: FakeInstitutional, runs: InMemorySyncRuns;
  let bus: EventBus, events: any[], uc: SyncScheduleUseCase, enroll: InMemoryEnrollmentRepo;

  beforeEach(() => {
    schedules = new InMemoryScheduleRepo();
    inst = new FakeInstitutional();
    runs = new InMemorySyncRuns();
    bus = new EventBus({ sleep: async () => {} });
    events = [];
    bus.subscribe('ScheduleChanged', (e) => { events.push(e); }, { name: 'test' });
    enroll = new InMemoryEnrollmentRepo(['u1', 'u2']);
    uc = new SyncScheduleUseCase(
      { schedules, enrollments: enroll, institutional: inst, syncRuns: runs, bus },
      { semester: '2026-2', concurrency: 2 },
    );
  });

  it('importa horario nuevo y emite ScheduleChanged', async () => {
    inst.data.set('u1', [session()]);
    const r = await uc.execute({ trigger: 'MANUAL', actorId: 'admin' });
    await bus.idle();
    expect(r).toMatchObject({ studentsSynced: 2, changesCount: 1 });
    expect(schedules.rows).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ userId: 'u1', semester: '2026-2' });
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

  it('un fallo por estudiante no aborta a los demás: PARTIAL con cifras reales', async () => {
    inst.data.set('u1', [session()]);
    const orig = inst.fetchSchedule.bind(inst);
    inst.fetchSchedule = async (id: string) => { if (id === 'u2') throw new Error('fallo u2'); return orig(id); };
    const r = await uc.execute({ trigger: 'MANUAL' });
    expect(r).toMatchObject({ studentsSynced: 1, changesCount: 1, failures: 1 });
    expect(schedules.rows).toHaveLength(1);
    expect(runs.runs[0]).toMatchObject({ status: 'PARTIAL', studentsSynced: 1, changesCount: 1 });
  });

  it('si falla la lista de matrículas la corrida queda FAILED', async () => {
    enroll.listActiveStudentIds = async () => { throw new Error('bd caída'); };
    await expect(uc.execute({ trigger: 'CRON' })).rejects.toThrow('bd caída');
    expect(runs.runs[0].status).toBe('FAILED');
  });

  it('single-flight: dos ejecuciones solapadas → la segunda recibe 409', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    inst.fetchSchedule = async () => { await gate; return []; };
    const first = uc.execute({ trigger: 'MANUAL' });
    await bus.idle();
    await expect(uc.execute({ trigger: 'CRON' })).rejects.toMatchObject({ status: 409, code: 'SYNC_IN_PROGRESS' });
    release();
    await first;
    await expect(uc.execute({ trigger: 'MANUAL' })).resolves.toBeDefined();
    expect(runs.runs).toHaveLength(2);
  });

  it('una corrida RUNNING de hace más de 1 h se considera obsoleta', async () => {
    await runs.tryStart('CRON');
    runs.runs[0].startedAt = new Date(Date.now() - 2 * 3_600_000);
    await expect(uc.execute({ trigger: 'MANUAL' })).resolves.toBeDefined();
  });

  describe('eventos de sincronización', () => {
    it('publica SyncCompleted con changesByType y failures', async () => {
      inst.data.set('u1', [session(), session({ externalId: 'u1-FIS-1', courseCode: 'FIS' })]);
      const orig = inst.fetchSchedule.bind(inst);
      inst.fetchSchedule = async (id: string) => { if (id === 'u2') throw new Error('fallo u2'); return orig(id); };
      const completed: any[] = [];
      bus.subscribe('SyncCompleted', (e) => { completed.push(e.payload); }, { name: 'test' });
      const r = await uc.execute({ trigger: 'MANUAL', actorId: 'admin' });
      await bus.idle();
      expect(completed).toEqual([{
        runId: r.runId, trigger: 'MANUAL', studentsSynced: 1, changesCount: 2, failures: 1,
        changesByType: { ADDED: 2, UPDATED: 0, CANCELLED: 0 },
      }]);
    });

    it('cuenta actualizaciones y cancelaciones por tipo', async () => {
      schedules.rows = [session(), session({ externalId: 'u1-FIS-1', courseCode: 'FIS' })];
      inst.data.set('u1', [session({ room: '305' })]); // ALG cambia de aula, FIS desaparece
      const completed: any[] = [];
      bus.subscribe('SyncCompleted', (e) => { completed.push(e.payload); }, { name: 'test' });
      await uc.execute({ trigger: 'CRON' });
      await bus.idle();
      expect(completed[0].changesByType).toEqual({ ADDED: 0, UPDATED: 1, CANCELLED: 1 });
    });

    it('publica SyncFailed con el mensaje cuando la corrida queda FAILED', async () => {
      inst.fetchSchedule = async () => { throw new Error('institución caída'); };
      const failed: any[] = [];
      bus.subscribe('SyncFailed', (e) => { failed.push(e.payload); }, { name: 'test' });
      await expect(uc.execute({ trigger: 'CRON' })).rejects.toThrow('institución caída');
      await bus.idle();
      expect(failed).toEqual([{ runId: 'run1', trigger: 'CRON', message: 'institución caída' }]);
    });

    it('publica SyncFailed si falla la lista de matrículas', async () => {
      enroll.listActiveStudentIds = async () => { throw new Error('bd caída'); };
      const failed: any[] = [];
      bus.subscribe('SyncFailed', (e) => { failed.push(e.payload); }, { name: 'test' });
      await expect(uc.execute({ trigger: 'CRON' })).rejects.toThrow('bd caída');
      await bus.idle();
      expect(failed[0]).toMatchObject({ message: 'bd caída' });
    });

    it('un observador lento o que falla no retrasa ni cambia el resultado', async () => {
      inst.data.set('u1', [session()]);
      bus.subscribe('SyncCompleted', () => new Promise<void>(() => {}), { name: 'colgado' }); // nunca termina
      const r = await uc.execute({ trigger: 'MANUAL' });
      expect(r).toMatchObject({ studentsSynced: 2, changesCount: 1, failures: 0 });
      expect(runs.runs[0].status).toBe('OK');
    });
  });
});
