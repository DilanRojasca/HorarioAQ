import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import ClassDetail from './ClassDetail';
import { mk } from './fixtures';

const session = mk({ externalId: 'a', courseName: 'Algoritmos', courseCode: 'ALG101' });

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      {open && <ClassDetail session={session} onClose={() => setOpen(false)} />}
    </>
  );
}

describe('ClassDetail', () => {
  it('es un diálogo modal con el contenido real de la clase', () => {
    render(<ClassDetail session={session} onClose={() => {}} />);
    const dlg = screen.getByRole('dialog', { name: 'Algoritmos' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveTextContent('Ficha de asignatura');
    expect(dlg).toHaveTextContent('ALG101');
    expect(dlg).toHaveTextContent('Miércoles');
    expect(dlg).toHaveTextContent('07:00 – 09:00');
    expect(dlg).toHaveTextContent('2 horas');
    expect(dlg).toHaveTextContent('Bloque');
    expect(dlg).toHaveTextContent('Piso');
    expect(dlg).toHaveTextContent('Aula');
    expect(dlg).toHaveTextContent('Marta Lucía Gómez');
    expect(dlg).toHaveTextContent('ML');
  });

  it('Escape cierra', async () => {
    const onClose = vi.fn();
    render(<ClassDetail session={session} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic en el overlay cierra, clic dentro del panel no', async () => {
    const onClose = vi.fn();
    render(<ClassDetail session={session} onClose={onClose} />);
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('detail-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mueve el foco al panel, lo devuelve al abridor y bloquea el scroll del body', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('atrapa el foco: Tab y Shift+Tab dan la vuelta', async () => {
    const user = userEvent.setup();
    render(<ClassDetail session={session} onClose={() => {}} />);
    const close = screen.getByRole('button', { name: 'Cerrar ventana' });
    const footer = screen.getByRole('button', { name: 'Cerrar detalle' });
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(footer).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(footer).toHaveFocus();
  });
});
