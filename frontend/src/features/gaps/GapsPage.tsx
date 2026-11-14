import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { card } from '../../shared/ui';
import { Button, ErrorNotice, fieldInput, Switch } from '../../shared/forms';
import { WEEKDAYS } from '../schedule/filter';
import { createActivity, listGaps, removeActivity, setGapStatus, updateActivity } from './api';
import type { Gap, GapKey } from './api';

const SUGGESTION_ICON = { REST: 'free_cancellation', MEAL: 'event', STUDY: 'school' } as const;
const keyOf = (g: Gap): GapKey => ({ weekday: g.weekday, startTime: g.startTime, endTime: g.endTime });
const idOf = (g: Gap) => `${g.weekday}-${g.startTime}-${g.endTime}`;
const minutesLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

/** RF-HUE-01..04: huecos entre clases, sugerencias por duración, actividad propia y disponibilidad. */
export default function GapsPage() {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setGaps(await listGaps()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los huecos'); setGaps((p) => p ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
  };

  const save = (g: Gap) => (e: FormEvent) => {
    e.preventDefault();
    const title = (drafts[idOf(g)] ?? '').trim();
    if (!title) return;
    void run(async () => { await (g.activity ? updateActivity : createActivity)(keyOf(g), title); setDrafts((d) => ({ ...d, [idOf(g)]: '' })); });
  };

  const days = gaps ? [...new Set(gaps.map((g) => g.weekday))].sort() : [];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-headline-xl-mobile text-on-surface">Tiempos libres</h1>
        <p className="mb-0 mt-1 text-body-md text-on-surface-variant">Huecos entre tus clases del mismo día, con ideas para aprovecharlos.</p>
      </header>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {gaps === null ? (
        <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando huecos…</p>
      ) : gaps.length === 0 ? (
        !error && <p className={`${card} m-0 p-4 text-body-md text-on-surface-variant`}>No tienes huecos entre clases (o aún no hay horario).</p>
      ) : days.map((d) => (
        <section key={d} aria-labelledby={`day-${d}`} className="space-y-3">
          <h2 id={`day-${d}`} className="m-0 text-headline-md font-bold text-on-surface">{WEEKDAYS[d - 1]}</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {gaps.filter((g) => g.weekday === d).map((g) => {
              const id = idOf(g);
              const occupied = g.status === 'OCCUPIED';
              return (
                <li key={id} data-gap className={`${card} space-y-3 p-3.5 ${occupied ? 'opacity-80' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="m-0 text-title-sm text-on-surface">{g.startTime} – {g.endTime}</p>
                    <span className="text-label-md text-on-surface-variant">{minutesLabel(g.minutes)}</span>
                  </div>

                  {g.activity ? (
                    <p className="m-0 flex items-center gap-2 text-body-md text-on-surface">
                      <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">event</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{g.activity.title}</span>
                      <button type="button" onClick={() => void run(() => removeActivity(keyOf(g)))} className="text-label-md font-semibold text-primary underline" aria-label={`Quitar actividad ${g.activity.title}`}>Quitar</button>
                    </p>
                  ) : g.suggestion ? (
                    <p className="m-0 flex gap-2 text-body-md text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">{SUGGESTION_ICON[g.suggestion.kind]}</span>
                      <span><strong className="text-on-surface">{g.suggestion.title}.</strong> {g.suggestion.detail}</span>
                    </p>
                  ) : (
                    <p className="m-0 text-body-sm text-on-surface-variant">{occupied ? 'Marcado como ocupado: no se te sugerirán actividades aquí.' : ''}</p>
                  )}

                  <form onSubmit={save(g)} className="flex gap-2">
                    <input
                      aria-label={`Actividad propia para ${g.startTime}–${g.endTime}`} placeholder={g.activity ? 'Cambiar el nombre de la actividad' : 'Tu propia actividad'} maxLength={80} disabled={occupied}
                      value={drafts[id] ?? ''} onChange={(e) => setDrafts((x) => ({ ...x, [id]: e.target.value }))} className={fieldInput}
                    />
                    <Button type="submit" variant="secondary" disabled={occupied || !(drafts[id] ?? '').trim()}>{g.activity ? 'Actualizar' : 'Asignar'}</Button>
                  </form>

                  <Switch
                    checked={occupied} label="Marcar como ocupado" description="No se te sugerirán actividades en este hueco."
                    onChange={(v) => void run(() => setGapStatus(keyOf(g), v ? 'OCCUPIED' : 'AVAILABLE'))}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
