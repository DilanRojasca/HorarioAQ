import { describe, it, expect } from 'vitest';
import { MockInstitutionalAdapter } from '../../src/modules/schedule/infrastructure/MockInstitutionalAdapter';
import { diffSchedules } from '../../src/modules/schedule/domain/diff';
import { InMemorySyncRuns } from '../helpers/inMemory';

const okRun = async (runs: InMemorySyncRuns, status: 'OK' | 'FAILED' | 'PARTIAL' = 'OK') => {
  const r = await runs.tryStart('MANUAL');
  await runs.finish(r!.id, { status, studentsSynced: 1, changesCount: 0 });
};

describe('MockInstitutionalAdapter', () => {
  it('sin corridas OK previas devuelve el horario base', async () => {
    const runs = new InMemorySyncRuns();
    await runs.tryStart('MANUAL'); // la corrida en curso (RUNNING) no cuenta
    const r = await new MockInstitutionalAdapter(runs).fetchSchedule('u1', '2026-2');
    expect(r.length).toBe(8);
    expect(r.every((s) => s.userId === 'u1' && s.semester === '2026-2' && s.status === 'ACTIVE')).toBe(true);
    expect(new Set(r.map((s) => s.externalId)).size).toBe(8);
  });
  it('con al menos una corrida OK previa trae cambio de aula, cancelación y adición', async () => {
    const runs = new InMemorySyncRuns();
    const base = await new MockInstitutionalAdapter(runs).fetchSchedule('u1', '2026-2');
    await okRun(runs);
    const variant = await new MockInstitutionalAdapter(runs).fetchSchedule('u1', '2026-2');
    const changes = diffSchedules(base, variant);
    const types = changes.map((c) => c.type);
    expect(types).toContain('UPDATED');
    expect(types).toContain('CANCELLED');
    expect(types).toContain('ADDED');
    expect(changes.find((c) => c.type === 'UPDATED')!.after).toMatchObject({ block: 'B', floor: 3, room: '305' });
    expect(variant.find((s) => s.courseCode === 'PHY201')!.status).toBe('CANCELLED');
  });
  it('es determinista y sin estado propio: una instancia nueva (reinicio) devuelve lo mismo', async () => {
    const runs = new InMemorySyncRuns();
    await okRun(runs);
    const a = await new MockInstitutionalAdapter(runs).fetchSchedule('u1', '2026-2');
    const b = await new MockInstitutionalAdapter(runs).fetchSchedule('u1', '2026-2');
    expect(b).toEqual(a);
    expect(diffSchedules(a, b)).toHaveLength(0);
  });
  it('las corridas FAILED o PARTIAL no activan la variante', async () => {
    const runs = new InMemorySyncRuns();
    await okRun(runs, 'FAILED');
    await okRun(runs, 'PARTIAL');
    const r = await new MockInstitutionalAdapter(runs).fetchSchedule('u1', '2026-2');
    expect(r.length).toBe(8);
    expect(r.every((s) => s.status === 'ACTIVE')).toBe(true);
  });
});
