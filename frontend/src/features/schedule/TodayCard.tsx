import { classStatus, dayLabel, shortDate } from './time';
import { todaySessions } from './grid';
import type { Session } from './types';
import { card } from '../../shared/ui';

export default function TodayCard({ sessions, now, onSelect }: { sessions: Session[]; now: Date; onSelect(s: Session): void }) {
  const today = todaySessions(sessions, now);
  const status = classStatus(today, now);
  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="today-title">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low/70 p-3.5">
        <h2 id="today-title" className="m-0 flex items-center gap-2 text-headline-md font-bold text-on-surface">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-secondary-container motion-safe:animate-pulse" />
          <span>Hoy <span className="font-normal text-on-surface-variant">({dayLabel(now)})</span></span>
        </h2>
        <span className="shrink-0 rounded-full bg-surface-container-highest px-2.5 py-0.5 text-label-md font-semibold text-primary">{shortDate(now)}</span>
      </div>
      <div className="space-y-3 p-3.5">
        {today.length === 0 ? (
          <div className="flex flex-col items-center px-2 py-4 text-center">
            <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary-container">
              <span className="material-symbols-outlined" aria-hidden="true">free_cancellation</span>
            </span>
            <p className="m-0 text-title-md font-semibold text-on-surface">No tienes clases programadas para hoy</p>
            <p className="mb-0 mt-1 text-body-md text-on-surface-variant">Aprovecha el día; tu horario de la semana está más abajo.</p>
          </div>
        ) : (
          today.map((s) => (
            <article key={s.externalId} className="rounded-[10px] border border-l-4 border-outline-variant border-l-secondary-container bg-surface-container-low p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded border border-outline-variant/40 bg-surface px-2 py-0.5 text-body-md font-bold text-on-surface">
                  {s.startTime} – {s.endTime}
                </span>
                {status[s.externalId] === 'ONGOING' && (
                  <span className="rounded-full border border-[#1E7E34]/20 bg-[#E8F5E9] px-2 py-0.5 text-label-sm text-[#1E7E34]">En curso</span>
                )}
                {status[s.externalId] === 'NEXT' && (
                  <span className="rounded-full border border-outline-variant/60 bg-surface-container-high px-2 py-0.5 text-label-sm text-primary">Siguiente</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="mt-1 min-h-[44px] w-full text-left text-title-md font-bold text-primary hover:underline"
              >
                {s.courseName}
              </button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="m-0 flex items-center gap-1.5 text-body-md font-medium text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">location_on</span>
                  Bloque {s.block} · Aula {s.room}
                </p>
                <p className="m-0 flex items-center gap-1.5 text-body-md text-tertiary">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person</span>
                  {s.teacher}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
