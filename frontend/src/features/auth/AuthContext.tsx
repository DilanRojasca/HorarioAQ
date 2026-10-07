import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken } from '../../shared/api';

export interface AuthUser { id: string; name: string; email: string; role: 'STUDENT' | 'ADMIN' }
interface Ctx {
  user: AuthUser | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);
const USER_KEY = 'horario_user';

const readUser = (): AuthUser | null => {
  if (!getToken()) return null;
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);

  const clear = useCallback(() => {
    setToken(null);
    try { sessionStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:expired', clear);
    return () => window.removeEventListener('auth:expired', clear);
  }, [clear]);

  const value = useMemo<Ctx>(() => ({
    user,
    async login(email, password) {
      const r = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
      setToken(r.token);
      try { sessionStorage.setItem(USER_KEY, JSON.stringify(r.user)); } catch { /* ignore */ }
      setUser(r.user);
    },
    async logout() {
      try { await api.post('/auth/logout'); } catch { /* sesión ya inválida */ }
      clear();
    },
  }), [user, clear]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return c;
}
