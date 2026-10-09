import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';
import type { ToastInput } from './ToastProvider';

let toast!: (t: ToastInput) => void;
function Grab() { toast = useToast().toast; return null; }
const setup = () => render(<ToastProvider><Grab /></ToastProvider>);

describe('ToastProvider', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('mantiene siempre montada una región role=status aria-live=polite', () => {
    setup();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('muestra el aviso con título y mensaje y se cierra solo a los 6 s', () => {
    setup();
    act(() => toast({ title: 'Aula cambiada', message: 'Bloque B, aula 208', tone: 'success' }));
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Aula cambiada');
    expect(region).toHaveTextContent('Bloque B, aula 208');
    act(() => { vi.advanceTimersByTime(5900); });
    expect(screen.getByText('Aula cambiada')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByText('Aula cambiada')).not.toBeInTheDocument();
  });

  it('muestra como máximo 3 avisos: los más antiguos se retiran', () => {
    setup();
    act(() => { ['A', 'B', 'C', 'D'].forEach((title) => toast({ title })); });
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cerrar aviso' })).toHaveLength(3);
    ['B', 'C', 'D'].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  });

  it('se puede cerrar a mano con el botón', () => {
    setup();
    act(() => toast({ title: 'Hola' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Hola')).not.toBeInTheDocument();
  });

  it('el cierre automático se pausa con el ratón encima y se reanuda al salir', () => {
    setup();
    act(() => toast({ title: 'Pausa' }));
    const item = screen.getByText('Pausa').closest('[data-toast]')!;
    fireEvent.mouseEnter(item);
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText('Pausa')).toBeInTheDocument();
    fireEvent.mouseLeave(item);
    act(() => { vi.advanceTimersByTime(6100); });
    expect(screen.queryByText('Pausa')).not.toBeInTheDocument();
  });

  it('el cierre automático se pausa mientras el foco está dentro', () => {
    setup();
    act(() => toast({ title: 'Foco' }));
    const button = screen.getByRole('button', { name: 'Cerrar aviso' });
    fireEvent.focus(button);
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText('Foco')).toBeInTheDocument();
    fireEvent.blur(button);
    act(() => { vi.advanceTimersByTime(6100); });
    expect(screen.queryByText('Foco')).not.toBeInTheDocument();
  });

  it('useToast fuera del proveedor no falla (no hace nada)', () => {
    function Lone() { useToast().toast({ title: 'x' }); return <p>ok</p>; }
    render(<Lone />);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
