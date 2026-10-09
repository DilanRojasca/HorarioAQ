import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import LoginPage from './LoginPage';

const login = vi.fn();
let currentUser: { role: 'ADMIN' | 'STUDENT' } | null = null;

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: currentUser, login, logout: vi.fn() }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>student home</p>} />
        <Route path="/admin" element={<p>admin home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => { login.mockReset(); currentUser = null; });

  it('mantiene Entrar deshabilitado hasta tener correo válido y contraseña', async () => {
    const user = userEvent.setup();
    renderLogin();
    const btn = screen.getByRole('button', { name: /entrar/i });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText('Correo'), 'alguien');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    expect(btn).toBeDisabled();
    await user.clear(screen.getByLabelText('Correo'));
    await user.type(screen.getByLabelText('Correo'), 'alguien@correo.co');
    expect(btn).toBeEnabled();
  });

  it('no muestra alerta mientras no haya error', () => {
    renderLogin();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el mensaje de la API en role=alert al fallar', async () => {
    login.mockRejectedValue(new ApiError(401, 'Credenciales inválidas'));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Correo'), 'a@b.co');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(login).toHaveBeenCalledWith('a@b.co', 'mala');
  });

  it('usa un mensaje genérico ante errores que no son de la API', async () => {
    login.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Correo'), 'a@b.co');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar sesión');
  });

  it('alterna la visibilidad de la contraseña con aria-pressed', async () => {
    const user = userEvent.setup();
    renderLogin();
    const input = screen.getByLabelText('Contraseña');
    const toggle = screen.getByRole('button', { name: /mostrar u ocultar contraseña/i });
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('redirige según el rol si ya hay sesión', async () => {
    currentUser = { role: 'ADMIN' };
    renderLogin();
    await waitFor(() => expect(screen.getByText('admin home')).toBeInTheDocument());
  });

  it('redirige a estudiantes a la raíz', () => {
    currentUser = { role: 'STUDENT' };
    renderLogin();
    expect(screen.getByText('student home')).toBeInTheDocument();
  });
});
