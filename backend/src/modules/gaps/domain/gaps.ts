import { activeSessions } from '../../schedule/domain/sort';
import { ClassSession, Weekday } from '../../schedule/domain/types';

/** Hueco mínimo que se reporta (menos de 15 min no alcanza para hacer nada útil). */
export const MIN_GAP_MINUTES = 15;

export interface Gap { weekday: Weekday; startTime: string; endTime: string; minutes: number }

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * RF-HUE-01: espacios libres entre dos clases CONSECUTIVAS del mismo día (puro, sin I/O).
 * Las clases canceladas no cuentan; las superpuestas se fusionan para no inventar huecos falsos.
 */
export function detectGaps(sessions: ClassSession[], minMinutes = MIN_GAP_MINUTES): Gap[] {
  const byDay = new Map<Weekday, ClassSession[]>();
  for (const s of activeSessions(sessions)) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);
  const gaps: Gap[] = [];
  for (const [weekday, list] of byDay) {
    const sorted = list.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    let coveredUntil = sorted[0] ? toMinutes(sorted[0].endTime) : 0;
    let coveredEnd = sorted[0]?.endTime ?? '';
    for (const next of sorted.slice(1)) {
      const start = toMinutes(next.startTime);
      const minutes = start - coveredUntil;
      if (minutes >= minMinutes) gaps.push({ weekday, startTime: coveredEnd, endTime: next.startTime, minutes });
      if (toMinutes(next.endTime) > coveredUntil) { coveredUntil = toMinutes(next.endTime); coveredEnd = next.endTime; }
    }
  }
  return gaps.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

export const sameGap = (a: Pick<Gap, 'weekday' | 'startTime' | 'endTime'>, b: Pick<Gap, 'weekday' | 'startTime' | 'endTime'>) =>
  a.weekday === b.weekday && a.startTime === b.startTime && a.endTime === b.endTime;
