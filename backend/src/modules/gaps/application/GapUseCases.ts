import { badRequest, notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { EnrollmentRepository, ScheduleRepository } from '../../schedule/application/ports';
import { Gap, detectGaps, sameGap } from '../domain/gaps';
import { Suggestion, suggestFor } from '../domain/suggestions';
import { GapKey, GapRepository, GapStatus } from './ports';

export interface GapView extends Gap {
  status: GapStatus;
  activity: { id: string; title: string } | null;
  /** Solo si el hueco está disponible y no tiene actividad propia (RF-HUE-02/04). */
  suggestion: Suggestion | null;
}

/**
 * Casos de uso de huecos (RF-HUE-01..04). Comparten `GapService` (PATRÓN Facade interno): una sola
 * clase que combina horario + repositorio de huecos + dominio puro.
 */
export class GapService {
  constructor(
    private schedules: ScheduleRepository, private enrollments: EnrollmentRepository,
    private gaps: GapRepository, private semester: string,
  ) {}

  private async currentGaps(userId: string): Promise<Gap[]> {
    if (!(await this.enrollments.hasActive(userId, this.semester))) return [];
    return detectGaps(await this.schedules.findByUser(userId, this.semester));
  }

  async list(userId: string): Promise<GapView[]> {
    const [found, activities, slots] = await Promise.all([this.currentGaps(userId), this.gaps.listActivities(userId), this.gaps.listSlots(userId)]);
    return found.map((g) => {
      const status = slots.find((s) => sameGap(s, g))?.status ?? 'AVAILABLE';
      const act = activities.find((a) => sameGap(a, g));
      return {
        ...g, status, activity: act ? { id: act.id, title: act.title } : null,
        suggestion: status === 'AVAILABLE' && !act ? suggestFor(g.minutes) : null,
      };
    });
  }

  /** El hueco debe existir hoy en el horario del estudiante (no se aceptan franjas inventadas). */
  async assertExists(userId: string, key: GapKey): Promise<void> {
    if (!(await this.currentGaps(userId)).some((g) => sameGap(g, key))) throw notFound('Ese hueco no existe en tu horario');
  }

  repo() { return this.gaps; }
}

export class ListGapsUseCase implements UseCase<{ userId: string }, GapView[]> {
  constructor(private svc: GapService) {}
  execute({ userId }: { userId: string }) { return this.svc.list(userId); }
}

/** RF-HUE-03: asignar una actividad propia a un hueco concreto. */
export class AssignActivityUseCase implements UseCase<{ userId: string; gap: GapKey; title: string }, { id: string; title: string }> {
  constructor(private svc: GapService) {}
  async execute({ userId, gap, title }: { userId: string; gap: GapKey; title: string }) {
    const t = title.trim();
    if (t.length < 1 || t.length > 80) throw badRequest('El título debe tener entre 1 y 80 caracteres');
    await this.svc.assertExists(userId, gap);
    const a = await this.svc.repo().upsertActivity(userId, gap, t);
    return { id: a.id, title: a.title };
  }
}

export class RemoveActivityUseCase implements UseCase<{ userId: string; gap: GapKey }, void> {
  constructor(private svc: GapService) {}
  async execute({ userId, gap }: { userId: string; gap: GapKey }) {
    if (!(await this.svc.repo().deleteActivity(userId, gap))) throw notFound('Ese hueco no tiene actividad');
  }
}

/** RF-HUE-04: marcar un hueco como ocupado/disponible (afecta las sugerencias futuras). */
export class SetGapStatusUseCase implements UseCase<{ userId: string; gap: GapKey; status: GapStatus }, void> {
  constructor(private svc: GapService) {}
  async execute({ userId, gap, status }: { userId: string; gap: GapKey; status: GapStatus }) {
    await this.svc.assertExists(userId, gap);
    await this.svc.repo().upsertSlot(userId, gap, status);
  }
}
