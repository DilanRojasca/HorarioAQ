import { useState } from 'react';
import AgendaList from './AgendaList';
import ClassDetail from './ClassDetail';
import ExportMenu from './ExportMenu';
import WeeklyCalendar from './WeeklyCalendar';
import { todaySessions, WEEKDAYS } from './grid';
import type { Session } from './types';
import { useSchedule } from './useSchedule';

export default function SchedulePage() {
  const { data, error, loading } = useSchedule();
  const [selected, setSelected] = useState<Session | null>(null);

  if (loading) return <p role="status">Cargando horario…</p>;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!data?.enrolled) {
    return <p className="card" role="status">No tienes matrícula vigente en el semestre {data?.semester}. Contacta a Admisiones y Registro.</p>;
  }

  const today = todaySessions(data.sessions);
  const dayName = WEEKDAYS.find((d) => d.n === (new Date().getDay() || 7))?.label ?? 'Domingo';

  return (
    <>
      <h1>Mi horario · {data.semester}</h1>
      <section className="card" aria-labelledby="today-title">
        <h2 id="today-title">Hoy ({dayName})</h2>
        {today.length === 0 ? <p className="muted">No tienes clases hoy.</p> : (
          <ul className="today-list">
            {today.map((s) => (
              <li key={s.externalId}>
                <span className="time">{s.startTime}–{s.endTime}</span>
                <button className="btn link" onClick={() => setSelected(s)}>{s.courseName}</button>
                <span className="muted">Bloque {s.block} · Aula {s.room}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && <ClassDetail session={selected} onClose={() => setSelected(null)} />}
      <ExportMenu />
      <h2>Semana</h2>
      <WeeklyCalendar sessions={data.sessions} onSelect={setSelected} />
      <AgendaList sessions={data.sessions} onSelect={setSelected} />
    </>
  );
}
