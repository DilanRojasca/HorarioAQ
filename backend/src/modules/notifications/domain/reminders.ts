import { ClassSession } from '../../schedule/domain/types';

export const DEFAULT_REMINDER_MINUTES = 15;

export interface LocalClock { weekday: number; minutes: number; dateKey: string }

/** Día (1=lunes…7=domingo), minutos desde medianoche y fecha local (AAAA-MM-DD) en una zona horaria IANA. */
export function localClock(date: Date, timeZone: string): LocalClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
      .formatToParts(date).map((p) => [p.type, p.value]),
  );
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return { weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute), dateKey: `${parts.year}-${parts.month}-${parts.day}` };
}

export interface ReminderPlan { session: ClassSession; dedupKey: string }

/**
 * RF-NOT-02 (puro): clases ACTIVAS de HOY que empiezan dentro de los próximos `leadMinutes`.
 * La clave de deduplicación (usuario + clase + fecha local) hace que el job, que corre cada minuto,
 * cree el recordatorio una sola vez por clase y día.
 */
export function planClassReminders(sessions: ClassSession[], now: Date, leadMinutes: number, timeZone: string): ReminderPlan[] {
  const clock = localClock(now, timeZone);
  return sessions
    .filter((s) => s.status === 'ACTIVE' && s.weekday === clock.weekday)
    .filter((s) => {
      const [h, m] = s.startTime.split(':').map(Number);
      const until = h * 60 + m - clock.minutes;
      return until > 0 && until <= leadMinutes;
    })
    .map((session) => ({ session, dedupKey: `rem:${session.userId}:${session.externalId}:${clock.dateKey}` }));
}

export function reminderMessage(s: ClassSession, leadMinutes: number) {
  return {
    title: `Recordatorio: ${s.courseName}`,
    message: `Tu clase de ${s.courseName} empieza a las ${s.startTime} (en menos de ${leadMinutes} min). Bloque ${s.block}, Aula ${s.room}.`,
  };
}
