import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../shared/api';
import GapsPage from './GapsPage';

vi.mock('../../shared/api', async (orig) => ({ ...(await orig<typeof import('../../shared/api')>()), api: { get: vi.fn(), put: vi.fn(), del: vi.fn(), post: vi.fn() } }));
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;
const del = api.del as unknown as ReturnType<typeof vi.fn>;

const gap = (over = {}) => ({
  weekday: 1, startTime: '10:00', endTime: '11:00', minutes: 60, status: 'AVAILABLE', activity: null,
  suggestion: { kind: 'MEAL', title: 'Alimentación', detail: '60 min: buen momento para comer algo con calma.' }, ...over,
});

describe('GapsPage (RF-HUE-01..04)', () => {
  beforeEach(() => { get.mockReset(); put.mockReset(); del.mockReset(); });

  it('agrupa por día y muestra la sugerencia según la duración', async () => {
    get.mockResolvedValue([gap(), gap({ weekday: 3, startTime: '12:00', endTime: '14:00', minutes: 120, suggestion: { kind: 'STUDY', title: 'Estudio', detail: '120 min' } })]);
    render(<GapsPage />);
    expect(await screen.findByRole('heading', { name: 'Lunes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Miércoles' })).toBeInTheDocument();
    expect(screen.getByText('Alimentación.')).toBeInTheDocument();
    expect(screen.getByText('2 h')).toBeInTheDocument();
  });

  it('asigna una actividad propia al hueco y recarga', async () => {
    get.mockResolvedValueOnce([gap()]).mockResolvedValueOnce([gap({ activity: { id: '1', title: 'Biblioteca' }, suggestion: null })]);
    put.mockResolvedValue({ id: '1', title: 'Biblioteca' });
    const user = userEvent.setup();
    render(<GapsPage />);
    await user.type(await screen.findByLabelText('Actividad propia para 10:00–11:00'), 'Biblioteca');
    await user.click(screen.getByRole('button', { name: 'Asignar' }));
    expect(put).toHaveBeenCalledWith('/gaps/activity', { weekday: 1, startTime: '10:00', endTime: '11:00', title: 'Biblioteca' });
    expect(await screen.findByText('Biblioteca')).toBeInTheDocument();
  });

  it('marca el hueco como ocupado', async () => {
    get.mockResolvedValue([gap()]);
    put.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GapsPage />);
    await user.click(await screen.findByLabelText('Marcar como ocupado'));
    expect(put).toHaveBeenCalledWith('/gaps/status', { weekday: 1, startTime: '10:00', endTime: '11:00', status: 'OCCUPIED' });
  });

  it('quita la actividad', async () => {
    get.mockResolvedValue([gap({ activity: { id: '1', title: 'Gym' }, suggestion: null })]);
    del.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GapsPage />);
    await user.click(await screen.findByRole('button', { name: 'Quitar actividad Gym' }));
    expect(del).toHaveBeenCalledWith('/gaps/activity', { weekday: 1, startTime: '10:00', endTime: '11:00' });
  });

  it('estado vacío', async () => {
    get.mockResolvedValue([]);
    render(<GapsPage />);
    expect(await screen.findByText(/No tienes huecos/)).toBeInTheDocument();
    expect(within(document.body).queryByRole('listitem')).toBeNull();
  });
});
