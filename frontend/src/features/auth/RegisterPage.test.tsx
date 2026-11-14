import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, api } from '../../shared/api';
import RegisterPage from './RegisterPage';

vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../shared/api', async (orig) => ({ ...(await orig<typeof import('../../shared/api')>()), api: { get: vi.fn(), post: vi.fn() } }));
const post = api.post as unknown as ReturnType<typeof vi.fn>;

const renderPage = () => render(
  <MemoryRouter initialEntries={['/register']}>
    <Routes><Route path="/register" element={<RegisterPage />} /><Route path="/verify" element={<p>pantalla verificar</p>} /></Routes>
  </MemoryRouter>,
);

async function fill(user: ReturnType<typeof userEvent.setup>, over: Partial<Record<string, string>> = {}) {
  await user.type(screen.getByLabelText('Nombre completo'), over.name ?? 'Ana Pérez');
  await user.type(screen.getByLabelText('Número de documento'), over.doc ?? '1234567');
  await user.type(screen.getByLabelText('Correo institucional'), over.email ?? 'ana@amigo.edu.co');
  await user.type(screen.getByLabelText('Contraseña'), over.pw ?? 'Segura123');
}

describe('RegisterPage (RF-AUTH-01)', () => {
  beforeEach(() => post.mockReset());

  it('el botón se habilita solo con datos válidos', async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = screen.getByRole('button', { name: 'Crear cuenta' });
    expect(btn).toBeDisabled();
    await fill(user, { email: 'ana@gmail.com' });
    expect(btn).toBeDisabled();
    await user.clear(screen.getByLabelText('Correo institucional'));
    await user.type(screen.getByLabelText('Correo institucional'), 'ana@amigo.edu.co');
    expect(btn).toBeEnabled();
  });

  it('muestra el error de dominio al salir del campo (validación en tiempo real)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Correo institucional'), 'ana@gmail.com');
    await user.tab();
    expect(await screen.findByText(/correo institucional \(@amigo\.edu\.co\)/i)).toBeInTheDocument();
  });

  it('registra y pasa a la verificación con el correo en minúsculas', async () => {
    post.mockResolvedValue({ email: 'ana@amigo.edu.co', verificationRequired: true });
    const user = userEvent.setup();
    renderPage();
    await fill(user, { email: 'ANA@amigo.edu.co' });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('pantalla verificar')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ email: 'ana@amigo.edu.co', documentType: 'CC' }));
  });

  it('muestra el error del servidor (409)', async () => {
    post.mockRejectedValueOnce(new ApiError(409, 'Ya existe una cuenta con ese correo')).mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled());
  });
});
