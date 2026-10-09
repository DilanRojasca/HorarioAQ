import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayAgenda from './DayAgenda';
import { mk } from './fixtures';

const sessions = [
  mk({ externalId: 'a', courseName: 'Algoritmos', weekday: 3, startTime: '07:00', endTime: '09:00' }),
  mk({ externalId: 'b', courseName: 'Física', weekday: 4, startTime: '08:00', endTime: '09:30', block: 'C', room: '305' }),
];
const wed = new Date(2026, 9, 7, 12, 0);

describe('DayAgenda', () => {
  it('muestra pestañas LUN–SÁB con el día del mes y selecciona hoy', () => {
    render(<DayAgenda sessions={sessions} now={wed} onSelect={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['LUN5', 'MAR6', 'MIÉ7', 'JUE8', 'VIE9', 'SÁB10']);
    expect(screen.getByRole('tab', { name: /MIÉ/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Algoritmos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Física' })).not.toBeInTheDocument();
  });

  it('al elegir otro día cambian las tarjetas visibles', async () => {
    const user = userEvent.setup();
    render(<DayAgenda sessions={sessions} now={wed} onSelect={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /JUE/ }));
    expect(screen.getByRole('tab', { name: /JUE/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /MIÉ/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('button', { name: 'Física' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Algoritmos' })).not.toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('1 h 30 min');
    expect(panel).toHaveTextContent('Bloque C · Aula 305');
  });

  it('las flechas del teclado mueven la selección', async () => {
    const user = userEvent.setup();
    render(<DayAgenda sessions={sessions} now={wed} onSelect={() => {}} />);
    screen.getByRole('tab', { name: /MIÉ/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /JUE/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /JUE/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /LUN/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /SÁB/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('día sin clases muestra mensaje; domingo arranca en lunes', () => {
    render(<DayAgenda sessions={sessions} now={new Date(2026, 9, 4, 12, 0)} onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: /LUN/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No hay clases este día.')).toBeInTheDocument();
  });

  it('el título abre el detalle', async () => {
    const onSelect = vi.fn();
    render(<DayAgenda sessions={sessions} now={wed} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Algoritmos' }));
    expect(onSelect).toHaveBeenCalledWith(sessions[0]);
  });
});
