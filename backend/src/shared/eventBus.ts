import { DomainEvent, EventBus } from './ports';

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Array<(e: DomainEvent) => void | Promise<void>>>();

  private pending = new Set<Promise<void>>();

  subscribe(type: string, handler: (e: DomainEvent) => void | Promise<void>) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  publish(event: DomainEvent) {
    for (const h of this.handlers.get(event.type) ?? []) {
      const p: Promise<void> = Promise.resolve()
        .then(() => h(event))
        .catch((err) => console.error(`[eventBus] handler de ${event.type} falló:`, err))
        .finally(() => this.pending.delete(p));
      this.pending.add(p);
    }
  }

  /** Espera a que terminen los handlers en curso (p. ej. antes de cerrar el proceso del seed). */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }
}
