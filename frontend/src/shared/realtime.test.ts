import { describe, it, expect, vi } from 'vitest';
import { RealtimeClient } from './realtime';
import type { RealtimeStatus } from './realtime';

const enc = new TextEncoder();

function controlledStream() {
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { ctl = c; } });
  return { body, push: (s: string) => ctl.enqueue(enc.encode(s)), close: () => ctl.close() };
}
const okResponse = (body: ReadableStream<Uint8Array>) => ({ ok: true, status: 200, body }) as unknown as Response;
const errorResponse = (status: number) => ({ ok: false, status, body: null }) as unknown as Response;
/** Una petición que nunca responde hasta que se aborta. */
const hanging = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });

function make(fetchFn: (url: string, init?: RequestInit) => Promise<Response>, sleep = vi.fn(async (_ms: number) => {})) {
  const client = new RealtimeClient({
    url: '/api/events/stream',
    getToken: () => 'tok-123',
    fetchFn: fetchFn as unknown as typeof fetch,
    sleep,
  });
  return { client, sleep };
}

describe('RealtimeClient', () => {
  it('envía el token solo en la cabecera Authorization (no en la URL) y pide text/event-stream', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    client.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/events/stream');
    expect(url).not.toContain('tok-123');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok-123', Accept: 'text/event-stream' });
    client.stop();
  });

  it('entrega eventos con nombre, parsea JSON, ignora retry y comentarios y une tramos partidos', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const onNotification = vi.fn();
    const onReady = vi.fn();
    client.subscribe('notification', onNotification);
    client.subscribe('ready', onReady);
    client.start();
    s.push('retry: 3000\n\nevent: ready\ndata: {}\n\n: ping\n\neve');
    s.push('nt: notification\nda');
    s.push('ta: {"id":"n1","title":"Aula nu');
    s.push('eva"}\n\n');
    await vi.waitFor(() => expect(onNotification).toHaveBeenCalledTimes(1));
    expect(onNotification).toHaveBeenCalledWith({ id: 'n1', title: 'Aula nueva' });
    expect(onReady).toHaveBeenCalledWith({});
    client.stop();
  });

  it('une los data: multilínea con salto de línea y entrega texto si no es JSON; admite CRLF', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const onMulti = vi.fn();
    client.subscribe('multi', onMulti);
    client.start();
    s.push('event: multi\r\ndata: linea 1\r\ndata: linea 2\r\n\r\n');
    await vi.waitFor(() => expect(onMulti).toHaveBeenCalledTimes(1));
    expect(onMulti).toHaveBeenCalledWith('linea 1\nlinea 2');
    client.stop();
  });

  it('un manejador que lanza no afecta a los demás; unsubscribe deja de entregar', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    const removed = vi.fn();
    client.subscribe('x', bad);
    client.subscribe('x', good);
    const off = client.subscribe('x', removed);
    off();
    client.start();
    s.push('event: x\ndata: 1\n\nevent: x\ndata: 2\n\n');
    await vi.waitFor(() => expect(good).toHaveBeenCalledTimes(2));
    expect(bad).toHaveBeenCalledTimes(2);
    expect(removed).not.toHaveBeenCalled();
    expect(good).toHaveBeenNthCalledWith(1, 1);
    client.stop();
  });

  it('reconecta con espera 1 s → 2 s → 4 s y la reinicia tras abrir bien', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce(errorResponse(503))
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce(okResponse(s.body))
      .mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client, sleep } = make(fetchFn);
    client.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(4));
    expect(client.status).toBe('open');
    s.close(); // el servidor cierra el flujo: nueva espera desde 1 s
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(5));
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000, 1000]);
    client.stop();
  });

  it('la espera tiene tope de 30 s', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('red'));
    const { client, sleep } = make(fetchFn);
    let calls = 0;
    sleep.mockImplementation(async (_ms: number) => { if (++calls >= 8) client.stop(); });
    client.start();
    await vi.waitFor(() => expect(client.status).toBe('stopped'));
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it('401 detiene el cliente sin reintentar', async () => {
    const fetchFn = vi.fn().mockResolvedValue(errorResponse(401));
    const { client, sleep } = make(fetchFn);
    client.start();
    await vi.waitFor(() => expect(client.status).toBe('stopped'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stop() aborta la petición en curso y no reintenta', async () => {
    let signal: AbortSignal | undefined;
    const fetchFn = vi.fn((_u: string, init?: RequestInit) => { signal = init?.signal ?? undefined; return hanging(init); });
    const { client, sleep } = make(fetchFn);
    client.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    client.stop();
    expect(signal?.aborted).toBe(true);
    expect(client.status).toBe('stopped');
    await Promise.resolve();
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('informa los cambios de estado a onStatus y permite darse de baja', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const seen: RealtimeStatus[] = [];
    const off = client.onStatus((st) => seen.push(st));
    expect(client.status).toBe('idle');
    client.start();
    expect(client.status).toBe('connecting');
    await vi.waitFor(() => expect(client.status).toBe('open'));
    client.stop();
    off();
    expect(seen).toEqual(['connecting', 'open', 'stopped']);
  });

  it('start() es idempotente y permite reiniciar tras stop()', async () => {
    const fetchFn = vi.fn((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    client.start();
    client.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    client.stop();
    client.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    client.stop();
  });
});
