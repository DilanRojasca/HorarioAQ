import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../shared/api';
import NotificationsPage from './NotificationsPage';

vi.mock('../../shared/api', async (orig) => ({ ...(await orig<typeof import('../../shared/api')>()), api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } }));
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;
const del = api.del as unknown as ReturnType<typeof vi.fn>;

const wire = (scheduled: unknown[] = []) => get.mockImplementation(async (p: string) => {
  if (p === '/auth/me') return { notifyChannel: 'BOTH', reminderMinutes: 15 };
  if (p === '/notifications/scheduled') return scheduled;
  if (p.startsWith('/notifications')) return { items: [{ id: 'n1', title: 'Cambio en Física', message: 'Aula 1 → 2', kind: 'SCHEDULE_UPDATED', createdAt: new Date().toISOString(), readAt: null }], unread: 1 };
  return { sessions: [{ externalId: 'a', courseName: 'Álgebra', startTime: '08:00' }] };
});

describe('NotificationsPage (RF-NOT-01/02/04)', () => {
  beforeEach(() => { [get, post, put, del].forEach((m) => m.mockReset()); });

  it('carga preferencias, programadas e historial', async () => {
    wire([{ id: 's1', kind: 'CUSTOM', title: 'Parcial', message: 'Repasar', fireAt: '2030-01-01T10:00:00Z' }]);
    render(<NotificationsPage />);
    expect(await screen.findByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('Cambio en Física')).toBeInTheDocument();
    expect(screen.getByLabelText(/App y correo/)).toBeChecked();
  });
  it('cambiar el canal y la antelación guarda las preferencias', async () => {
    wire(); put.mockResolvedValue({ notifyChannel: 'IN_APP', reminderMinutes: 15 });
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByLabelText(/Solo en la app/));
    expect(put).toHaveBeenCalledWith('/notifications/preferences', { notifyChannel: 'IN_APP' });
    put.mockResolvedValue({ notifyChannel: 'IN_APP', reminderMinutes: 30 });
    await user.selectOptions(screen.getByLabelText('Recordatorio antes de cada clase'), '30');
    expect(put).toHaveBeenLastCalledWith('/notifications/preferences', { reminderMinutes: 30 });
  });
  it('programa una notificación asociada a una clase', async () => {
    wire(); post.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.type(await screen.findByLabelText('Título'), 'Parcial');
    await user.type(screen.getByLabelText('Mensaje'), 'Repasar');
    await user.selectOptions(screen.getByLabelText(/Asociar a una clase/), 'a');
    await user.click(screen.getByRole('button', { name: 'Programar' }));
    expect(post).toHaveBeenCalledWith('/notifications/scheduled', expect.objectContaining({ title: 'Parcial', message: 'Repasar', sessionExternalId: 'a' }));
    expect(await screen.findByText('Notificación programada.')).toBeInTheDocument();
  });
  it('cancela una programada', async () => {
    wire([{ id: 's1', kind: 'CUSTOM', title: 'Parcial', message: 'x', fireAt: '2030-01-01T10:00:00Z' }]); del.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole('button', { name: 'Cancelar Parcial' }));
    expect(del).toHaveBeenCalledWith('/notifications/scheduled/s1');
  });
});
