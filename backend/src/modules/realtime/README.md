# módulo realtime — empuje en vivo al navegador

Requisito: RF-NOT-03 (aviso inmediato). Ruta: `GET /api/events/stream` (SSE autenticado).

| Archivo | Patrón |
|---|---|
| [`SseHub.ts`](SseHub.ts) | Registro de conexiones abiertas por usuario (`sendToUser`) con latido. Es el canal del *Subject* hacia el navegador. |
| [`RealtimeObserver.ts`](RealtimeObserver.ts) | **Observer**: `realtime-schedule` (ScheduleChanged → `schedule-changed`) y `realtime-notification` (NotificationCreated → `notification`, solo en ventana, sin re-publicaciones y respetando el canal preferido). |
| [`http/eventsRoutes.ts`](http/eventsRoutes.ts) | Endpoint SSE; el token va en la cabecera `Authorization`, nunca en la URL. |

En el navegador el otro lado es `frontend/src/shared/realtime.ts` (`RealtimeClient`): otro Observer, con reconexión exponencial.
**¿Por qué SSE y no WebSocket?** Solo hay flujo servidor → cliente; SSE es más simple y atraviesa proxies.
