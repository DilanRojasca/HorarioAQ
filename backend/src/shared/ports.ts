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
