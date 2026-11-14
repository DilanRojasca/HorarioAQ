# shared/events — el bus de eventos (patrón Observer)

> **Patrón:** Observer (publicar/suscribir). **Subject:** [`EventBus`](EventBus.ts). **Observers:** las funciones que se suscriben con `bus.subscribe`.

## Por qué existe
`SyncScheduleUseCase` detecta que el horario de un estudiante cambió. Si tuviera que llamar él mismo a auditoría, notificaciones, SSE y correo,
conocería a todos y cambiarlo sería frágil. En su lugar solo hace `bus.publish('ScheduleChanged', …)` y **no sabe quién escucha**.

## Piezas
| Archivo | Rol |
|---|---|
| [`types.ts`](types.ts) | Catálogo **tipado** de eventos (`EventMap`: tipo → payload) y contratos `Observer`, `SubscribeOptions`, `EventLog`. |
| [`EventBus.ts`](EventBus.ts) | El *Subject*. `subscribe` / `publish` / `idle`. |
| [`PrismaEventLog.ts`](PrismaEventLog.ts) | Historial persistente (`DomainEvent` + `EventDelivery`): lo que muestra el panel «Eventos recientes». |
| [`InMemoryEventLog.ts`](InMemoryEventLog.ts) | Versión para pruebas. |

## Semántica de entrega
1. Los observadores de un tipo corren **en secuencia** por **prioridad** descendente (a igual prioridad, orden de suscripción).
2. Cada observador está **aislado**: si falla se **reintenta** con *backoff* exponencial (`backoffMs × 2^(intento-1)`); agotados los reintentos queda `FAILED` y **los demás siguen**.
3. `publish` **nunca rechaza**: devuelve un `DeliveryReport` con el resultado de cada observador.
4. `once` se da de baja antes de su primera entrega.
5. `idle()` espera las publicaciones en vuelo (apagado ordenado y pruebas).

## Quién publica / quién escucha
Ver el mapa completo en [`registerObservers.ts`](../registerObservers.ts) y en la tabla de [docs/ARQUITECTURA.md §5](../../../../docs/ARQUITECTURA.md).

## Cómo añadir un observador
```ts
// 1. escribir el observador (módulo que corresponda)
bus.subscribe('NotificationCreated', async (e) => { /* enviar SMS */ }, { name: 'sms', priority: 5, retries: 2 });
// 2. suscribirlo en shared/registerObservers.ts  → ninguna otra línea del sistema cambia
```
