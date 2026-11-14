import { describe, it, expect } from 'vitest';
import { and, buildScheduleSpec, courseMatches, normalize, not, or, onWeekday } from '../../../src/modules/schedule/domain/specifications';
import { session } from '../../helpers/inMemory';

const algebra = session({ courseName: 'Álgebra Lineal', courseCode: 'ALG-1', teacher: 'Marta Ríos', weekday: 1, block: 'A' });
const fisica = session({ courseName: 'Física', courseCode: 'FIS-2', teacher: 'Luis Gómez', weekday: 3, block: 'B' });

describe('Specification (RF-BUS-01/02)', () => {
  it('normaliza tildes y mayúsculas', () => expect(normalize('  ÁLGEBRA ')).toBe('algebra'));
  it('busca por nombre o código sin tildes', () => {
    expect(courseMatches('algebra').isSatisfiedBy(algebra)).toBe(true);
    expect(courseMatches('fis-2').isSatisfiedBy(fisica)).toBe(true);
    expect(courseMatches('quimica').isSatisfiedBy(algebra)).toBe(false);
  });
  it('combinadores and/or/not', () => {
    expect(and(courseMatches('alg'), onWeekday(1)).isSatisfiedBy(algebra)).toBe(true);
    expect(and(courseMatches('alg'), onWeekday(3)).isSatisfiedBy(algebra)).toBe(false);
    expect(or(onWeekday(1), onWeekday(3)).isSatisfiedBy(fisica)).toBe(true);
    expect(not(onWeekday(1)).isSatisfiedBy(algebra)).toBe(false);
  });
  it('la fábrica compone los filtros presentes; sin filtros deja pasar todo', () => {
    const all = [algebra, fisica];
    expect(all.filter((s) => buildScheduleSpec({}).isSatisfiedBy(s))).toHaveLength(2);
    expect(all.filter((s) => buildScheduleSpec({ weekday: 3 }).isSatisfiedBy(s))).toEqual([fisica]);
    expect(all.filter((s) => buildScheduleSpec({ block: 'a' }).isSatisfiedBy(s))).toEqual([algebra]);
    expect(all.filter((s) => buildScheduleSpec({ teacher: 'gomez' }).isSatisfiedBy(s))).toEqual([fisica]);
    expect(all.filter((s) => buildScheduleSpec({ q: 'alg', teacher: 'gomez' }).isSatisfiedBy(s))).toEqual([]);
  });
});
