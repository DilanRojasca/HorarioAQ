import { EventBus, UseCase } from '../../../shared/ports';
import { diffSchedules } from '../domain/diff';
import { EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRepository } from './ports';

export interface SyncInput { trigger: 'MANUAL' | 'CRON'; actorId?: string }
export interface SyncResult { runId: string; studentsSynced: number; changesCount: number }
interface Deps {
  schedules: ScheduleRepository;
  enrollments: EnrollmentRepository;
  institutional: InstitutionalPort;
  syncRuns: SyncRunRepository;
  bus: EventBus;
}

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Facade: orquesta adaptador institucional → diff → persistencia → eventos. Único escritor del horario. */
export class SyncScheduleUseCase implements UseCase<SyncInput, SyncResult> {
  constructor(private d: Deps, private opts: { semester: string; concurrency: number }) {}

  async execute(input: SyncInput): Promise<SyncResult> {
    const { schedules, enrollments, institutional, syncRuns, bus } = this.d;
    const { semester, concurrency } = this.opts;
    const run = await syncRuns.start(input.trigger, input.actorId);
    try {
      const ids = await enrollments.listActiveStudentIds(semester);
      let changesCount = 0;
      for (const batch of chunk(ids, concurrency)) {
        await Promise.all(
          batch.map(async (userId) => {
            const [local, remote] = await Promise.all([
              schedules.findByUser(userId, semester),
              institutional.fetchSchedule(userId, semester),
            ]);
            const changes = diffSchedules(local, remote);
            if (changes.length === 0) return;
            await schedules.applyChanges(userId, semester, changes);
            changesCount += changes.length;
            bus.publish({ type: 'ScheduleChanged', userId, semester, changes });
          }),
        );
      }
      await syncRuns.finish(run.id, { status: 'OK', studentsSynced: ids.length, changesCount });
      return { runId: run.id, studentsSynced: ids.length, changesCount };
    } catch (err) {
      await syncRuns.finish(run.id, { status: 'FAILED', studentsSynced: 0, changesCount: 0 });
      throw err;
    }
  }
}
