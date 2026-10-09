import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventsPanel from './EventsPanel';
import { api } from '../../shared/api';

vi.mock('../../shared/api', async (orig) => {
  const actual = await orig<typeof import('../../shared/api')>();
  return { ...actual, api: { get: vi.fn() } };
});
const get = api.get as unknown as ReturnType<typeof vi.fn>;

const events = [
  {
    id: 'e1', type: 'ScheduleChanged', occurredAt: '2026-10-09T15:30:00.000Z',
    payload: { userId: 'u', semester: '2026-2', changes: [{}, {}] },
    deliveries: [
      { observer: 'audit', status: 'OK', attempts: 1, deliveredAt: '2026-10-09T15:30:01.000Z' },
      { observer: 'email', status: 'FAILED', attempts: 3, error: 'SMTP caído', deliveredAt: '2026-10-09T15:30:09.000Z' },
      { observer: 'realtime-sse', status: 'OK', attempts: 1, deliveredAt: '2026-10-09T15:30:02.000Z' },
    ],
  },
  {
    id: 'e2', type: 'SyncCompleted', occurredAt: '2026-10-09T15:31:00.000Z',
    payload: { runId: 'r', studentsSynced: 12, changesCount: 3 },
    deliveries: [],
  },
  { id: 'e3', type: 'Otro', occurredAt: 'nope', payload: {}, deliveries: [] },
];

describe('EventsPanel', () => {
  beforeEach(() => { get.mockReset(); });

  it('muestra "Cargando eventos…" sin parpadear el estado vacío', async () => {
    let resolve!: (v: unknown) => void;
    get.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<EventsPanel />);
    expect(screen.getByText('Cargando eventos…')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay eventos.')).not.toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText('Aún no hay eventos.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/admin/events?limit=20');
  });

  it('lista cada evento con etiqueta en español, hora y chips por observador', async () => {
    get.mockResolvedValue(events);
    render(<EventsPanel />);
    expect(await screen.findByRole('heading', { name: 'Eventos recientes' })).toBeInTheDocument();
    const [first, second, third] = screen.getAllByRole('listitem').filter((li) => li.matches('[data-event]'));
    expect(first).toHaveTextContent('Horario cambiado');
    expect(first).toHaveTextContent(new Date(events[0].occurredAt).toLocaleString('es-CO').replace(/\s+/g, ' '));
    expect(first).toHaveTextContent('2 cambios');
    expect(within(first).getByText('audit').closest('li')).toHaveTextContent('OK');
    const email = within(first).getByText('email').closest('li')!;
    expect(email).toHaveTextContent('Fallido');
    expect(email).toHaveTextContent('3 intentos');
    expect(email).toHaveAttribute('title', 'SMTP caído');
    expect(within(first).getByText('realtime-sse').closest('li')).not.toHaveTextContent('intento');
    expect(second).toHaveTextContent('Sincronización completada');
    expect(second).toHaveTextContent('12 estudiantes, 3 cambios');
    expect(second).toHaveTextContent('Sin entregas registradas');
    expect(third).toHaveTextContent('Otro');
    expect(third).toHaveTextContent('—');
  });

  it('etiqueta los cuatro tipos conocidos', async () => {
    get.mockResolvedValue(['SyncFailed', 'NotificationCreated'].map((type, i) => ({
      id: String(i), type, occurredAt: '2026-10-09T15:30:00.000Z', payload: {}, deliveries: [],
    })));
    render(<EventsPanel />);
    expect(await screen.findByText('Sincronización fallida')).toBeInTheDocument();
    expect(screen.getByText('Notificación creada')).toBeInTheDocument();
  });

  it('muestra el error en un role=alert', async () => {
    get.mockRejectedValue(new Error('Sin permiso'));
    render(<EventsPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso');
  });

  it('"Actualizar" vuelve a pedir los eventos y conserva la lista si falla', async () => {
    get.mockResolvedValueOnce(events);
    const user = userEvent.setup();
    render(<EventsPanel />);
    await screen.findByText('Horario cambiado');
    get.mockRejectedValueOnce(new Error('Falló'));
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló');
    expect(screen.getByText('Horario cambiado')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('recarga cuando cambia refreshKey', async () => {
    get.mockResolvedValue([]);
    const { rerender } = render(<EventsPanel refreshKey={0} />);
    await screen.findByText('Aún no hay eventos.');
    rerender(<EventsPanel refreshKey={1} />);
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
