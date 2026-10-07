import { AuditPort, UseCase } from './ports';

export interface AuditOptions<I, O> {
  entity: string;
  actorOf: (input: I) => string | undefined;
  detailOf?: (input: I, output: O) => unknown;
  shouldAudit?: (input: I) => boolean;
  /** Si el caso de uso lanza, registra `<action>_FAILED` con `{ message }` y relanza. */
  auditFailures?: boolean;
}

export function withAudit<I, O>(
  audit: AuditPort,
  action: string,
  inner: UseCase<I, O>,
  opts: AuditOptions<I, O>,
): UseCase<I, O> {
  return {
    async execute(input: I): Promise<O> {
      let output: O;
      try {
        output = await inner.execute(input);
      } catch (err) {
        if (opts.auditFailures) {
          await audit.record({
            actorId: opts.actorOf(input),
            action: `${action}_FAILED`,
            entity: opts.entity,
            detail: { message: err instanceof Error ? err.message : String(err) },
          }).catch((e) => console.error('[audit] no se pudo registrar el fallo:', e));
        }
        throw err;
      }
      if (!opts.shouldAudit || opts.shouldAudit(input)) {
        await audit.record({
          actorId: opts.actorOf(input),
          action,
          entity: opts.entity,
          detail: opts.detailOf?.(input, output),
        });
      }
      return output;
    },
  };
}
