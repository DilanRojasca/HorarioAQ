import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getRefreshToken, getToken, setRefreshToken, setToken } from '../../shared/api';

export interface AuthUser { id: string; name: string; email: string; role: 'STUDENT' | 'ADMIN'; avatarUrl?: string | null }
interface Ctx {
  user: AuthUser | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** Actualiza el usuario en memoria/sesión (p. ej. tras editar el perfil). */
  updateUser(patch: Partial<AuthUser>): void;
}

const AuthCtx = createContext<Ctx | null>(null);
const USER_KEY = 'horario_user';

const readUser = (): AuthUser | null => {
  if (!getToken()) return null;
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
};

/** @pattern Provider | Contexto de sesión | Usuario y acciones de sesión disponibles en todo el árbol sin pasar props. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);

  const clear = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
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
      const r = await api.post<{ token: string; refreshToken?: string; user: AuthUser }>('/auth/login', { email, password });
      setToken(r.token);
      setRefreshToken(r.refreshToken ?? null);
      try { sessionStorage.setItem(USER_KEY, JSON.stringify(r.user)); } catch { /* ignore */ }
      setUser(r.user);
    },
    async logout() {
      try { await api.post('/auth/logout', { refreshToken: getRefreshToken() ?? undefined }); } catch { /* sesión ya inválida */ }
      clear();
    },
    updateUser(patch) {
      setUser((cur) => {
        if (!cur) return cur;
        const next = { ...cur, ...patch };
        try { sessionStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
  }), [user, clear]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return c;
}
