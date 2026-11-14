# schedule/application — casos de uso y puertos

| Archivo | Qué es | Patrón |
|---|---|---|
| [`ports.ts`](ports.ts) | `ScheduleRepository`, `EnrollmentRepository`, `InstitutionalPort`, `SyncRunRepository` | **Ports** + **Repository** |
| [`SyncSchedule.ts`](SyncSchedule.ts) | Para cada estudiante matriculado: pide el horario al adaptador → calcula el diff → persiste → **publica `ScheduleChanged`**; al final `SyncCompleted`/`SyncFailed` | **Facade** + origen del **Observer** |
| [`GetWeeklySchedule.ts`](GetWeeklySchedule.ts) | RF-HOR-01 con filtros opcionales (Specification) | Use Case |
| [`GetSessionDetail.ts`](GetSessionDetail.ts) | RF-HOR-03 | Use Case |
| [`ExportSchedule.ts`](ExportSchedule.ts) | RF-HOR-04: elige el exportador según el formato | **Strategy** (por formato) |

`SyncScheduleUseCase` es una **fachada**: el controlador llama a `execute()` y no sabe que detrás hay adaptador institucional, diff, transacción, concurrencia limitada y eventos.
Publica con `void bus.publish(...)`: un observador lento (correo) nunca retrasa la sincronización.
