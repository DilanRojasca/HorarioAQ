import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../shared/api';
import { formatDateTime, statusBadge, triggerLabel } from './runs';
import type { Run } from './runs';

interface SyncResult { runId: string; studentsSynced: number; changesCount: number; failures?: number }

const card = 'rounded-[10px] border border-outline-variant bg-surface-container-lowest shadow-[0_1px_3px_rgba(27,42,51,0.04),0_1px_2px_rgba(27,42,51,0.02)]';

export default function AdminPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Run[]>('/admin/sync/runs');
      setRuns(data);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'No se pudieron cargar las corridas');
      setRuns((prev) => prev ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setBusy(true); setResult(null); setError(''); setNotice('');
    try {
      const r = await api.post<SyncResult>('/admin/sync');
      setResult(r);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setNotice('Ya hay una sincronización en curso');
      else setError(e instanceof Error ? e.message : 'Error al sincronizar');
    } finally { setBusy(false); }
  }

  const failures = result?.failures ?? 0;
  return (
    <div className="space-y-5">
      <section>
        <p className="m-0 flex items-center gap-1.5 text-label-sm uppercase text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">sync</span>
          Panel del Administrador
        </p>
        <h1 className="mb-0 mt-1 text-headline-xl-mobile text-on-surface">Sincronización institucional</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">Gestión y monitoreo de la sincronización de horarios.</p>
      </section>

      <div className="flex gap-3 rounded-[10px] border border-outline-variant/60 bg-surface-container p-3.5">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">info</span>
        <div>
          <p className="m-0 text-title-sm text-on-surface">Sistema Académico Oficial</p>
          <p className="m-0 mt-0.5 text-body-md text-on-surface-variant">Los horarios solo cambian por sincronización con el sistema institucional.</p>
        </div>
      </div>

      <section className={`${card} space-y-3 p-4`} aria-labelledby="sync-title">
        <h2 id="sync-title" className="m-0 text-title-md text-on-surface">Ejecución de sincronización</h2>
        <button
          type="button"
          onClick={sync}
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-secondary-container font-semibold text-on-secondary-container hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className={`material-symbols-outlined text-[20px] ${busy ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true">sync</span>
          {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>

        {busy && (
          <div role="status" className="flex items-center gap-2.5 rounded-[10px] border border-outline-variant/60 bg-surface-container p-3 text-body-md text-on-surface-variant">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary-container motion-safe:animate-pulse" aria-hidden="true" />
            Sincronizando… (consultando registros académicos)
          </div>
        )}

        {result && (
          <div role="status" className="space-y-2">
            <div className="flex gap-2.5 rounded-[10px] border border-outline-variant/60 border-l-4 border-l-[#1E7E34] bg-surface-container-low p-3">
              <span className="material-symbols-outlined text-[#1E7E34]" aria-hidden="true">check_circle</span>
              <div>
                <p className="m-0 text-title-sm text-on-surface">Sincronización completada</p>
                <p className="m-0 text-body-md text-on-surface-variant">
                  {result.studentsSynced} estudiantes, {result.changesCount} cambios aplicados
                </p>
              </div>
            </div>
            {failures > 0 && (
              <div className="flex gap-2.5 rounded-[10px] border border-[#FEEFC3] border-l-4 border-l-secondary-container bg-[#FEF7E0] p-3 text-on-secondary-container">
                <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                <p className="m-0 text-body-md font-medium">
                  {failures === 1 ? '1 estudiante no se pudo sincronizar' : `${failures} estudiantes no se pudieron sincronizar`}. Revisa la corrida marcada como Parcial.
                </p>
              </div>
            )}
          </div>
        )}

        {notice && (
          <div role="status" className="flex gap-2.5 rounded-[10px] border border-[#FEEFC3] border-l-4 border-l-secondary-container bg-[#FEF7E0] p-3 text-on-secondary-container">
            <span className="material-symbols-outlined" aria-hidden="true">hourglass_top</span>
            <p className="m-0 text-body-md font-medium">{notice}</p>
          </div>
        )}

        {error && (
          <div role="alert" className="flex gap-2.5 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-error">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <p className="m-0 text-body-md font-medium">{error}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="runs-title">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="runs-title" className="m-0 text-headline-md text-on-surface">Últimas corridas</h2>
          {runs && runs.length > 0 && <span className="text-body-sm text-on-surface-variant">{runs.length} registros</span>}
        </div>

        {loadError && (
          <div role="alert" className="mb-3 flex gap-2.5 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-error">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <p className="m-0 text-body-md font-medium">{loadError}</p>
          </div>
        )}

        {runs === null ? (
          <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando corridas…</p>
        ) : runs.length === 0 ? (
          !loadError && <p className={`${card} m-0 p-4 text-body-md text-on-surface-variant`}>Aún no hay corridas.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {runs.map((r) => {
              const badge = statusBadge(r.status);
              return (
                <li key={r.id} className={`${card} p-3.5`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-title-sm text-on-surface">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">schedule</span>
                      {formatDateTime(r.startedAt)}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-label-sm ${badge.classes}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
                      {badge.label}
                    </span>
                  </div>
                  <dl className="m-0 grid grid-cols-3 gap-2">
                    <div>
                      <dt className="text-label-sm uppercase text-on-surface-variant">Origen</dt>
                      <dd className="m-0 text-body-md font-medium text-on-surface">{triggerLabel(r.trigger)}</dd>
                    </div>
                    <div>
                      <dt className="text-label-sm uppercase text-on-surface-variant">Estudiantes</dt>
                      <dd className="m-0 text-body-md font-medium text-on-surface">{r.studentsSynced}</dd>
                    </div>
                    <div>
                      <dt className="text-label-sm uppercase text-on-surface-variant">Cambios</dt>
                      <dd className={`m-0 text-body-md font-medium ${r.changesCount > 0 ? 'text-secondary' : 'text-on-surface'}`}>{r.changesCount}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
