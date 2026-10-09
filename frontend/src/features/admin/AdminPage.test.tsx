import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from './AdminPage';
import { ApiError, api } from '../../shared/api';

vi.mock('../../shared/api', async (orig) => {
  const actual = await orig<typeof import('../../shared/api')>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } };
});

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;

const runs = [
  { id: '1', trigger: 'MANUAL', startedAt: '2026-08-20T15:30:00.000Z', finishedAt: '2026-08-20T15:31:00.000Z', studentsSynced: 12, changesCount: 3, status: 'OK' },
  { id: '2', trigger: 'CRON', startedAt: '2026-08-19T05:00:00.000Z', finishedAt: null, studentsSynced: 10, changesCount: 0, status: 'PARTIAL' },
];

describe('AdminPage', () => {
  beforeEach(() => { get.mockReset(); post.mockReset(); });

  it('muestra un estado de carga sin parpadear "Aún no hay corridas"', async () => {
    let resolve!: (v: unknown) => void;
    get.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<AdminPage />);
    expect(screen.getByText('Cargando corridas…')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay corridas.')).not.toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText('Aún no hay corridas.')).toBeInTheDocument();
  });

  it('muestra las corridas con etiquetas en español', async () => {
    get.mockResolvedValue(runs);
    render(<AdminPage />);
    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Automática')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('2 registros')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/admin/sync/runs');
  });

  it('muestra el resultado de una sincronización exitosa y recarga', async () => {
    get.mockResolvedValue(runs);
    post.mockResolvedValue({ runId: 'r', studentsSynced: 5, changesCount: 2, failures: 0 });
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Manual');
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(await screen.findByText('Sincronización completada')).toBeInTheDocument();
    expect(screen.getByText('5 estudiantes, 2 cambios aplicados')).toBeInTheDocument();
    expect(screen.queryByText(/no se pudieron sincronizar/)).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/admin/sync');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('advierte cuando hubo fallos parciales', async () => {
    get.mockResolvedValue(runs);
    post.mockResolvedValue({ runId: 'r', studentsSynced: 5, changesCount: 2, failures: 2 });
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Manual');
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(await screen.findByText(/2 estudiantes no se pudieron sincronizar/)).toBeInTheDocument();
  });

  it('muestra un aviso (no un error) ante un 409', async () => {
    get.mockResolvedValue(runs);
    post.mockRejectedValue(new ApiError(409, 'conflict'));
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Manual');
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(await screen.findByText('Ya hay una sincronización en curso')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled();
  });

  it('mantiene una región role=status montada antes de sincronizar y le cambia el contenido', async () => {
    get.mockResolvedValue(runs);
    post.mockResolvedValue({ runId: 'r', studentsSynced: 1, changesCount: 0 });
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Manual');
    const region = screen.getAllByRole('status').find((el) => el.getAttribute('aria-live') === 'polite')!;
    expect(region).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    await screen.findByText('Sincronización completada');
    expect(region).toHaveTextContent('Sincronización completada');
  });

  it('muestra otros errores en role=alert', async () => {
    get.mockResolvedValue(runs);
    post.mockRejectedValue(new ApiError(500, 'Fallo del servidor'));
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Manual');
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo del servidor');
  });

  it('deshabilita el botón mientras sincroniza', async () => {
    get.mockResolvedValue(runs);
    let resolve!: (v: unknown) => void;
    post.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Manual');
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(screen.getByRole('button', { name: 'Sincronizando…' })).toBeDisabled();
    expect(screen.getByText(/consultando registros académicos/)).toBeInTheDocument();
    resolve({ runId: 'r', studentsSynced: 1, changesCount: 0 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled());
  });

  it('limpia el error de carga cuando una recarga tiene éxito', async () => {
    get.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(runs);
    post.mockResolvedValue({ runId: 'r', studentsSynced: 1, changesCount: 0 });
    const user = userEvent.setup();
    render(<AdminPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    await screen.findByText('Sincronización completada');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
