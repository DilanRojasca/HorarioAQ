import type { Session } from './types';

/**
 * Réplica en el cliente de las Specifications del backend
 * (`backend/src/modules/schedule/domain/specifications.ts`, patrón Specification). Filtrar aquí da
 * resultados instantáneos mientras se escribe (RF-BUS-01 "tiempo real") sin una petición por tecla;
 * la API admite los mismos filtros por query-string para otros clientes.
 */
export interface ScheduleFilter { q: string; weekday: number | null; block: string; teacher: string }
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const EMPTY_FILTER: ScheduleFilter = { q: '', weekday: null, block: '', teacher: '' };

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const isFiltering = (f: ScheduleFilter) => !!(f.q.trim() || f.weekday !== null || f.block || f.teacher);

/** @pattern Specification | Réplica en el cliente | Filtra al instante mientras se escribe, con los mismos criterios que el backend. */
export function filterSessions(sessions: Session[], f: ScheduleFilter): Session[] {
  const q = normalize(f.q);
  return sessions.filter((s) =>
    (!q || normalize(s.courseName).includes(q) || normalize(s.courseCode).includes(q))
    && (f.weekday === null || s.weekday === f.weekday)
    && (!f.block || normalize(s.block) === normalize(f.block))
    && (!f.teacher || s.teacher === f.teacher));
}

/** Valores distintos y ordenados para poblar los selectores. */
export const distinct = (sessions: Session[], pick: (s: Session) => string) => [...new Set(sessions.map(pick))].sort((a, b) => a.localeCompare(b, 'es'));
