import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { api, setToken } from '../../shared/api';

vi.mock('../../shared/api', async (orig) => {
  const real = await orig<typeof import('../../shared/api')>();
  return { ...real, api: { ...real.api, post: vi.fn(), get: vi.fn() } };
});

function Probe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ? user.name : 'anon'}</span>
      <button onClick={() => login('a@x.co', 'pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('login guarda usuario y logout lo limpia', async () => {
    (api.post as any).mockImplementation(async (path: string) =>
      path === '/auth/login' ? { token: 't1', user: { id: '1', name: 'Ana', email: 'a@x.co', role: 'STUDENT' } } : undefined);
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
    await userEvent.click(screen.getByText('login'));
    expect(screen.getByTestId('who')).toHaveTextContent('Ana');
    expect(sessionStorage.getItem('horario_token')).toBe('t1');
    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
    expect(sessionStorage.getItem('horario_token')).toBeNull();
  });

  it('auth:expired cierra la sesión', async () => {
    setToken('t');
    sessionStorage.setItem('horario_user', JSON.stringify({ id: '1', name: 'Ana', email: 'a', role: 'STUDENT' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('Ana');
    act(() => { window.dispatchEvent(new Event('auth:expired')); });
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });

  it('un usuario guardado sin token no se considera autenticado', () => {
    setToken(null);
    sessionStorage.setItem('horario_user', JSON.stringify({ id: '1', name: 'Ana', email: 'a', role: 'STUDENT' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });
});
