import { describe, it, expect } from 'vitest';
import { EMPTY_FILTER, distinct, filterSessions, isFiltering, normalize } from './filter';
import type { Session } from './types';

const s = (o: Partial<Session>): Session => ({
  externalId: 'x', userId: 'u', semester: '2026-2', courseCode: 'ALG', courseName: 'Álgebra', teacher: 'Marta', weekday: 1,
  startTime: '08:00', endTime: '10:00', block: 'A', floor: 1, room: '1', status: 'ACTIVE', ...o,
});
const list = [s({ externalId: 'a' }), s({ externalId: 'b', courseName: 'Física', courseCode: 'FIS', teacher: 'Luis', weekday: 3, block: 'B' })];

describe('filterSessions (réplica de Specification)', () => {
  it('sin filtros devuelve todo', () => { expect(filterSessions(list, EMPTY_FILTER)).toHaveLength(2); expect(isFiltering(EMPTY_FILTER)).toBe(false); });
  it('busca por nombre o código sin tildes', () => {
    expect(filterSessions(list, { ...EMPTY_FILTER, q: 'algebra' }).map((x) => x.externalId)).toEqual(['a']);
    expect(filterSessions(list, { ...EMPTY_FILTER, q: 'fis' }).map((x) => x.externalId)).toEqual(['b']);
  });
  it('combina día, bloque y docente', () => {
    expect(filterSessions(list, { ...EMPTY_FILTER, weekday: 3 }).map((x) => x.externalId)).toEqual(['b']);
    expect(filterSessions(list, { ...EMPTY_FILTER, block: 'a' }).map((x) => x.externalId)).toEqual(['a']);
    expect(filterSessions(list, { ...EMPTY_FILTER, teacher: 'Luis', weekday: 1 })).toEqual([]);
  });
  it('helpers', () => { expect(normalize(' ÁÉ ')).toBe('ae'); expect(distinct(list, (x) => x.block)).toEqual(['A', 'B']); });
});
