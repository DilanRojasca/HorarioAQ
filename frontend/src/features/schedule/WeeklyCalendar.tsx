import { GRID_END, GRID_START, WEEKDAYS, gridRow } from './grid';
import type { Session } from './types';

const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, i) => GRID_START / 60 + i);
const ROWS = (GRID_END - GRID_START) / 30;

export default function WeeklyCalendar({ sessions, onSelect }: { sessions: Session[]; onSelect(s: Session): void }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-outline-variant bg-surface-container-lowest">
      <div
        className="grid min-w-[780px]"
        style={{ gridTemplateColumns: '56px repeat(6, minmax(120px, 1fr))', gridTemplateRows: `auto repeat(${ROWS}, 28px)` }}
        role="group"
        aria-label="Horario semanal"
      >
        <div className="row-start-1 bg-primary-container" style={{ gridColumn: 1 }} aria-hidden="true" />
        {WEEKDAYS.map((d) => (
          <div key={d.n} className="row-start-1 bg-primary-container p-2 text-center text-label-md font-bold text-on-primary" style={{ gridColumn: d.n + 1 }}>
            {d.label}
          </div>
        ))}
        {WEEKDAYS.map((d) => (
          <div key={`col-${d.n}`} className="border-l border-outline-variant/60" style={{ gridColumn: d.n + 1, gridRow: `2 / ${ROWS + 2}` }} aria-hidden="true" />
        ))}
        {HOURS.map((h) => (
          <div
            key={h}
            className="border-t border-outline-variant/60 px-1 py-0.5 text-right text-body-sm text-on-surface-variant"
            style={{ gridColumn: 1, gridRow: `${(h * 60 - GRID_START) / 30 + 2} / span 2` }}
          >
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
        {sessions.map((s) => (
          <button
            key={s.externalId}
            type="button"
            className="m-px overflow-hidden rounded-md border border-outline-variant border-l-4 border-l-secondary-container bg-surface-container-low px-1.5 py-1 text-left text-body-sm text-on-surface hover:bg-surface-container"
            style={{ gridColumn: String(s.weekday + 1), gridRow: `${gridRow(s.startTime)} / ${gridRow(s.endTime)}` }}
            onClick={() => onSelect(s)}
            aria-label={`${s.courseName}, ${WEEKDAYS.find((d) => d.n === s.weekday)?.label} ${s.startTime} a ${s.endTime}, bloque ${s.block}, aula ${s.room}`}
          >
            <strong className="block font-bold leading-tight text-primary">{s.courseName}</strong>
            <span className="block">{s.startTime}–{s.endTime}</span>
            <span className="block text-on-surface-variant">Bloque {s.block} · Aula {s.room}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
