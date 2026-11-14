import { ClassSession } from './types';

/**
 * PATRÓN: Specification.
 * Cada criterio de búsqueda/filtro es una especificación pequeña y reutilizable con
 * `isSatisfiedBy`; `and`/`or`/`not` las combinan. Así RF-BUS-01 (nombre/código) y RF-BUS-02
 * (día, bloque, docente) comparten el mismo mecanismo y se pueden componer sin condicionales
 * anidados. `buildScheduleSpec` actúa de fábrica a partir de los parámetros de la consulta.
 *
 * Capa: DOMINIO (puro). Se usa en `GetWeeklyScheduleUseCase`.
 */
export interface Specification<T> {
  isSatisfiedBy(item: T): boolean;
}

export const and = <T>(...specs: Specification<T>[]): Specification<T> =>
  ({ isSatisfiedBy: (i) => specs.every((s) => s.isSatisfiedBy(i)) });
export const or = <T>(...specs: Specification<T>[]): Specification<T> =>
  ({ isSatisfiedBy: (i) => specs.some((s) => s.isSatisfiedBy(i)) });
export const not = <T>(spec: Specification<T>): Specification<T> => ({ isSatisfiedBy: (i) => !spec.isSatisfiedBy(i) });

/** Minúsculas y sin tildes: "algebra" encuentra "Álgebra". */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const courseMatches = (query: string): Specification<ClassSession> => {
  const q = normalize(query);
  return { isSatisfiedBy: (s) => normalize(s.courseName).includes(q) || normalize(s.courseCode).includes(q) };
};
export const onWeekday = (weekday: number): Specification<ClassSession> => ({ isSatisfiedBy: (s) => s.weekday === weekday });
export const inBlock = (block: string): Specification<ClassSession> => ({ isSatisfiedBy: (s) => normalize(s.block) === normalize(block) });
export const taughtBy = (teacher: string): Specification<ClassSession> => {
  const t = normalize(teacher);
  return { isSatisfiedBy: (s) => normalize(s.teacher).includes(t) };
};

export interface ScheduleFilter { q?: string; weekday?: number; block?: string; teacher?: string }

export function buildScheduleSpec(f: ScheduleFilter): Specification<ClassSession> {
  const specs: Specification<ClassSession>[] = [];
  if (f.q?.trim()) specs.push(courseMatches(f.q));
  if (f.weekday !== undefined) specs.push(onWeekday(f.weekday));
  if (f.block?.trim()) specs.push(inBlock(f.block));
  if (f.teacher?.trim()) specs.push(taughtBy(f.teacher));
  return and(...specs); // sin filtros: `every` de lista vacía = true
}
