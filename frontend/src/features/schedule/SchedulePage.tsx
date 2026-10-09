import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import ClassDetail from './ClassDetail';
import DayAgenda from './DayAgenda';
import ExportMenu from './ExportMenu';
import NoEnrollment from './NoEnrollment';
import TodayCard from './TodayCard';
import WeeklyCalendar from './WeeklyCalendar';
import type { Session } from './types';
import { useSchedule } from './useSchedule';

export default function SchedulePage() {
  const { data, error, loading } = useSchedule();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Session | null>(null);
  const [, setTick] = useState(0);
  // Refresca "En curso / Siguiente" cada minuto.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
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
      <TodayCard sessions={data.sessions} now={now} onSelect={setSelected} />

      <section aria-labelledby="week-title" className="space-y-3">
        <h2 id="week-title" className="m-0 text-headline-md font-bold text-on-surface">Semana</h2>
        <div className="md:hidden"><DayAgenda sessions={data.sessions} now={now} onSelect={setSelected} /></div>
        <div className="hidden md:block"><WeeklyCalendar sessions={data.sessions} onSelect={setSelected} /></div>
      </section>

      {selected && <ClassDetail session={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
