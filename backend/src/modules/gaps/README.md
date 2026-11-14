# módulo gaps — tiempos libres entre clases

Requisitos: RF-HUE-01..04. Prefijo: `/api/gaps` (solo STUDENT).

| Capa | Archivo | Patrón y por qué |
|---|---|---|
| [`domain/gaps.ts`](domain/gaps.ts) | `detectGaps(sesiones)` | Función pura (RF-HUE-01): espacios ≥ 15 min entre clases **consecutivas del mismo día**; ignora canceladas y fusiona solapadas. |
| [`domain/suggestions.ts`](domain/suggestions.ts) | `restStrategy`, `mealStrategy`, `studyStrategy`, `suggestFor` | **Strategy** (RF-HUE-02): `<30 min` descanso · `30–60` alimentación · `>60` estudio. Cada regla es una estrategia; `suggestFor` elige sin `if/else`. Regla nueva = estrategia nueva. |
| [`application/GapUseCases.ts`](application/GapUseCases.ts) | `GapService`, `ListGaps`, `AssignActivity`, `RemoveActivity`, `SetGapStatus` | **Facade interno** (`GapService` combina horario + repositorio + dominio) y Use Cases. Valida que el hueco **exista** en el horario antes de aceptar actividad o estado. |
| [`application/ports.ts`](application/ports.ts) | `GapRepository` | **Repository** (actividades y estado por hueco). |
| [`infrastructure/PrismaGapRepository.ts`](infrastructure/PrismaGapRepository.ts) | implementa el puerto | Repository (PostgreSQL, clave única usuario+día+franja). |
| [`http/gapRoutes.ts`](http/gapRoutes.ts) | rutas | Adaptador de entrada. |

**Reglas:** un hueco `OCCUPIED` o con actividad propia **no recibe sugerencia** (RF-HUE-04). Los huecos se calculan al vuelo desde el horario: no se guardan, así nunca quedan desactualizados tras una sincronización.
