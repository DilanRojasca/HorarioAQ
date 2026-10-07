import { AppError } from '../../../shared/errors';
import { EventBus, UseCase } from '../../../shared/ports';
import { diffSchedules } from '../domain/diff';
import { EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRepository } from './ports';

export interface SyncInput { trigger: 'MANUAL' | 'CRON'; actorId?: string }
export interface SyncResult { runId: string; studentsSynced: number; changesCount: number; failures: number }
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
    const run = await syncRuns.tryStart(input.trigger, input.actorId);
    if (!run) throw new AppError(409, 'SYNC_IN_PROGRESS', 'Ya hay una sincronización en curso');

    let ids: string[];
    try {
      ids = await enrollments.listActiveStudentIds(semester);
    } catch (err) {
      await syncRuns.finish(run.id, { status: 'FAILED', studentsSynced: 0, changesCount: 0 });
      throw err;
    }

    let synced = 0;
    let failures = 0;
    let changesCount = 0;
    let firstError: unknown;
    for (const batch of chunk(ids, concurrency)) {
      const settled = await Promise.allSettled(
        batch.map(async (userId) => {
          const [local, remote] = await Promise.all([
            schedules.findByUser(userId, semester),
            institutional.fetchSchedule(userId, semester),
          ]);
          const changes = diffSchedules(local, remote);
          if (changes.length === 0) return 0;
          await schedules.applyChanges(userId, semester, changes);
          bus.publish({ type: 'ScheduleChanged', userId, semester, changes });
          return changes.length;
        }),
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') { synced++; changesCount += r.value; }
        else { failures++; firstError ??= r.reason; }
      }
    }

    if (ids.length > 0 && synced === 0) {
      await syncRuns.finish(run.id, { status: 'FAILED', studentsSynced: synced, changesCount });
      throw firstError;
    }
    await syncRuns.finish(run.id, { status: failures > 0 ? 'PARTIAL' : 'OK', studentsSynced: synced, changesCount });
    return { runId: run.id, studentsSynced: synced, changesCount, failures };
  }
}
