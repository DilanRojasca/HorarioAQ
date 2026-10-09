import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationBell from './NotificationBell';
import { ToastProvider } from './ToastProvider';
import { RealtimeProvider } from '../../shared/RealtimeProvider';
import { FakeRealtime } from '../../shared/fakeRealtime';
import * as api from './api';

vi.mock('./api', () => ({ listNotifications: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Dilan', email: 'd@x.co', role: 'STUDENT' } }),
}));

const list = vi.mocked(api.listNotifications);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const n = (id: string, over: object = {}) => ({
  id, userId: 'u', kind: 'UPDATED', title: `Título ${id}`, message: `Mensaje ${id}`,
  createdAt: minutesAgo(5), readAt: null, emailedAt: null, ...over,
});

let fake: FakeRealtime;
const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider><RealtimeProvider client={fake}>{children}</RealtimeProvider></ToastProvider>
);
const setup = async () => {
  const user = userEvent.setup();
  render(<NotificationBell />, { wrapper });
  const button = await screen.findByRole('button', { name: /^Notificaciones, \d+ sin leer$/ });
  return { user, button };
};

describe('NotificationBell', () => {
  beforeEach(() => {
    fake = new FakeRealtime();
    list.mockReset();
    list.mockResolvedValue({ items: [n('a'), n('b'), n('c', { readAt: minutesAgo(1) })], unread: 2 });
    vi.mocked(api.markRead).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.markAllRead).mockReset().mockResolvedValue({ updated: 2 });
  });

  it('muestra el contador y el aria-label con las no leídas; el panel empieza cerrado', async () => {
    const { button } = await setup();
    expect(button).toHaveAccessibleName('Notificaciones, 2 sin leer');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(button).getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('anuncia el contador en una región aria-live siempre montada', async () => {
    const { button } = await setup();
    const live = screen.getByText('2 notificaciones sin leer');
    expect(live.closest('[aria-live="polite"]')).not.toBeNull();
    await userEvent.click(button);
    expect(screen.getByText('2 notificaciones sin leer')).toBeInTheDocument();
  });

  it('abre el panel con clic: lista título, mensaje, hora relativa y puntos de no leída', async () => {
    const { user, button } = await setup();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('region', { name: 'Notificaciones' }).id);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Título a');
    expect(items[0]).toHaveTextContent('Mensaje a');
    expect(items[0]).toHaveTextContent('hace 5 minutos');
    expect(within(items[0]).getByText('Sin leer')).toBeInTheDocument();
    expect(within(items[2]).queryByText('Sin leer')).not.toBeInTheDocument();
    expect(within(items[2]).queryByRole('button', { name: /Marcar leída/ })).not.toBeInTheDocument();
  });

  it('abre con Enter desde el teclado y cierra con Escape devolviendo el foco al botón', async () => {
    const { user, button } = await setup();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.tab(); // el foco entra al panel
    expect(button).not.toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('cierra con clic fuera y con el botón Cerrar (foco de vuelta en la campana)', async () => {
    const { user, button } = await setup();
    await user.click(button);
    await user.click(document.body);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Cerrar notificaciones' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    // clic en la propia campana alterna
    await user.click(button);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('"Marcar leída" marca una notificación y baja el contador', async () => {
    const { user, button } = await setup();
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /Marcar leída: Título a/ }));
    expect(api.markRead).toHaveBeenCalledWith('a');
    expect(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar leída: Título a/ })).not.toBeInTheDocument();
  });

  it('"Marcar todas como leídas" deja el contador en 0 y desactiva la acción', async () => {
    const { user, button } = await setup();
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(api.markAllRead).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Notificaciones, 0 sin leer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled();
  });

  it('estado vacío: "No tienes notificaciones"', async () => {
    list.mockResolvedValue({ items: [], unread: 0 });
    const { user, button } = await setup();
    await user.click(button);
    expect(screen.getByText('No tienes notificaciones')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('una notificación en vivo sube el contador mientras el panel está cerrado', async () => {
    const { button } = await setup();
    act(() => fake.emit('notification', { id: 'z', title: 'Nueva', message: 'm', kind: 'ADDED' }));
    expect(button).toHaveAccessibleName('Notificaciones, 3 sin leer');
  });

  it('muestra 99+ cuando el contador es muy alto', async () => {
    list.mockResolvedValue({ items: [], unread: 150 });
    const { button } = await setup();
    expect(within(button).getByText('99+')).toBeInTheDocument();
  });

  it('muestra el error de carga dentro del panel en un role=alert', async () => {
    list.mockRejectedValue(new Error('Sin conexión'));
    const user = userEvent.setup();
    render(<NotificationBell />, { wrapper });
    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 0 sin leer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  });

  it('aria-controls solo existe mientras el panel está abierto', async () => {
    const { user, button } = await setup();
    expect(button).not.toHaveAttribute('aria-controls');
    await user.click(button);
    expect(button).toHaveAttribute('aria-controls');
    await user.keyboard('{Escape}');
    expect(button).not.toHaveAttribute('aria-controls');
  });

  it('al abrir el foco entra al panel', async () => {
    const { user, button } = await setup();
    await user.click(button);
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toContainElement(document.activeElement as HTMLElement);
  });

  it('tras "Marcar leída" el foco pasa al siguiente "Marcar leída" y luego a "Marcar todas" o al panel', async () => {
    const { user, button } = await setup();
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /Marcar leída: Título a/ }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: /Marcar leída: Título b/ })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: /Marcar leída: Título b/ }));
    await vi.waitFor(() => expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveFocus());
  });
});
