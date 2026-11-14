import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { card } from '../../shared/ui';
import { ErrorNotice, InlineSelect } from '../../shared/forms';
import { useAuth } from '../auth/AuthContext';

interface UserRow { id: string; name: string; email: string; role: 'STUDENT' | 'ADMIN'; active: boolean }

/** RF-AUTH-07: el administrador asigna y modifica roles. Cada cambio queda auditado con el ID del admin. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setRows(await api.get<UserRow[]>('/admin/users')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios'); setRows((p) => p ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function changeRole(u: UserRow, role: UserRow['role']) {
    setError('');
    try { await api.put(`/admin/users/${u.id}/role`, { role }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el rol'); }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-headline-xl-mobile text-on-surface">Usuarios y roles</h1>
        <p className="mb-0 mt-1 text-body-md text-on-surface-variant">Asigna el rol de cada usuario. No puedes cambiar el tuyo.</p>
      </header>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {rows === null ? <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando usuarios…</p> : (
        <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
          {rows.map((u) => (
            <li key={u.id} data-user className={`${card} flex items-center gap-3 p-3`}>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-title-sm text-on-surface">{u.name}</p>
                <p className="m-0 truncate text-body-sm text-on-surface-variant">{u.email}{!u.active ? ' · sin verificar' : ''}</p>
              </div>
              <InlineSelect
                aria-label={`Rol de ${u.name}`} value={u.role} disabled={u.id === me?.id}
                onChange={(e) => void changeRole(u, e.target.value as UserRow['role'])} className="w-40"
              >
                <option value="STUDENT">Estudiante</option>
                <option value="ADMIN">Administrador</option>
              </InlineSelect>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
