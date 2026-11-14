import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, getRefreshToken, getToken, setRefreshToken, setToken } from './api';

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api: refresh token rotativo (RNF-05)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); setToken('viejo'); setRefreshToken('r1'); });
  afterEach(() => { vi.unstubAllGlobals(); setToken(null); setRefreshToken(null); });

  it('ante un 401 rota el refresh token una vez y reintenta la petición original', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: 'expirado' }))
      .mockResolvedValueOnce(json(200, { token: 'nuevo', refreshToken: 'r2' }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    expect(await api.get('/schedule/me')).toEqual({ ok: true });
    expect(getToken()).toBe('nuevo');
    expect(getRefreshToken()).toBe('r2');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer nuevo');
  });

  it('peticiones concurrentes comparten UN solo refresh (single-flight)', async () => {
    fetchMock.mockImplementation(async (url: string, init: { headers: Record<string, string> }) => {
      if (url.endsWith('/auth/refresh')) return json(200, { token: 'nuevo', refreshToken: 'r2' });
      return init.headers.Authorization === 'Bearer nuevo' ? json(200, {}) : json(401, { message: 'x' });
    });
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('si el refresh falla, cierra la sesión (auth:expired) y propaga el 401', async () => {
    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    fetchMock.mockResolvedValueOnce(json(401, { message: 'expirado' })).mockResolvedValueOnce(json(401, {}));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalled();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    window.removeEventListener('auth:expired', expired);
  });

  it('un 401 en /auth/* (p. ej. login) no intenta refrescar', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { message: 'Credenciales inválidas' }));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
