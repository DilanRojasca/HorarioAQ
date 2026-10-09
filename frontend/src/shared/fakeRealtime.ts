import type { RealtimeSource } from './realtime';

/** Doble de prueba de `RealtimeClient`: permite emitir eventos a mano. Solo para tests. */
export class FakeRealtime implements RealtimeSource {
  started = 0;
  stopped = 0;
  private handlers = new Map<string, Set<(data: unknown) => void>>();
  start() { this.started += 1; }
  stop() { this.stopped += 1; }
  subscribe(type: string, handler: (data: unknown) => void) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => { set.delete(handler); };
  }
  emit(type: string, data: unknown = {}) {
    this.handlers.get(type)?.forEach((h) => h(data));
  }
  listeners(type: string) { return this.handlers.get(type)?.size ?? 0; }
}
