import { useEffect, useMemo, useState } from 'react';
import { useRealtime } from '../../shared/RealtimeProvider';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../notifications/ToastProvider';
import ClassDetail from './ClassDetail';
import DayAgenda from './DayAgenda';
import ExportMenu from './ExportMenu';
import { EMPTY_FILTER, filterSessions, isFiltering } from './filter';
import type { ScheduleFilter } from './filter';
import SearchFilters from './SearchFilters';
import NoEnrollment from './NoEnrollment';
import TodayCard from './TodayCard';
import WeeklyCalendar from './WeeklyCalendar';
import type { Session } from './types';
import { useGapBlocks } from './useGapBlocks';
import { useSchedule } from './useSchedule';

export default function SchedulePage() {
  const { data, error, loading, refetch } = useSchedule();
  const { blocks: gapBlocks, reload: reloadGaps } = useGapBlocks();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Session | null>(null);
  const [filter, setFilter] = useState<ScheduleFilter>(EMPTY_FILTER);
  const [, setTick] = useState(0);
  const filtered = useMemo(() => filterSessions(data?.sessions ?? [], filter), [data, filter]);
  // Al buscar o filtrar clases se ocultan las actividades de huecos (no son clases)
  const shownGaps = isFiltering(filter) ? [] : gapBlocks;
  // Refresca "En curso / Siguiente" cada minuto.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  // Observador del flujo en vivo: el servidor avisa de que el horario cambió y se recarga sin parpadeo.
  useRealtime('schedule-changed', () => {
    void refetch();
    void reloadGaps();
    toast({ title: 'Tu horario cambió', message: 'Actualizamos tu horario con los últimos cambios.', tone: 'info' });
  });
  const now = new Date();

  if (loading) return <p role="status" className="m-0 py-6 text-center text-body-md text-on-surface-variant">Cargando horario…</p>;
  if (error) {
    return <p role="alert" className="m-0 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-body-md font-medium text-error">{error}</p>;
  }
  if (!data?.enrolled) return <NoEnrollment semester={data?.semester ?? ''} />;

  return (
    <div className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="m-0 text-headline-xl-mobile text-on-surface">
            Mi horario <span className="text-headline-md text-primary">· {data.semester}</span>
          </h1>
          <span className="rounded-full border border-outline-variant/60 bg-surface-container-high px-2 py-0.5 text-label-sm text-primary">Activo</span>
        </div>
        {user?.name && <p className="mb-0 mt-1 text-body-sm text-on-surface-variant">{user.name}</p>}
      </header>

      <ExportMenu />
      <TodayCard sessions={data.sessions} now={now} onSelect={setSelected} gaps={shownGaps} />
      <SearchFilters sessions={data.sessions} value={filter} onChange={setFilter} matches={filtered.length} />

      <section aria-labelledby="week-title" className="space-y-3">
        <h2 id="week-title" className="m-0 text-headline-md font-bold text-on-surface">Semana</h2>
        {isFiltering(filter) && filtered.length === 0 ? (
          <p className="m-0 rounded-[10px] border border-outline-variant bg-surface-container-lowest p-4 text-body-md text-on-surface-variant">No hay clases que coincidan con la búsqueda.</p>
        ) : (
          <>
            <div className="md:hidden"><DayAgenda sessions={filtered} now={now} onSelect={setSelected} gaps={shownGaps} /></div>
            <div className="hidden md:block"><WeeklyCalendar sessions={filtered} onSelect={setSelected} gaps={shownGaps} /></div>
          </>
        )}
      </section>

      {selected && <ClassDetail session={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
