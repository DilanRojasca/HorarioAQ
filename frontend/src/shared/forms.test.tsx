import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Field, OptionCards, OtpField, PasswordField, SelectField, Switch, passwordRules, passwordScore } from './forms';

describe('passwordRules / passwordScore', () => {
  it('cuenta los requisitos cumplidos', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Abcdefgh')).toBe(2);
    expect(passwordScore('Abcdefg1')).toBe(3);
    expect(passwordRules('Ab1').map((r) => r.ok)).toEqual([false, true, true]);
  });
});

describe('PasswordField', () => {
  const Harness = () => { const [v, setV] = useState(''); return <PasswordField id="pw" label="Contraseña" showStrength value={v} onChange={(e) => setV(e.target.value)} />; };
  it('muestra/oculta la contraseña', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar u ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
  });
  it('el medidor y la lista de requisitos reaccionan mientras se escribe', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByLabelText('Requisitos de la contraseña')).toHaveTextContent('Mínimo 8 caracteres: pendiente');
    await user.type(screen.getByLabelText('Contraseña'), 'Segura123');
    expect(screen.getByLabelText('Requisitos de la contraseña')).toHaveTextContent('Mínimo 8 caracteres: cumplido');
    expect(screen.getByText('Fuerte')).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('asocia el error con aria-describedby y marca aria-invalid', () => {
    render(<Field id="e" label="Correo" error="Correo inválido" value="x" onChange={() => {}} />);
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'e-err');
    expect(screen.getByText('Correo inválido')).toHaveAttribute('id', 'e-err');
  });
  it('muestra el contador cerca del límite y la marca «(opcional)»', () => {
    render(<Field id="t" label="Título" optional maxLength={10} value="12345678" onChange={() => {}} />);
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('(opcional)')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('con loading se deshabilita, marca aria-busy y cambia el texto', () => {
    render(<Button loading loadingText="Guardando…">Guardar</Button>);
    const b = screen.getByRole('button', { name: 'Guardando…' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
  });
  it('dispara onClick cuando está habilitado', async () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Ok</Button>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ok' }));
    expect(fn).toHaveBeenCalled();
  });
});

describe('Switch', () => {
  it('es un role="switch" accesible que alterna', async () => {
    const fn = vi.fn();
    render(<Switch checked={false} onChange={fn} label="Marcar" />);
    const sw = screen.getByRole('switch', { name: 'Marcar' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.setup().click(sw);
    expect(fn).toHaveBeenCalledWith(true);
  });
});

describe('OptionCards / SelectField / OtpField', () => {
  it('OptionCards usa radios reales y avisa del cambio', async () => {
    const fn = vi.fn();
    render(<OptionCards legend="Canal" name="c" value="A" onChange={fn} options={[{ value: 'A', label: 'Uno' }, { value: 'B', label: 'Dos' }]} />);
    expect(screen.getByLabelText(/^Uno/)).toBeChecked();
    await userEvent.setup().click(screen.getByLabelText(/^Dos/));
    expect(fn).toHaveBeenCalledWith('B');
  });
  it('SelectField asocia etiqueta y opciones', async () => {
    render(<SelectField id="s" label="Tipo" defaultValue="a"><option value="a">A</option><option value="b">B</option></SelectField>);
    await userEvent.setup().selectOptions(screen.getByLabelText('Tipo'), 'b');
    expect(screen.getByLabelText('Tipo')).toHaveValue('b');
  });
  it('OtpField solo admite dígitos', async () => {
    const Harness = () => { const [v, setV] = useState(''); return <OtpField id="o" label="Código" value={v} onChange={setV} />; };
    render(<Harness />);
    await userEvent.setup().type(screen.getByLabelText('Código'), '1a2b3');
    expect(screen.getByLabelText('Código')).toHaveValue('123');
  });
});
