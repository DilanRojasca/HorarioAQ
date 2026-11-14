# features/schedule

| Archivo | Qué hace |
|---|---|
| [`SchedulePage.tsx`](SchedulePage.tsx) | Pantalla principal: hoy (clases en curso/siguiente), búsqueda y filtros, semana. Se actualiza en vivo con `useRealtime('schedule-changed')`. |
| [`useSchedule.ts`](useSchedule.ts) | **Custom Hook**: carga el horario, «gana la última respuesta» y una recarga fallida no borra lo que ya se muestra. |
| [`filter.ts`](filter.ts) + [`SearchFilters.tsx`](SearchFilters.tsx) | RF-BUS-01/02. `filter.ts` es la **réplica cliente de las Specifications** del backend (`schedule/domain/specifications.ts`): filtra al instante mientras se escribe, sin una petición por tecla. |
| [`WeeklyCalendar.tsx`](WeeklyCalendar.tsx) / [`DayAgenda.tsx`](DayAgenda.tsx) | RF-HOR-01: calendario día×hora en escritorio y agenda por día en móvil (RNF-08, desde 320 px). |
| [`ClassDetail.tsx`](ClassDetail.tsx) | RF-HOR-03. |
| [`ExportMenu.tsx`](ExportMenu.tsx) | RF-HOR-04 (PDF / `.ics`). |
| `grid.ts`, `time.ts` | Reglas puras de posición y tiempo (probadas sin React). |
