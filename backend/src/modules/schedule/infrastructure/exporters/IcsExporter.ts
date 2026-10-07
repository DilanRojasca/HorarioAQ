import { ClassSession } from '../../domain/types';
import { BaseExporter } from './BaseExporter';

interface Opts { semesterStart: string; weeks: number; now?: () => Date }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const pad = (n: number) => String(n).padStart(2, '0');

export class IcsExporter extends BaseExporter {
  protected readonly contentType = 'text/calendar; charset=utf-8';
  protected readonly extension = 'ics';
  constructor(private opts: Opts) { super(); }

  private dateFor(weekday: number): string {
    const [y, m, d] = this.opts.semesterStart.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const startWeekday = start.getUTCDay() || 7;
    const offset = (weekday - startWeekday + 7) % 7;
    const dt = new Date(start.getTime() + offset * 86_400_000);
    return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
  }

  private stamp(): string {
    const n = (this.opts.now ?? (() => new Date()))();
    return `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`;
  }

  protected async render(sessions: ClassSession[], ownerName: string): Promise<Buffer> {
    const hhmm = (t: string) => t.replace(':', '') + '00';
    const dtstamp = this.stamp();
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Horario UNI//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc('Horario ' + ownerName)}`,
      // Colombia no tiene horario de verano: un único offset fijo -05:00.
      'BEGIN:VTIMEZONE', 'TZID:America/Bogota',
      'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0500', 'TZNAME:-05', 'END:STANDARD',
      'END:VTIMEZONE',
    ];
    for (const s of sessions) {
      const day = this.dateFor(s.weekday);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.externalId}@horariouni`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=America/Bogota:${day}T${hhmm(s.startTime)}`,
        `DTEND;TZID=America/Bogota:${day}T${hhmm(s.endTime)}`,
        `RRULE:FREQ=WEEKLY;COUNT=${this.opts.weeks}`,
        `SUMMARY:${esc(s.courseName)}`,
        `LOCATION:${esc(`Bloque ${s.block} - Piso ${s.floor} - Aula ${s.room}`)}`,
        `DESCRIPTION:${esc(`Docente: ${s.teacher}`)}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return Buffer.from(lines.join('\r\n') + '\r\n', 'utf8');
  }
}
