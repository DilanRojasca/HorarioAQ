import { describe, it, expect } from 'vitest';
import { MockInstitutionalAdapter } from '../../src/modules/schedule/infrastructure/MockInstitutionalAdapter';
import { diffSchedules } from '../../src/modules/schedule/domain/diff';

describe('MockInstitutionalAdapter', () => {
  it('1.ª consulta devuelve el horario base', async () => {
    const r = await new MockInstitutionalAdapter().fetchSchedule('u1', '2026-2');
    expect(r.length).toBe(8);
    expect(r.every((s) => s.userId === 'u1' && s.semester === '2026-2' && s.status === 'ACTIVE')).toBe(true);
    expect(new Set(r.map((s) => s.externalId)).size).toBe(8);
  });
  it('2.ª consulta del mismo usuario trae cambio de aula, cancelación y adición', async () => {
    const a = new MockInstitutionalAdapter();
    const first = await a.fetchSchedule('u1', '2026-2');
    const second = await a.fetchSchedule('u1', '2026-2');
    const changes = diffSchedules(first, second);
    const types = changes.map((c) => c.type);
    expect(types).toContain('UPDATED');
    expect(types).toContain('CANCELLED');
    expect(types).toContain('ADDED');
    const upd = changes.find((c) => c.type === 'UPDATED')!;
    expect(upd.after).toMatchObject({ block: 'B', room: '305' });
  });
  it('el estado es por usuario', async () => {
    const a = new MockInstitutionalAdapter();
    await a.fetchSchedule('u1', '2026-2');
    const other = await a.fetchSchedule('u2', '2026-2');
    expect(other.length).toBe(8);
  });
});
