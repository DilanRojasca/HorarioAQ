/** @pattern Command | Contrato de caso de uso | Cada acción del sistema es un objeto con execute(); permite decorarlo, probarlo y reutilizarlo. */
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
export interface AuditRecord extends AuditEntry { id: string; createdAt: Date }
/** Puerto de LECTURA del log (RF-ADM-02). Separado de `AuditPort` (ISP): quien registra no necesita leer. */
export interface AuditReader {
  listRecent(limit: number, filter?: { action?: string }): Promise<AuditRecord[]>;
}
