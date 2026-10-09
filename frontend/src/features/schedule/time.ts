import { toMinutes } from './grid';
import type { Session } from './types';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export type ClassState = 'ONGOING' | 'NEXT';

/** "2 horas", "1 hora", "1 h 30 min", "45 min". */
export function durationLabel(start: string, end: string): string {
  const total = toMinutes(end) - toMinutes(start);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h} h ${m} min`;
}

/** Estado de las clases de HOY (según `now`): en curso y la primera futura. */
export function classStatus(sessions: Session[], now: Date): Record<string, ClassState> {
  const day = now.getDay() || 7;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = sessions.filter((x) => x.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const out: Record<string, ClassState> = {};
  let nextSet = false;
  for (const x of today) {
    const start = toMinutes(x.startTime);
    const end = toMinutes(x.endTime);
    if (start <= minutes && minutes < end) out[x.externalId] = 'ONGOING';
    else if (start > minutes && !nextSet) { out[x.externalId] = 'NEXT'; nextSet = true; }
  }
  return out;
}

/** "20 Ago 2026". */
export function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Nombre del día en minúsculas ("miércoles"). */
export function dayLabel(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/** Hasta dos iniciales en mayúscula. */
export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export interface WeekDay { weekday: 1 | 2 | 3 | 4 | 5 | 6; label: string; dayOfMonth: number }

/** Lunes a sábado de la semana (ISO) que contiene `now`; el domingo cierra su semana. */
export function weekDays(now: Date): WeekDay[] {
  const iso = now.getDay() || 7;
  return DAY_LABELS.map((label, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (iso - 1) + i);
    return { weekday: (i + 1) as WeekDay['weekday'], label, dayOfMonth: d.getDate() };
  });
}
