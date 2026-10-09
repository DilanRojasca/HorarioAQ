/** Destino de escritura SSE (subconjunto de `http.ServerResponse`). */
export interface SseWritable {
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close', cb: () => void): unknown;
}

/**
 * Sujeto (Subject) del patrón Observer para el tiempo real: mantiene las conexiones SSE abiertas
 * por usuario y les empuja eventos. Los observadores del bus (ver RealtimeObserver) lo usan para
 * notificar solo al dueño del evento (RRF-04). Envía un latido periódico para mantener viva la
 * conexión; el temporizador no retiene el proceso y se detiene cuando no quedan conexiones.
 */
export class SseHub {
  private readonly conns = new Map<string, Set<SseWritable>>();
  private timer: NodeJS.Timeout | undefined;
  private readonly heartbeatMs: number;

  constructor(opts: { heartbeatMs?: number } = {}) {
    this.heartbeatMs = opts.heartbeatMs ?? 25_000;
  }

  /** Registra la conexión, escribe el preámbulo y devuelve la función de desconexión. */
  connect(userId: string, res: SseWritable): () => void {
    if (!this.safeWrite(res, 'retry: 3000\n\nevent: ready\ndata: {}\n\n')) return () => {};
    const set = this.conns.get(userId) ?? new Set<SseWritable>();
    this.conns.set(userId, set);
    set.add(res);
    const off = () => this.remove(userId, res);
    res.on('close', off);
    this.startHeartbeat();
    return off;
  }

  /** Envía un evento a todas las conexiones del usuario; devuelve a cuántas escribió. */
  sendToUser(userId: string, event: string, data: unknown): number {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let sent = 0;
    for (const res of [...(this.conns.get(userId) ?? [])]) {
      if (this.safeWrite(res, frame, userId)) sent++;
    }
    return sent;
  }

  connectionCount(userId?: string): number {
    if (userId !== undefined) return this.conns.get(userId)?.size ?? 0;
    let n = 0;
    for (const set of this.conns.values()) n += set.size;
    return n;
  }

  /** Termina todas las conexiones (cierre ordenado del proceso). */
  closeAll(): void {
    for (const set of this.conns.values()) for (const res of set) this.end(res);
    this.conns.clear();
    this.stopHeartbeat();
  }

  private safeWrite(res: SseWritable, chunk: string, userId?: string): boolean {
    try {
      res.write(chunk);
      return true;
    } catch {
      if (userId !== undefined) { this.remove(userId, res); this.end(res); }
      return false;
    }
  }

  private end(res: SseWritable) {
    try { res.end(); } catch { /* ya cerrada */ }
  }

  private remove(userId: string, res: SseWritable) {
    const set = this.conns.get(userId);
    if (!set?.delete(res)) return;
    if (set.size === 0) this.conns.delete(userId);
    if (this.conns.size === 0) this.stopHeartbeat();
  }

  private startHeartbeat() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      for (const [userId, set] of [...this.conns]) for (const res of [...set]) this.safeWrite(res, ': ping\n\n', userId);
    }, this.heartbeatMs);
    this.timer.unref();
  }

  private stopHeartbeat() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
