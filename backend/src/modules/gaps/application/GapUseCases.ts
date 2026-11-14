import { badRequest, conflict, notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { EnrollmentRepository, ScheduleRepository } from '../../schedule/application/ports';
import { Gap, detectGaps, sameGap } from '../domain/gaps';
import { Suggestion, suggestFor } from '../domain/suggestions';
import { GapActivityRecord, GapKey, GapRepository, GapStatus } from './ports';

export interface GapView extends Gap {
  status: GapStatus;
  activity: { id: string; title: string } | null;
  /** Solo si el hueco está disponible y no tiene actividad propia (RF-HUE-02/04). */
  suggestion: Suggestion | null;
}

/**
 * Casos de uso de huecos (RF-HUE-01..04). Comparten `GapService` (PATRÓN Facade interno): una sola
 * clase que combina horario + repositorio de huecos + dominio puro.
 *
 * @pattern Facade | Fachada interna de huecos | Combina horario, repositorio y dominio para que los casos de uso sean de una línea.
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

  /** Estado del hueco (por defecto, disponible). */
  async statusOf(userId: string, key: GapKey): Promise<GapStatus> {
    return (await this.gaps.listSlots(userId)).find((s) => sameGap(s, key))?.status ?? 'AVAILABLE';
  }

  repo() { return this.gaps; }
}

export class ListGapsUseCase implements UseCase<{ userId: string }, GapView[]> {
  constructor(private svc: GapService) {}
  execute({ userId }: { userId: string }) { return this.svc.list(userId); }
}

const validTitle = (title: string) => {
  const t = title.trim();
  if (t.length < 1 || t.length > 80) throw badRequest('El título debe tener entre 1 y 80 caracteres');
  return t;
};
const view = (a: GapActivityRecord) => ({ id: a.id, weekday: a.weekday, startTime: a.startTime, endTime: a.endTime, title: a.title });
export type ActivityView = ReturnType<typeof view>;

/** RF-HUE-03 (consultar): actividades propias del estudiante. */
export class ListActivitiesUseCase implements UseCase<{ userId: string }, ActivityView[]> {
  constructor(private svc: GapService) {}
  async execute({ userId }: { userId: string }) { return (await this.svc.repo().listActivities(userId)).map(view); }
}

/**
 * RF-HUE-03 (crear). Regla de negocio: la actividad solo puede asignarse a un hueco que EXISTE en el horario actual,
 * que NO está marcado como ocupado y que NO tiene ya una actividad (una por hueco). El caso de uso decide; el controlador solo traduce a HTTP.
 */
export class CreateActivityUseCase implements UseCase<{ userId: string; gap: GapKey; title: string }, ActivityView> {
  constructor(private svc: GapService) {}
  async execute({ userId, gap, title }: { userId: string; gap: GapKey; title: string }) {
    const t = validTitle(title);
    await this.svc.assertExists(userId, gap);
    if ((await this.svc.statusOf(userId, gap)) === 'OCCUPIED') throw conflict('El hueco está marcado como ocupado: márcalo como disponible antes de asignarle una actividad');
    const created = await this.svc.repo().createActivity(userId, gap, t);
    if (!created) throw conflict('Ese hueco ya tiene una actividad: modifícala con PUT');
    return view(created);
  }
}

/** RF-HUE-03 (actualizar): cambia el título de la actividad de un hueco. */
export class UpdateActivityUseCase implements UseCase<{ userId: string; gap: GapKey; title: string }, ActivityView> {
  constructor(private svc: GapService) {}
  async execute({ userId, gap, title }: { userId: string; gap: GapKey; title: string }) {
    const updated = await this.svc.repo().updateActivity(userId, gap, validTitle(title));
    if (!updated) throw notFound('Ese hueco no tiene actividad');
    return view(updated);
  }
}

/** RF-HUE-03 (eliminar). */
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
