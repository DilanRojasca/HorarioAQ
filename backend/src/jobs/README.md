# jobs/ — disparadores periódicos

Cada job es un `node-cron` que **invoca un caso de uso**; no contiene lógica de negocio (patrón *Command*: la misma acción se dispara desde HTTP o desde el reloj).

| Job | Frecuencia | Llama a | Requisito |
|---|---|---|---|
| [`syncJob.ts`](syncJob.ts) | `SYNC_CRON` (03:00) | `sync.execute({ trigger: 'CRON' })` | RF-HOR-02/05, RF-ADM-03 (baja demanda, QA «uso de recursos») |
| [`notificationFlushJob.ts`](notificationFlushJob.ts) | `NOTIFY_FLUSH_CRON` (5 min) | `flushPendingEmails` (correos pendientes por estar fuera de ventana) | RRF-05 |
| [`reminderJob.ts`](reminderJob.ts) | cada minuto | `planReminders` + `dispatchDue` | RF-NOT-01/02 |

**Escalamiento horizontal:** con varias réplicas el cron corre en todas; por eso lo que importa es idempotente: `tryStart` (sincronización de una sola corrida), `claimDue` (notificaciones programadas), `dedupKey` (recordatorios) y `claimEmail` (correo).
