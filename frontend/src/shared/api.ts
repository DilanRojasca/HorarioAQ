const BASE = '/api/v1'; // versión 1 de la API (ver /api/v1/docs)
const KEY = 'horario_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const REFRESH_KEY = 'horario_refresh';

let token: string | null = null;
let refreshToken: string | null = null;
try { token = sessionStorage.getItem(KEY); refreshToken = sessionStorage.getItem(REFRESH_KEY); } catch { /* storage no disponible */ }

export const getToken = () => token;
export function setToken(t: string | null) {
  token = t;
  try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function setRefreshToken(t: string | null) {
  refreshToken = t;
  try { if (t) sessionStorage.setItem(REFRESH_KEY, t); else sessionStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
}
export const getRefreshToken = () => refreshToken;

// RNF-05: si el token de acceso expiró, se rota el refresh token UNA vez (single-flight: las peticiones
// concurrentes comparten el mismo intento) y se reintenta la petición original.
let refreshing: Promise<boolean> | null = null;
/** @pattern Proxy | Refresh single-flight | Las peticiones concurrentes comparten UN solo intento de refresh. */
function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= (async () => {
    try {
      const res = await fetch(BASE + '/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { token: string; refreshToken: string };
      setToken(body.token);
      setRefreshToken(body.refreshToken);
      return true;
    } catch { return false; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

/** @pattern Proxy | Interceptor del cliente HTTP | Ante un 401 rota el refresh token y reintenta; las pantallas no se enteran. */
async function raw(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    if (res.status === 401 && token && !retried && !path.startsWith('/auth/') && (await tryRefresh())) return raw(path, init, true);
    if (res.status === 401 && token) { setToken(null); setRefreshToken(null); window.dispatchEvent(new Event('auth:expired')); }
    let message = 'Error inesperado';
    try { message = (await res.json()).message ?? message; } catch { /* sin cuerpo */ }
    throw new ApiError(res.status, message);
  }
  return res;
}

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await raw(path);
    return res.status === 204 ? (undefined as T) : res.json();
  },
  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await raw(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
    return res.status === 204 ? (undefined as T) : res.json();
  },
  put: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await raw(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
    return res.status === 204 ? (undefined as T) : res.json();
  },
  del: async <T = void>(path: string, body?: unknown): Promise<T> => {
    const res = await raw(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) });
    return res.status === 204 ? (undefined as T) : res.json();
  },
  async download(path: string, fallbackName: string) {
    const res = await raw(path);
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
