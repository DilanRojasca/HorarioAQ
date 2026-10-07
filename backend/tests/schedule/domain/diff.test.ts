import { describe, it, expect } from 'vitest';
import { diffSchedules } from '../../../src/modules/schedule/domain/diff';
import { ClassSession } from '../../../src/modules/schedule/domain/types';

const mk = (over: Partial<ClassSession> = {}): ClassSession => ({
  externalId: 'u1-ALG-1', userId: 'u1', semester: '2026-2', courseCode: 'ALG', courseName: 'Algoritmos',
  teacher: 'Marta', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201',
  status: 'ACTIVE', ...over,
});

describe('diffSchedules', () => {
  it('sin diferencias devuelve []', () => {
    expect(diffSchedules([mk()], [mk()])).toEqual([]);
  });
  it('detecta ADDED', () => {
    const c = diffSchedules([], [mk()]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ type: 'ADDED', externalId: 'u1-ALG-1' });
  });
  it('ignora sesiones remotas ya canceladas que no existen localmente', () => {
    expect(diffSchedules([], [mk({ status: 'CANCELLED' })])).toEqual([]);
  });
  it('detecta UPDATED (cambio de aula y bloque)', () => {
    const c = diffSchedules([mk()], [mk({ room: '305', block: 'B' })]);
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe('UPDATED');
    expect(c[0].before?.room).toBe('201');
    expect(c[0].after?.room).toBe('305');
  });
  it('detecta CANCELLED cuando falta en remoto', () => {
    const c = diffSchedules([mk()], []);
    expect(c[0]).toMatchObject({ type: 'CANCELLED' });
    expect(c[0].after?.status).toBe('CANCELLED');
  });
  it('detecta CANCELLED cuando remoto la marca cancelada', () => {
    const c = diffSchedules([mk()], [mk({ status: 'CANCELLED' })]);
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe('CANCELLED');
  });
  it('local cancelada y ausente en remoto no genera cambio', () => {
    expect(diffSchedules([mk({ status: 'CANCELLED' })], [])).toEqual([]);
  });
  it('reactivación se reporta como UPDATED', () => {
    const c = diffSchedules([mk({ status: 'CANCELLED' })], [mk()]);
    expect(c[0].type).toBe('UPDATED');
  });
});
