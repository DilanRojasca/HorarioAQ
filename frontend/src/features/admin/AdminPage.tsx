import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';

interface Run { id: string; trigger: string; startedAt: string; finishedAt: string | null; studentsSynced: number; changesCount: number; status: string }

export default function AdminPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get<Run[]>('/admin/sync/runs').then(setRuns).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await api.post<{ studentsSynced: number; changesCount: number }>('/admin/sync');
      setMsg(`Sincronización completada: ${r.studentsSynced} estudiantes, ${r.changesCount} cambios.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al sincronizar'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h1>Sincronización institucional</h1>
      <p className="muted">Los horarios solo cambian por sincronización con el sistema institucional.</p>
      <div className="toolbar">
        <button className="btn" onClick={sync} disabled={busy}>{busy ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
        {msg && <span role="status">{msg}</span>}
        {error && <span role="alert" className="error">{error}</span>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="runs">
          <caption className="muted" style={{ textAlign: 'left' }}>Últimas corridas</caption>
          <thead><tr><th>Inicio</th><th>Origen</th><th>Estudiantes</th><th>Cambios</th><th>Estado</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.startedAt).toLocaleString('es-CO')}</td><td>{r.trigger}</td>
                <td>{r.studentsSynced}</td><td>{r.changesCount}</td><td>{r.status}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={5} className="muted">Aún no hay corridas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
