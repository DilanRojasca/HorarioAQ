import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GapCard } from './GapBlockView';
import { gapBlocksByDay, gapKey } from './gapBlocks';
import type { GapBlock } from './gapBlocks';
import { sessionsByDay } from './grid';
import { durationLabel, weekDays } from './time';
import type { Session } from './types';
import { card } from '../../shared/ui';

interface Props { sessions: Session[]; now: Date; onSelect(s: Session): void; gaps?: GapBlock[] }

/** Vista móvil de la semana: pestañas LUN–SÁB y las clases del día elegido. */
export default function DayAgenda({ sessions, now, onSelect, gaps = [] }: Props) {
  const days = weekDays(now);
  const todayIso = now.getDay() || 7;
  const [selected, setSelected] = useState<number>(todayIso > 6 ? 1 : todayIso);
  const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const list = sessionsByDay(sessions)[selected] ?? [];
  const gapList = gapBlocksByDay(gaps)[selected] ?? [];
  // Clases y actividades de huecos juntas, en orden cronológico
  const items = [
    ...list.map((s) => ({ at: s.startTime, node: 'session' as const, s })),
    ...gapList.map((b) => ({ at: b.startTime, node: 'gap' as const, b })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  function move(to: number) {
    setSelected(to);
    tabRefs.current[to]?.focus();
  }
  function onKeyDown(e: KeyboardEvent) {
    const i = days.findIndex((d) => d.weekday === selected);
    if (e.key === 'ArrowRight') { e.preventDefault(); move(days[(i + 1) % days.length].weekday); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(days[(i - 1 + days.length) % days.length].weekday); }
    else if (e.key === 'Home') { e.preventDefault(); move(days[0].weekday); }
    else if (e.key === 'End') { e.preventDefault(); move(days[days.length - 1].weekday); }
  }

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Días de la semana" onKeyDown={onKeyDown} className="grid grid-cols-6 border-b border-outline-variant">
        {days.map((d) => {
          const on = d.weekday === selected;
          return (
            <button
              key={d.weekday}
              ref={(el) => { tabRefs.current[d.weekday] = el; }}
              id={`daytab-${d.weekday}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="daypanel"
              aria-current={d.weekday === todayIso ? 'date' : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => setSelected(d.weekday)}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 after:absolute after:inset-x-1 after:bottom-0 after:h-[3px] after:rounded-full ${
                on ? 'text-primary after:bg-secondary-container' : 'text-on-surface-variant hover:text-primary after:bg-transparent'
              }`}
            >
              <span className="text-label-sm">{d.label}</span>
              <span className={`text-title-md ${on ? 'font-bold' : 'font-medium'}`}>{d.dayOfMonth}</span>
            </button>
          );
        })}
      </div>

      <div id="daypanel" role="tabpanel" aria-labelledby={`daytab-${selected}`} className="space-y-3">
        {items.length === 0 ? (
          <p className={`${card} m-0 p-4 text-center text-body-md text-on-surface-variant`}>No hay clases este día.</p>
        ) : (
          items.map((it) => it.node === 'gap' ? <GapCard key={gapKey(it.b)} block={it.b} /> : (
            <article key={it.s.externalId} className={`${card} border-l-4 border-l-secondary-container p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 flex items-center gap-1.5 text-body-md font-bold text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">schedule</span>
                  {it.s.startTime} – {it.s.endTime}
                </p>
                <span className="rounded-full border border-outline-variant/60 bg-surface-container-high px-2 py-0.5 text-label-sm text-primary">
                  {durationLabel(it.s.startTime, it.s.endTime)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelect(it.s)}
                className="mt-1 min-h-[44px] w-full text-left text-title-md font-bold text-primary hover:underline"
              >
                {it.s.courseName}
              </button>
              <p className="m-0 flex items-center gap-1.5 text-body-md font-medium text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">apartment</span>
                Bloque {it.s.block} · Aula {it.s.room}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
