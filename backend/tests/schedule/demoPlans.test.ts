import { describe, it, expect } from 'vitest';
import { PLANS } from '../../src/modules/schedule/infrastructure/demoPlans';
import { MockInstitutionalAdapter } from '../../src/modules/schedule/infrastructure/MockInstitutionalAdapter';
import { diffSchedules } from '../../src/modules/schedule/domain/diff';
import { detectGaps } from '../../src/modules/gaps/domain/gaps';
import { suggestFor } from '../../src/modules/gaps/domain/suggestions';
import { InMemorySyncRuns } from '../helpers/inMemory';

const fetchPlan = async (index: number, variant = false) => {
  const runs = new InMemorySyncRuns();
  if (variant) { const r = await runs.tryStart('MANUAL'); await runs.finish(r!.id, { status: 'OK', studentsSynced: 1, changesCount: 0 }); }
  return new MockInstitutionalAdapter(runs, { planOf: async () => index }).fetchSchedule('u1', '2026-2');
};
const mins = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

describe('Planes de demostración del adaptador mock', () => {
  it.each(PLANS.map((p, i) => [p.name, i] as const))('%s: ids únicos y ninguna clase se solapa con otra del mismo día', async (_n, i) => {
    const rows = await fetchPlan(i);
    expect(new Set(rows.map((r) => r.externalId)).size).toBe(rows.length);
    for (const a of rows) for (const b of rows) {
      if (a !== b && a.weekday === b.weekday) expect(mins(a.endTime) <= mins(b.startTime) || mins(b.endTime) <= mins(a.startTime), `${a.courseName} vs ${b.courseName}`).toBe(true);
    }
  });
  it.each(PLANS.map((p, i) => [p.name, i] as const))('%s: la variante trae cambio de aula, cancelación y clase nueva', async (_n, i) => {
    const types = diffSchedules(await fetchPlan(i), await fetchPlan(i, true)).map((c) => c.type);
    expect(types).toEqual(expect.arrayContaining(['UPDATED', 'CANCELLED', 'ADDED']));
  });
  it('entre todos los planes se ven las tres sugerencias de huecos (descanso, alimentación y estudio)', async () => {
    const kinds = new Set<string>();
    for (let i = 0; i < PLANS.length; i++) for (const g of detectGaps(await fetchPlan(i))) kinds.add(suggestFor(g.minutes)!.kind);
    expect([...kinds].sort()).toEqual(['MEAL', 'REST', 'STUDY']);
  });
  it('un plan inexistente cae al plan 0', async () => {
    expect((await fetchPlan(99)).map((r) => r.courseCode)).toEqual((await fetchPlan(0)).map((r) => r.courseCode));
  });
});
