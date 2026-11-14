import { Button, fieldInput, InlineSelect } from '../../shared/forms';
import { distinct, EMPTY_FILTER, isFiltering, WEEKDAYS } from './filter';
import type { ScheduleFilter } from './filter';
import type { Session } from './types';

interface Props { sessions: Session[]; value: ScheduleFilter; onChange(f: ScheduleFilter): void; matches: number }

/** RF-BUS-01 (buscar por nombre o código) y RF-BUS-02 (filtrar por día, bloque o docente). */
export default function SearchFilters({ sessions, value, onChange, matches }: Props) {
  const set = (patch: Partial<ScheduleFilter>) => onChange({ ...value, ...patch });
  const active = isFiltering(value);
  return (
    <section aria-label="Buscar y filtrar el horario" className="space-y-2">
      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline" aria-hidden="true">search</span>
        <input
          type="search" aria-label="Buscar asignatura por nombre o código" placeholder="Buscar asignatura (nombre o código)"
          value={value.q} onChange={(e) => set({ q: e.target.value })} className={`${fieldInput} pl-10`}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <InlineSelect aria-label="Filtrar por día" value={value.weekday ?? ''} onChange={(e) => set({ weekday: e.target.value ? Number(e.target.value) : null })} >
          <option value="">Todos los días</option>
          {WEEKDAYS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </InlineSelect>
        <InlineSelect aria-label="Filtrar por bloque" value={value.block} onChange={(e) => set({ block: e.target.value })} >
          <option value="">Todos los bloques</option>
          {distinct(sessions, (s) => s.block).map((b) => <option key={b} value={b}>Bloque {b}</option>)}
        </InlineSelect>
        <InlineSelect aria-label="Filtrar por docente" value={value.teacher} onChange={(e) => set({ teacher: e.target.value })} className="col-span-2 md:col-span-1">
          <option value="">Todos los docentes</option>
          {distinct(sessions, (s) => s.teacher).map((t) => <option key={t} value={t}>{t}</option>)}
        </InlineSelect>
        <Button variant="secondary" onClick={() => onChange(EMPTY_FILTER)} disabled={!active} icon="close" className="col-span-2 md:col-span-1">Limpiar filtros</Button>
      </div>
      <p role="status" aria-live="polite" className="m-0 text-body-sm text-on-surface-variant">
        {active ? (matches === 0 ? 'Sin resultados para esos filtros.' : `${matches} ${matches === 1 ? 'clase encontrada' : 'clases encontradas'}.`) : ''}
      </p>
    </section>
  );
}
