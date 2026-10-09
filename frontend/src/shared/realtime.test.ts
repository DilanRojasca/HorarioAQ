import { describe, it, expect, vi } from 'vitest';
import { RealtimeClient } from './realtime';
import type { RealtimeStatus } from './realtime';

const enc = new TextEncoder();

function controlledStream() {
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { ctl = c; } });
  return { body, push: (s: string) => ctl.enqueue(enc.encode(s)), pushBytes: (b: Uint8Array) => ctl.enqueue(b), close: () => ctl.close() };
}
const okResponse = (body: ReadableStream<Uint8Array>) => ({ ok: true, status: 200, body }) as unknown as Response;
const errorResponse = (status: number) => ({ ok: false, status, body: null }) as unknown as Response;
/** Una petición que nunca responde hasta que se aborta. */
const hanging = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });

function make(
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
  sleep: ReturnType<typeof vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>> = vi.fn(async (_ms: number) => {}),
) {
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

  it('une un carácter multibyte partido entre dos tramos', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const got = vi.fn();
    client.subscribe('t', got);
    client.start();
    const bytes = enc.encode('event: t\ndata: {"m":"Cálculo ñ"}\n\n');
    const cut = bytes.indexOf(0xc3) + 1; // entre los dos bytes de "á"
    s.pushBytes(bytes.slice(0, cut));
    s.pushBytes(bytes.slice(cut));
    await vi.waitFor(() => expect(got).toHaveBeenCalledTimes(1));
    expect(got).toHaveBeenCalledWith({ m: 'Cálculo ñ' });
    client.stop();
  });

  it('un tramo sin evento se entrega como "message"', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const got = vi.fn();
    client.subscribe('message', got);
    client.start();
    s.push('data: hola\n\n');
    await vi.waitFor(() => expect(got).toHaveBeenCalledWith('hola'));
    client.stop();
  });

  it('un último tramo sin línea en blanco se descarta', async () => {
    const s = controlledStream();
    const fetchFn = vi.fn().mockResolvedValueOnce(okResponse(s.body)).mockImplementation((_u: string, init?: RequestInit) => hanging(init));
    const { client } = make(fetchFn);
    const got = vi.fn();
    client.subscribe('x', got);
    client.start();
    s.push('event: x\ndata: 1\n');
    s.close();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2)); // reconectó
    expect(got).not.toHaveBeenCalled();
    client.stop();
  });

  it('stop() durante la espera de reconexión no vuelve a conectar', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('red'));
    const sleep = vi.fn((_ms: number, signal?: AbortSignal) => new Promise<void>((res) => signal?.addEventListener('abort', () => res())));
    const { client } = make(fetchFn, sleep);
    client.start();
    await vi.waitFor(() => expect(sleep).toHaveBeenCalledTimes(1));
    client.stop();
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(client.status).toBe('stopped');
  });

  it('si stop() llega entre la respuesta y su continuación el estado no queda en open', async () => {
    let resolve!: (r: Response) => void;
    const fetchFn = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    const { client } = make(fetchFn);
    const seen: RealtimeStatus[] = [];
    client.onStatus((st) => seen.push(st));
    client.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    client.stop();
    resolve(okResponse(controlledStream().body));
    await new Promise((r) => setTimeout(r, 10));
    expect(client.status).toBe('stopped');
    expect(seen).not.toContain('open');
  });

  it('sin token no intenta conectar y se queda en idle', async () => {
    const fetchFn = vi.fn();
    const client = new RealtimeClient({ getToken: () => null, fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => {} });
    client.start();
    await Promise.resolve();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(client.status).toBe('idle');
  });

  it('403 detiene el cliente sin reintentar', async () => {
    const fetchFn = vi.fn().mockResolvedValue(errorResponse(403));
    const { client, sleep } = make(fetchFn);
    client.start();
    await vi.waitFor(() => expect(client.status).toBe('stopped'));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
