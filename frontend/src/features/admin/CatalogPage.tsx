import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../shared/api';
import { card } from '../../shared/ui';
import { Button, ErrorNotice, Field, FormSection, InlineSelect, SelectField } from '../../shared/forms';

interface Program { id: string; code: string; name: string; facultyId: string }
interface Faculty { id: string; name: string; programs: Program[] }

/** RF-ADM-01 / RRF-03: todo programa se crea y se clasifica dentro de una facultad. */
export default function CatalogPage() {
  const [faculties, setFaculties] = useState<Faculty[] | null>(null);
  const [error, setError] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [prog, setProg] = useState({ code: '', name: '', facultyId: '' });

  const load = useCallback(async () => {
    try { const f = await api.get<Faculty[]>('/catalog'); setFaculties(f); setError(''); setProg((p) => ({ ...p, facultyId: p.facultyId || f[0]?.id || '' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo'); setFaculties((p) => p ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción'); }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-headline-xl-mobile text-on-surface">Programas y facultades</h1>
        <p className="mb-0 mt-1 text-body-md text-on-surface-variant">Todo programa académico debe pertenecer a una facultad.</p>
      </header>
      {error && <ErrorNotice>{error}</ErrorNotice>}

      <div className="grid gap-4 md:grid-cols-2">
        <FormSection id="nf-title" title="Nueva facultad" icon="apartment">
          <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await api.post('/catalog/faculties', { name: facultyName }); setFacultyName(''); }); }}>
            <Field id="f-name" label="Nombre de la facultad" value={facultyName} onChange={(e) => setFacultyName(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!facultyName.trim()} icon="add">Crear</Button>
          </form>
        </FormSection>

        <FormSection id="np-title" title="Nuevo programa" icon="school">
          <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await api.post('/catalog/programs', prog); setProg({ ...prog, code: '', name: '' }); }); }}>
            <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
              <Field id="p-code" label="Código" maxLength={20} value={prog.code} onChange={(e) => setProg({ ...prog, code: e.target.value })} />
              <Field id="p-name" label="Nombre del programa" value={prog.name} onChange={(e) => setProg({ ...prog, name: e.target.value })} />
            </div>
            <SelectField id="p-faculty" label="Facultad" value={prog.facultyId} onChange={(e) => setProg({ ...prog, facultyId: e.target.value })}>
              {(faculties ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </SelectField>
            <Button type="submit" disabled={!prog.code.trim() || !prog.name.trim() || !prog.facultyId} icon="add">Crear programa</Button>
          </form>
        </FormSection>
      </div>

      {faculties === null ? <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando catálogo…</p> : faculties.map((f) => (
        <section key={f.id} aria-labelledby={`fac-${f.id}`} className="space-y-2">
          <h2 id={`fac-${f.id}`} className="m-0 text-headline-md font-bold text-on-surface">{f.name}</h2>
          {f.programs.length === 0 ? <p className={`${card} m-0 p-3 text-body-md text-on-surface-variant`}>Sin programas.</p> : (
            <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
              {f.programs.map((p) => (
                <li key={p.id} className={`${card} flex items-center gap-3 p-3`}>
                  <div className="min-w-0 flex-1"><p className="m-0 truncate text-title-sm text-on-surface">{p.name}</p><p className="m-0 text-label-sm text-on-surface-variant">{p.code}</p></div>
                  <InlineSelect aria-label={`Facultad de ${p.name}`} value={p.facultyId} onChange={(e) => void run(() => api.put(`/catalog/programs/${p.id}`, { facultyId: e.target.value }))} className="w-48">
                    {faculties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </InlineSelect>
                  <Button variant="danger" aria-label={`Eliminar ${p.name}`} onClick={() => void run(() => api.del(`/catalog/programs/${p.id}`))}>Eliminar</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
