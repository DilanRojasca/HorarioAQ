import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { card } from '../../shared/ui';
import { Button, ErrorNotice, InlineSelect } from '../../shared/forms';
import { formatDateTime } from './runs';

interface Entry { id: string; action: string; entity: string; actor: string; detail: unknown; createdAt: string }

const ACTIONS = ['', 'LOGIN', 'LOGIN_FAILED', 'REGISTER', 'VERIFY_ACCOUNT', 'PASSWORD_RESET', 'UPDATE_PROFILE', 'CHANGE_ROLE', 'SYNC', 'VIEW_THIRD_PARTY_SCHEDULE',
  'CATALOG_CREATE_FACULTY', 'CATALOG_CREATE_PROGRAM', 'CATALOG_UPDATE_PROGRAM', 'CATALOG_DELETE_PROGRAM'];

/** RF-ADM-02 / RNF-14: log auditable (inicios de sesión, sincronizaciones y cambios sensibles) con fecha, usuario y acción. */
export default function AuditPage() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try { setRows(await api.get<Entry[]>(`/admin/audit?limit=100${action ? `&action=${action}` : ''}`)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la auditoría'); setRows((p) => p ?? []); }
    finally { setBusy(false); }
  }, [action]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-headline-xl-mobile text-on-surface">Auditoría</h1>
        <p className="mb-0 mt-1 text-body-md text-on-surface-variant">Registro de accesos y cambios sensibles, con su responsable.</p>
      </header>
      <div className="flex gap-2">
        <InlineSelect aria-label="Filtrar por acción" value={action} onChange={(e) => setAction(e.target.value)} className="sm:w-72">
          {ACTIONS.map((a) => <option key={a} value={a}>{a || 'Todas las acciones'}</option>)}
        </InlineSelect>
        <Button variant="secondary" onClick={() => void load()} loading={busy} icon="refresh">Actualizar</Button>
      </div>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {rows === null ? <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando…</p> : rows.length === 0 ? (
        !error && <p className={`${card} m-0 p-4 text-body-md text-on-surface-variant`}>Sin registros.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {rows.map((r) => (
            <li key={r.id} data-audit className={`${card} p-3`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 font-mono text-title-sm text-on-surface">{r.action}</p>
                <span className="text-label-sm text-on-surface-variant">{formatDateTime(r.createdAt)}</span>
              </div>
              <p className="m-0 mt-0.5 break-words text-body-sm text-on-surface-variant">{r.actor} · {r.entity}{r.detail ? ` · ${JSON.stringify(r.detail)}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
