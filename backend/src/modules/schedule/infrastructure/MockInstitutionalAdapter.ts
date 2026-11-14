import { ClassSession } from '../domain/types';
import { InstitutionalPort, SyncRunRepository } from '../application/ports';
import { PLANS, Tpl } from './demoPlans';

export interface MockOptions {
  /** Plan de horario (índice de `PLANS`) que le corresponde a un usuario. Sin esto todos reciben el plan 0. */
  planOf?: (userId: string) => Promise<number | undefined>;
}

/**
 * Simula el sistema académico institucional (RRF-07). Determinista y sin estado propio:
 * devuelve el horario base de su plan mientras no exista ninguna corrida de sincronización OK; desde
 * entonces devuelve una variante con cambios (cambio de aula, una clase cancelada y una nueva). Al depender del
 * historial en BD es seguro ante reinicios y réplicas. Los planes por carrera están en `demoPlans.ts`.
 *
 * @pattern Adapter | Adaptador de MockInstitutionalAdapter | Simula Admisiones/Registro; el real solo requiere otra clase que implemente el puerto.
 */
export class MockInstitutionalAdapter implements InstitutionalPort {
  constructor(private syncRuns: SyncRunRepository, private opts: MockOptions = {}) {}

  async fetchSchedule(userId: string, semester: string): Promise<ClassSession[]> {
    // La corrida en curso está RUNNING, así que no cuenta.
    const variant = (await this.syncRuns.list(200)).some((r) => r.status === 'OK');
    const index = (await this.opts.planOf?.(userId)) ?? 0;
    const plan = PLANS[index] ?? PLANS[0];

    const build = (t: Tpl, over: Partial<ClassSession> = {}): ClassSession => ({
      ...t, userId, semester, externalId: `${userId}-${t.courseCode}-${t.weekday}`, status: 'ACTIVE', ...over,
    });

    const rows = plan.base.map((t) => {
      if (!variant) return build(t);
      if (t.courseCode === plan.variant.update.courseCode) return build({ ...t, ...plan.variant.update.over });
      if (t.courseCode === plan.variant.cancel) return build(t, { status: 'CANCELLED' });
      return build(t);
    });
    if (variant) rows.push(build(plan.variant.add));
    return rows;
  }
}
