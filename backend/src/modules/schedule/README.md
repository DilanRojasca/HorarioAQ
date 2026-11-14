# módulo schedule — horario, sincronización y exportación

Requisitos: RF-HOR-01..05 · RF-BUS-01/02 · RF-ADM-03 · RRF-01/02/04/07. Prefijos: `/api/schedule`, `/api/admin`.

## Capas y patrones
| Capa | Archivos clave | Patrón y por qué |
|---|---|---|
| [`domain/`](domain/README.md) | `types`, `diff`, `sort`, `access`, `specifications` | Reglas puras; **Specification** para búsqueda/filtros. |
| [`application/`](application/README.md) | `SyncSchedule`, `GetWeeklySchedule`, `GetSessionDetail`, `ExportSchedule`, `ports.ts` | **Facade** (`SyncScheduleUseCase`), **Use Case**, **puertos** (`InstitutionalPort`, `ScheduleRepository`…). |
| [`infrastructure/`](infrastructure/README.md) | `MockInstitutionalAdapter`, `Prisma*Repository`, `exporters/` | **Adapter**, **Repository**, **Template Method**. |
| [`http/`](http/README.md) | `scheduleRoutes`, `adminRoutes` | Adaptadores de entrada con RBAC. |
| [`observers/`](observers/) | `syncStatsObserver.ts` | **Observer**: al llegar `SyncCompleted` guarda el desglose en `SyncRun.stats`. |

## Reglas de negocio que se cumplen aquí
* **RRF-02 / RRF-07**: el único que escribe horarios es `SyncScheduleUseCase`; no hay rutas de escritura (hay un test que lo comprueba).
* **RRF-01**: solo se sincroniza/ve el horario de estudiantes con matrícula vigente.
* **RRF-04**: `assertCanView` — un estudiante solo ve el suyo; el admin ve el de terceros y **queda auditado**.
* **Sincronización de una sola corrida** (`tryStart` devuelve `null` si ya hay otra) y tolerante a fallos por estudiante (`OK` / `PARTIAL` / `FAILED`).
