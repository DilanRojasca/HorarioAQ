import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, api } from '../../shared/api';
import VerifyPage from './VerifyPage';

vi.mock('../../shared/api', async (orig) => ({ ...(await orig<typeof import('../../shared/api')>()), api: { get: vi.fn(), post: vi.fn() } }));
const post = api.post as unknown as ReturnType<typeof vi.fn>;

const renderPage = () => render(
  <MemoryRouter initialEntries={['/verify?email=ana@amigo.edu.co']}>
    <Routes><Route path="/verify" element={<VerifyPage />} /><Route path="/login" element={<p>login</p>} /></Routes>
  </MemoryRouter>,
);

describe('VerifyPage (RF-AUTH-05)', () => {
  beforeEach(() => post.mockReset());
  it('precarga el correo, exige 6 dígitos y al verificar vuelve al login', async () => {
    post.mockResolvedValue({ verified: true });
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByLabelText('Correo institucional')).toHaveValue('ana@amigo.edu.co');
    const btn = screen.getByRole('button', { name: 'Verificar cuenta' });
    await user.type(screen.getByLabelText('Código de verificación'), '12ab3');
    expect(screen.getByLabelText('Código de verificación')).toHaveValue('123'); // solo dígitos
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText('Código de verificación'), '456');
    await user.click(btn);
    expect(post).toHaveBeenCalledWith('/auth/verify', { email: 'ana@amigo.edu.co', code: '123456' });
    expect(await screen.findByText('login')).toBeInTheDocument();
  });
  it('muestra el error y permite reenviar', async () => {
    post.mockRejectedValueOnce(new ApiError(400, 'Código inválido o vencido')).mockResolvedValue({ sent: true });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Código de verificación'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verificar cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido');
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(post).toHaveBeenLastCalledWith('/auth/verify/resend', { email: 'ana@amigo.edu.co' });
    expect(await screen.findByRole('status')).toHaveTextContent('código nuevo');
  });
});
