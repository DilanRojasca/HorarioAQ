import { NotificationKind } from '../../../shared/events/types';
import { ClassSession, ScheduleChange } from '../../schedule/domain/types';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const day = (d: number) => DAYS[d - 1] ?? String(d);

export interface DescribedChange { kind: NotificationKind; title: string; message: string }

function updateParts(b: ClassSession, a: ClassSession): string[] {
  const parts: string[] = [];
  if (b.room !== a.room) parts.push(`Aula: ${b.room} → ${a.room}`);
  if (b.block !== a.block) parts.push(`Bloque: ${b.block} → ${a.block}`);
  if (b.floor !== a.floor) parts.push(`Piso: ${b.floor} → ${a.floor}`);
  if (b.startTime !== a.startTime || b.endTime !== a.endTime) {
    parts.push(`Horario: ${b.startTime}–${b.endTime} → ${a.startTime}–${a.endTime}`);
  }
  if (b.weekday !== a.weekday) parts.push(`Día: ${day(b.weekday)} → ${day(a.weekday)}`);
  if (b.teacher !== a.teacher) parts.push(`Docente: ${b.teacher} → ${a.teacher}`);
  return parts;
}

/** Texto en español de un cambio de horario (puro). */
export function describeChange(change: ScheduleChange): DescribedChange {
  const s = (change.after ?? change.before)!;
  switch (change.type) {
    case 'ADDED':
      return {
        kind: 'SCHEDULE_ADDED',
        title: `Nueva clase: ${s.courseName}`,
        message: `${s.courseName} los ${day(s.weekday)} de ${s.startTime} a ${s.endTime} en Bloque ${s.block}, Aula ${s.room}.`,
      };
    case 'CANCELLED': {
      const c = change.before ?? s;
      return {
        kind: 'SCHEDULE_CANCELLED',
        title: `Clase cancelada: ${c.courseName}`,
        message: `La clase de ${c.courseName} del ${day(c.weekday)} (${c.startTime}–${c.endTime}) fue cancelada.`,
      };
    }
    case 'UPDATED': {
      const parts = change.before && change.after ? updateParts(change.before, change.after) : [];
      return {
        kind: 'SCHEDULE_UPDATED',
        title: `Cambio en ${s.courseName}`,
        message: parts.length ? parts.join(' · ') : 'Se actualizó la clase.',
      };
    }
  }
}
