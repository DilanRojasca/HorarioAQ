import { GRID_END, GRID_START, WEEKDAYS, gridRow } from './grid';
import type { Session } from './types';

const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, i) => GRID_START / 60 + i);

export default function WeeklyCalendar({ sessions, onSelect }: { sessions: Session[]; onSelect(s: Session): void }) {
  return (
    <div className="week-wrap">
      <div className="week-grid" role="group" aria-label="Horario semanal">
        <div className="head" style={{ gridColumn: 1 }} aria-hidden="true" />
        {WEEKDAYS.map((d) => (
          <div key={d.n} className="head" style={{ gridColumn: d.n + 1 }}>{d.label}</div>
        ))}
        {HOURS.map((h) => (
          <div key={h} className="hour" style={{ gridColumn: 1, gridRow: `${(h * 60 - GRID_START) / 30 + 2} / span 2` }}>
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
        {sessions.map((s) => (
          <button
            key={s.externalId}
            type="button"
            className="session"
            style={{ gridColumn: String(s.weekday + 1), gridRow: `${gridRow(s.startTime)} / ${gridRow(s.endTime)}` }}
            onClick={() => onSelect(s)}
            aria-label={`${s.courseName}, ${WEEKDAYS.find((d) => d.n === s.weekday)?.label} ${s.startTime} a ${s.endTime}, bloque ${s.block}, aula ${s.room}`}
          >
            <strong>{s.courseName}</strong>
            <span>{s.startTime}–{s.endTime}</span><br />
            <span>Bloque {s.block} · Aula {s.room}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
