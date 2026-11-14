import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../shared/api';
import AuditPage from './AuditPage';
import CatalogPage from './CatalogPage';
import UsersPage from './UsersPage';

vi.mock('../../shared/api', async (orig) => ({ ...(await orig<typeof import('../../shared/api')>()), api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a1', role: 'ADMIN' } }) }));
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;
const del = api.del as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => { [get, post, put, del].forEach((m) => m.mockReset()); });

describe('UsersPage (RF-AUTH-07)', () => {
  const rows = [
    { id: 'a1', name: 'Admin', email: 'a@x', role: 'ADMIN', active: true },
    { id: 's1', name: 'Estudiante', email: 's@x', role: 'STUDENT', active: false },
  ];
  it('lista usuarios, bloquea el rol propio y cambia el de otros', async () => {
    get.mockResolvedValue(rows); put.mockResolvedValue({});
    const user = userEvent.setup();
    render(<UsersPage />);
    expect(await screen.findByText(/sin verificar/)).toBeInTheDocument();
    expect(screen.getByLabelText('Rol de Admin')).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Rol de Estudiante'), 'ADMIN');
    expect(put).toHaveBeenCalledWith('/admin/users/s1/role', { role: 'ADMIN' });
  });
  it('muestra el error del servidor', async () => {
    get.mockResolvedValue(rows); put.mockImplementation(async () => { throw new Error('No puedes cambiar tu propio rol'); });
    const user = userEvent.setup();
    render(<UsersPage />);
    await user.selectOptions(await screen.findByLabelText('Rol de Estudiante'), 'ADMIN');
    expect(await screen.findByRole('alert')).toHaveTextContent('propio rol');
  });
});

describe('CatalogPage (RF-ADM-01, RRF-03)', () => {
  const catalog = [{ id: 'f1', name: 'Ingeniería', programs: [{ id: 'p1', code: 'ISI', name: 'Sistemas', facultyId: 'f1' }] }];
  it('muestra facultades con sus programas y crea un programa dentro de una facultad', async () => {
    get.mockResolvedValue(catalog); post.mockResolvedValue({});
    const user = userEvent.setup();
    render(<CatalogPage />);
    expect(await screen.findByRole('heading', { name: 'Ingeniería' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Código'), 'IIN');
    await user.type(screen.getByLabelText('Nombre del programa'), 'Industrial');
    await user.click(screen.getByRole('button', { name: 'Crear programa' }));
    expect(post).toHaveBeenCalledWith('/catalog/programs', { code: 'IIN', name: 'Industrial', facultyId: 'f1' });
  });
  it('crea facultad y elimina programa', async () => {
    get.mockResolvedValue(catalog); post.mockResolvedValue({}); del.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CatalogPage />);
    await user.type(await screen.findByLabelText('Nombre de la facultad'), 'Salud');
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    expect(post).toHaveBeenCalledWith('/catalog/faculties', { name: 'Salud' });
    await user.click(screen.getByRole('button', { name: 'Eliminar Sistemas' }));
    expect(del).toHaveBeenCalledWith('/catalog/programs/p1');
  });
  it('no permite crear un programa sin facultad', async () => {
    get.mockResolvedValue([]);
    render(<CatalogPage />);
    expect(await screen.findByRole('button', { name: 'Crear programa' })).toBeDisabled();
  });
});

describe('AuditPage (RF-ADM-02)', () => {
  it('lista el log y filtra por acción', async () => {
    get.mockResolvedValue([{ id: '1', action: 'LOGIN', entity: 'auth', actor: 'Ana <a@x>', detail: { email: 'a@x' }, createdAt: '2026-08-20T15:30:00.000Z' }]);
    const user = userEvent.setup();
    render(<AuditPage />);
    const item = await screen.findByText('LOGIN', { selector: 'p' });
    expect(within(item.closest('li')!).getByText(/Ana <a@x>/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filtrar por acción'), 'CHANGE_ROLE');
    expect(get).toHaveBeenLastCalledWith('/admin/audit?limit=100&action=CHANGE_ROLE');
  });
});
