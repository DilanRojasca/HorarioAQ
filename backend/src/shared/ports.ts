export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
export interface AuditEntry {
  actorId?: string;
  action: string;
  entity: string;
  detail?: unknown;
}
export interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
}
export interface DomainEvent {
  type: string;
  [key: string]: unknown;
}
export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(type: string, handler: (event: DomainEvent) => void | Promise<void>): void;
}
