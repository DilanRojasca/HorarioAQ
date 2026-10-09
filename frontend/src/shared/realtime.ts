export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'stopped';
type Handler = (data: unknown) => void;

/** Lo mínimo que necesitan el proveedor y los hooks (permite inyectar un doble en pruebas). */
export interface RealtimeSource {
  start(): void;
  stop(): void;
  subscribe(type: string, handler: Handler): () => void;
}

export interface RealtimeOptions {
  url?: string;
  getToken: () => string | null;
  fetchFn?: typeof fetch;
  backoff?: { initialMs?: number; maxMs?: number };
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done);
  });

/**
 * Cliente de tiempo real: patrón Observer en el navegador.
 * El Sujeto es el flujo SSE de `/api/events/stream`; los observadores son quienes llaman a
 * `subscribe(tipo, manejador)` y reciben los eventos con nombre (`notification`, `schedule-changed`…).
 * Usa `fetch` en streaming (no `EventSource`) para enviar el token solo en la cabecera
 * `Authorization`, nunca en la URL, y reconecta con espera exponencial (1 s → 30 s).
 */
export class RealtimeClient implements RealtimeSource {
  status: RealtimeStatus = 'idle';
  private readonly url: string;
  private readonly getToken: () => string | null;
  private readonly fetchFn: typeof fetch;
  private readonly initialMs: number;
  private readonly maxMs: number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly statusListeners = new Set<(s: RealtimeStatus) => void>();
  private controller: AbortController | null = null;

  constructor(opts: RealtimeOptions) {
    this.url = opts.url ?? '/api/events/stream';
    this.getToken = opts.getToken;
    this.fetchFn = opts.fetchFn ?? ((...args) => fetch(...args));
    this.initialMs = opts.backoff?.initialMs ?? 1000;
    this.maxMs = opts.backoff?.maxMs ?? 30_000;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  /** Registra un observador para un tipo de evento; devuelve la función para darse de baja. */
  subscribe(type: string, handler: Handler): () => void {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => { set.delete(handler); };
  }

  onStatus(cb: (s: RealtimeStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => { this.statusListeners.delete(cb); };
  }

  start(): void {
    if (this.controller) return;
    const controller = new AbortController();
    this.controller = controller;
    this.setStatus('connecting');
    void this.run(controller);
  }

  stop(): void {
    const controller = this.controller;
    this.controller = null;
    controller?.abort();
    if (this.status !== 'stopped') this.setStatus('stopped');
  }

  private setStatus(s: RealtimeStatus) {
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  private async run(controller: AbortController): Promise<void> {
    const { signal } = controller;
    let delay = this.initialMs;
    while (!signal.aborted) {
      try {
        const token = this.getToken();
        const res = await this.fetchFn(this.url, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'text/event-stream' },
          signal,
        });
        if (res.status === 401) { this.halt(controller); return; }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        delay = this.initialMs;
        this.setStatus('open');
        await this.read(res.body.getReader(), signal);
      } catch {
        /* se reintenta abajo; un abort lo corta en el while */
      }
      if (signal.aborted) return;
      this.setStatus('reconnecting');
      await this.sleep(delay, signal);
      delay = Math.min(delay * 2, this.maxMs);
    }
  }

  private halt(controller: AbortController) {
    if (this.controller === controller) this.controller = null;
    controller.abort();
    this.setStatus('stopped');
  }

  /** Lee el flujo y separa los tramos SSE (`event:`/`data:`), ignorando comentarios y `retry:`. */
  private async read(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    let event = '';
    let data: string[] = [];
    const onLine = (raw: string) => {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (line === '') {
        if (data.length) this.dispatch(event || 'message', data.join('\n'));
        event = ''; data = [];
        return;
      }
      if (line.startsWith(':')) return;
      const i = line.indexOf(':');
      const field = i === -1 ? line : line.slice(0, i);
      const value = i === -1 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    };
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          onLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }

  private dispatch(type: string, raw: string) {
    let payload: unknown = raw;
    try { payload = JSON.parse(raw); } catch { /* se entrega como texto */ }
    for (const handler of [...(this.handlers.get(type) ?? [])]) {
      try { handler(payload); } catch { /* un manejador que falla no afecta a los demás */ }
    }
  }
}
