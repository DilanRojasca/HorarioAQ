# módulo audit — trazabilidad

Requisitos: RF-ADM-02 · RNF-14 · QA «no repudio» y «traza de responsabilidad».

| Archivo | Patrón |
|---|---|
| [`PrismaAuditLog.ts`](PrismaAuditLog.ts) | Implementa **dos** puertos separados (Interface Segregation): `AuditPort.record` (escribir) y `AuditReader.listRecent` (leer, `GET /admin/audit`). |
| [`auditObserver.ts`](auditObserver.ts) | **Observer** con la prioridad más alta (100) sobre `ScheduleChanged`: registra `SCHEDULE_CHANGED`. |
| `../../shared/audit.ts` | **Decorator** `withAudit`: registra las acciones de usuario (login, registro, roles, catálogo, sincronización…) alrededor del caso de uso, sin que éste lo sepa. |

Dos mecanismos, cada uno para lo que es: los **eventos de dominio** se auditan por Observer; las **acciones de un usuario** por Decorator.
El login se audita también cuando **falla** (`LOGIN_FAILED`).
