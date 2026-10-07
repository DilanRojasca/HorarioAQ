import type { Session } from './types';

export const WEEKDAYS = [
  { n: 1, label: 'Lunes' }, { n: 2, label: 'Martes' }, { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' }, { n: 5, label: 'Viernes' }, { n: 6, label: 'Sábado' },
];
export const GRID_START = 7 * 60;
export const GRID_END = 21 * 60;

export const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const gridRow = (t: string) => (toMinutes(t) - GRID_START) / 30 + 2;

export function sessionsByDay(sessions: Session[]): Record<number, Session[]> {
  const out: Record<number, Session[]> = {};
  for (const d of WEEKDAYS) out[d.n] = [];
  for (const s of sessions) (out[s.weekday] ??= []).push(s);
  for (const k of Object.keys(out)) out[+k].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return out;
}

export function todaySessions(sessions: Session[], date = new Date()): Session[] {
  const day = date.getDay() || 7;
  return sessions.filter((s) => s.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
}
