# schedule/domain — reglas puras

| Archivo | Qué hace | Patrón |
|---|---|---|
| [`types.ts`](types.ts) | `ClassSession`, `ScheduleChange`, `Role` | — |
| [`diff.ts`](diff.ts) | Compara horario institucional vs local y produce los cambios `ADDED/UPDATED/CANCELLED` | función pura |
| [`sort.ts`](sort.ts) | Orden y filtro de clases activas | función pura |
| [`access.ts`](access.ts) | `assertCanView`: privacidad del horario (RRF-04) | regla de dominio |
| [`specifications.ts`](specifications.ts) | **Specification** (RF-BUS-01/02): `courseMatches`, `onWeekday`, `inBlock`, `taughtBy` + combinadores `and/or/not`; `buildScheduleSpec(filtro)` actúa de **Factory** | **Specification** + Factory |

Por qué Specification: cada criterio de búsqueda es un objeto pequeño y reutilizable; los filtros del usuario se **componen** sin `if` anidados. Quitar tildes/mayúsculas está en `normalize`.
