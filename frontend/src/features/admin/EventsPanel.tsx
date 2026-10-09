import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api';
import { eventTypeLabel, formatDateTime, statusBadge } from './runs';

interface Delivery { observer: string; status: 'OK' | 'FAILED'; attempts: number; error?: string; deliveredAt: string }
interface AdminEvent { id: string; type: string; payload: unknown; occurredAt: string; deliveries: Delivery[] }

const card = 'rounded-[10px] border border-outline-variant bg-surface-container-lowest shadow-[0_1px_3px_rgba(27,42,51,0.04),0_1px_2px_rgba(27,42,51,0.02)]';
const LIMIT = 20;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumen corto con datos reales del payload (solo para los tipos conocidos). */
function summary(e: AdminEvent): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  if (e.type === 'ScheduleChanged' && Array.isArray(p.changes)) return plural(p.changes.length, 'cambio', 'cambios');
  if (e.type === 'SyncCompleted' && typeof p.studentsSynced === 'number' && typeof p.changesCount === 'number') {
    return `${plural(p.studentsSynced, 'estudiante', 'estudiantes')}, ${plural(p.changesCount, 'cambio', 'cambios')}`;
  }
  if (e.type === 'SyncFailed' && typeof p.message === 'string') return p.message;
  return null;
}

/** Historial de eventos de dominio y de la entrega a cada observador (solo ADMIN). */
export default function EventsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setBusy(true);
    try {
      const data = await api.get<AdminEvent[]>(`/admin/events?limit=${LIMIT}`);
      if (mine !== seq.current) return; // respuesta obsoleta: gana la última
      setEvents(data);
      setError('');
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los eventos');
      setEvents((prev) => prev ?? []);
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <section aria-labelledby="events-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="events-title" className="m-0 flex items-center gap-1.5 text-headline-md text-on-surface">
          <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">bolt</span>
          Eventos recientes
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-label-md font-semibold text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className={`material-symbols-outlined text-[18px] ${busy ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true">refresh</span>
          Actualizar
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-3 flex gap-2.5 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-error">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <p className="m-0 text-body-md font-medium">{error}</p>
        </div>
      )}

      {events === null ? (
        <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando eventos…</p>
      ) : events.length === 0 ? (
        !error && <p className={`${card} m-0 p-4 text-body-md text-on-surface-variant`}>Aún no hay eventos.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
          {events.map((ev) => {
            const text = summary(ev);
            return (
              <li key={ev.id} data-event className={`${card} min-w-0 p-3.5`}>
                <p className="m-0 text-title-sm text-on-surface">{eventTypeLabel(ev.type)}</p>
                <p className="m-0 mt-0.5 text-body-sm text-on-surface-variant">
                  {formatDateTime(ev.occurredAt)}{text ? ` · ${text}` : ''}
                </p>
                {ev.deliveries.length === 0 ? (
                  <p className="m-0 mt-2 text-body-sm text-on-surface-variant">Sin entregas registradas</p>
                ) : (
                  <ul aria-label="Entrega por observador" className="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
                    {ev.deliveries.map((d, i) => {
                      const badge = statusBadge(d.status);
                      return (
                        <li
                          key={`${d.observer}-${i}`}
                          title={d.error}
                          className={`inline-flex min-h-[24px] max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-label-sm ${badge.classes}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} aria-hidden="true" />
                          <span className="truncate font-semibold">{d.observer}</span>
                          <span>{badge.label}</span>
                          {d.attempts > 1 && <span>· {d.attempts} intentos</span>}
                          {d.error && <span className="sr-only">. Error: {d.error}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
