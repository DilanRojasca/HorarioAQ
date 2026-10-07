import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeeklyCalendar from './WeeklyCalendar';
import type { Session } from './types';

const sess: Session = {
  externalId: 'e1', userId: 'u', semester: '2026-2', courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta',
  weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201', status: 'ACTIVE',
};

describe('WeeklyCalendar', () => {
  it('muestra encabezados de días y la clase con materia, salón y bloque', () => {
    render(<WeeklyCalendar sessions={[sess]} onSelect={() => {}} />);
    expect(screen.getByText('Lunes')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Algoritmos/ });
    expect(btn).toHaveTextContent('Aula 201');
    expect(btn).toHaveTextContent('Bloque A');
  });
  it('al hacer clic llama onSelect con la sesión', async () => {
    const onSelect = vi.fn();
    render(<WeeklyCalendar sessions={[sess]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Algoritmos/ }));
    expect(onSelect).toHaveBeenCalledWith(sess);
  });
  it('la clase ocupa las filas correspondientes a su duración', () => {
    render(<WeeklyCalendar sessions={[sess]} onSelect={() => {}} />);
    const btn = screen.getByRole('button', { name: /Algoritmos/ });
    expect(btn.style.gridRow).toBe('4 / 8'); // 08:00 → fila 4; 10:00 → fila 8
    expect(btn.style.gridColumn).toBe('2');
  });
});
