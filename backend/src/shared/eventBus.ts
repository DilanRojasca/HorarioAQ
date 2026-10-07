import { DomainEvent, EventBus } from './ports';

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Array<(e: DomainEvent) => void | Promise<void>>>();

  subscribe(type: string, handler: (e: DomainEvent) => void | Promise<void>) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  publish(event: DomainEvent) {
    for (const h of this.handlers.get(event.type) ?? []) {
      Promise.resolve()
        .then(() => h(event))
        .catch((err) => console.error(`[eventBus] handler de ${event.type} falló:`, err));
    }
  }
}
