import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../shared/api';
import ProfilePage from './ProfilePage';

const updateUser = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ updateUser }) }));
vi.mock('../../shared/api', async (orig) => ({ ...(await orig<typeof import('../../shared/api')>()), api: { get: vi.fn(), put: vi.fn() } }));
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;
const profile = { name: 'Ana Pérez', email: 'ana@amigo.edu.co', documentType: 'CC', documentNumber: '123', avatarUrl: null };

describe('ProfilePage (RF-AUTH-06)', () => {
  beforeEach(() => { get.mockReset(); put.mockReset(); updateUser.mockReset(); get.mockResolvedValue(profile); });

  it('correo y documento son de solo lectura', async () => {
    render(<ProfilePage />);
    expect(await screen.findByLabelText('Correo institucional')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Documento')).toHaveAttribute('readonly');
  });
  it('actualiza el nombre y lo refleja en la sesión', async () => {
    put.mockResolvedValue({ ...profile, name: 'Ana María Pérez' });
    const user = userEvent.setup();
    render(<ProfilePage />);
    const input = await screen.findByLabelText('Nombre completo');
    await user.clear(input); await user.type(input, 'Ana María Pérez');
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(put).toHaveBeenCalledWith('/auth/me', { name: 'Ana María Pérez' });
    expect(updateUser).toHaveBeenCalledWith({ name: 'Ana María Pérez', avatarUrl: null });
    expect(await screen.findByText('Nombre actualizado.')).toBeInTheDocument();
  });
  it('cambiar contraseña exige la actual y una nueva válida', async () => {
    put.mockResolvedValue(profile);
    const user = userEvent.setup();
    render(<ProfilePage />);
    const btn = await screen.findByRole('button', { name: 'Cambiar contraseña' });
    await user.type(screen.getByLabelText('Contraseña actual'), 'Vieja1234');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'debil');
    expect(btn).toBeDisabled();
    await user.clear(screen.getByLabelText('Nueva contraseña'));
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva12345');
    await user.click(btn);
    expect(put).toHaveBeenCalledWith('/auth/me', { currentPassword: 'Vieja1234', newPassword: 'Nueva12345' });
  });
  it('rechaza una foto de tipo no permitido', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ProfilePage />);
    await screen.findByLabelText('Nombre completo');
    await user.upload(document.getElementById('photo') as HTMLInputElement, new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPG o WebP');
    expect(put).not.toHaveBeenCalled();
  });
});
