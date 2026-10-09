import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from './SchedulePage';
import { api } from '../../shared/api';
import { mk } from './fixtures';

vi.mock('../../shared/api', async (orig) => {
  const actual = await orig<typeof import('../../shared/api')>();
  return { ...actual, api: { get: vi.fn(), download: vi.fn() } };
});
const logout = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Dilan Rojas', email: 'd@x.co', role: 'STUDENT' }, logout }),
}));

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const sessions = [
  mk({ externalId: 'a', courseName: 'Algoritmos', startTime: '07:00', endTime: '09:00' }),
  mk({ externalId: 'b', courseName: 'Bases de Datos', startTime: '10:00', endTime: '12:00', block: 'B', room: '208', teacher: 'Pedro Ruiz' }),
  mk({ externalId: 'c', courseName: 'Cálculo', startTime: '14:00', endTime: '16:00' }),
  mk({ externalId: 'd', courseName: 'Física', weekday: 4, startTime: '08:00', endTime: '10:00' }),
];

describe('SchedulePage', () => {
  beforeEach(() => {
    get.mockReset(); logout.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 8, 0)); // miércoles 7 oct 2026, 08:00
  });
  afterEach(() => vi.useRealTimers());

  it('muestra título, semestre, estado y nombre del usuario', async () => {
    get.mockResolvedValue({ userId: 'u', semester: '2026-2', enrolled: true, sessions });
    render(<SchedulePage />);
    expect(await screen.findByRole('heading', { level: 1, name: /Mi horario/ })).toHaveTextContent('2026-2');
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Dilan Rojas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeInTheDocument();
  });

  it('Hoy: lista las clases del día con En curso / Siguiente, docente y ubicación', async () => {
    get.mockResolvedValue({ userId: 'u', semester: '2026-2', enrolled: true, sessions });
    render(<SchedulePage />);
    const today = within(await screen.findByRole('region', { name: /Hoy/ }));
    expect(today.getByText('7 Oct 2026')).toBeInTheDocument();
    expect(today.getByText('(miércoles)')).toBeInTheDocument();
    const [a, b, c] = today.getAllByRole('article');
    expect(within(a).getByText('En curso')).toBeInTheDocument();
    expect(within(b).getByText('Siguiente')).toBeInTheDocument();
    expect(within(c).queryByText(/En curso|Siguiente/)).not.toBeInTheDocument();
    expect(b).toHaveTextContent('Bloque B · Aula 208');
    expect(b).toHaveTextContent('Pedro Ruiz');
    expect(today.queryByText('Física')).not.toBeInTheDocument();
  });

  it('Hoy sin clases: estado vacío sin botones', async () => {
    vi.setSystemTime(new Date(2026, 9, 10, 8, 0)); // sábado sin clases
    get.mockResolvedValue({ userId: 'u', semester: '2026-2', enrolled: true, sessions });
    render(<SchedulePage />);
    const today = within(await screen.findByRole('region', { name: /Hoy/ }));
    expect(today.getByText('No tienes clases programadas para hoy')).toBeInTheDocument();
    expect(today.queryByRole('button')).not.toBeInTheDocument();
  });

  it('abre el detalle al elegir una clase y lo cierra devolviendo el foco', async () => {
    get.mockResolvedValue({ userId: 'u', semester: '2026-2', enrolled: true, sessions });
    const user = userEvent.setup();
    render(<SchedulePage />);
    const today = within(await screen.findByRole('region', { name: /Hoy/ }));
    const opener = today.getByRole('button', { name: 'Bases de Datos' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Bases de Datos' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('sin matrícula: tarjeta con el aviso exacto y botón para cerrar sesión', async () => {
    get.mockResolvedValue({ userId: 'u', semester: '2026-2', enrolled: false, sessions: [] });
    const user = userEvent.setup();
    render(<SchedulePage />);
    expect(await screen.findByText('Estado Inactivo')).toBeInTheDocument();
    expect(screen.getByText('Semestre 2026-2')).toBeInTheDocument();
    expect(screen.getByText(/No tienes matrícula vigente/).closest('p')).toHaveTextContent(
      'No tienes matrícula vigente en el semestre 2026-2. Contacta a Admisiones y Registro.',
    );
    expect(screen.queryByText(/Mi horario/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalled();
  });

  it('muestra el error de carga en un role=alert', async () => {
    get.mockRejectedValue(new Error('Falla de red'));
    render(<SchedulePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falla de red');
  });
});
