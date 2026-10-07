import { WEEKDAYS, sessionsByDay } from './grid';
import type { Session } from './types';

export default function AgendaList({ sessions, onSelect }: { sessions: Session[]; onSelect(s: Session): void }) {
  const byDay = sessionsByDay(sessions);
  return (
    <div className="agenda">
      {WEEKDAYS.filter((d) => byDay[d.n].length > 0).map((d) => (
        <section key={d.n} aria-labelledby={`day-${d.n}`}>
          <h3 id={`day-${d.n}`}>{d.label}</h3>
          <ul>
            {byDay[d.n].map((s) => (
              <li key={s.externalId}>
                <button type="button" className="btn secondary" onClick={() => onSelect(s)}>
                  <span className="time">{s.startTime}–{s.endTime}</span> {s.courseName}<br />
                  <span className="muted">Bloque {s.block} · Piso {s.floor} · Aula {s.room}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
