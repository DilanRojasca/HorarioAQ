const BASE = '/api';
const KEY = 'horario_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

let token: string | null = null;
try { token = sessionStorage.getItem(KEY); } catch { /* storage no disponible */ }

export const getToken = () => token;
export function setToken(t: string | null) {
  token = t;
  try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('auth:expired')); }
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
  async download(path: string, fallbackName: string) {
    const res = await raw(path);
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  },
};
