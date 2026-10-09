# Horario UNI — Eventos de dominio y patrón Observer (diseño)

Extiende el módulo de Horario Académico (`2026-10-07-horario-uni-design.md`). Hoy el Observer es mínimo (un bus de ~15 líneas, un evento, un observador). Esta iteración lo convierte en un subsistema completo y adelanta la parte de Notificaciones que se alimenta de él (RF-NOT-03, RRF-05).

## Alcance
**Dentro**
1. Bus de eventos tipado (el *Subject*): suscripción/baja, `once`, prioridad, aislamiento de errores, reintentos con espera creciente, historial persistente de eventos y entregas.
2. Observadores del backend: auditoría, notificaciones en la app, estadísticas de sincronización, tiempo real (SSE) y correo.
3. Correo con puerto `EmailPort` y dos adaptadores: **consola (por defecto)** y **Brevo** (inactivo hasta configurar remitente verificado y redirección de desarrollo).
4. Tiempo real al navegador por SSE (`GET /api/events/stream`).
5. Frontend: cliente de tiempo real (Observer en el navegador), campana de notificaciones, avisos en vivo, recarga automática del horario y panel "Eventos recientes" para el admin.
6. Ventana horaria de envío 6:00–22:00 (RRF-05) para push y correo.

**Fuera**: registro/OTP, huecos, recordatorios programados (RF-NOT-02), notificaciones personalizadas (RF-NOT-01), configuración de canal por usuario (RF-NOT-04), búsqueda, CRUD de facultades. Brevo real queda apagado hasta que el usuario entregue remitente verificado y correo de pruebas.

## Patrón Observer — roles
- **Sujeto:** `EventBus` (backend) y `RealtimeClient` (navegador). Mantienen la lista de observadores y notifican.
- **Observadores del backend** (nombre, prioridad mayor = antes): `audit` (100), `notifications` (50), `sync-stats` (40), `realtime` (30), `email` (10).
- **Observadores del navegador:** campana/toast (`notification`), `SchedulePage` (`schedule-changed`).
- Acoplamiento: quien publica (`SyncScheduleUseCase`) no conoce a ningún observador.

## Eventos (tipados)
```
ScheduleChanged     { userId, semester, changes: ScheduleChange[] }
SyncCompleted       { runId, trigger, studentsSynced, changesCount, failures, changesByType:{ADDED,UPDATED,CANCELLED} }
SyncFailed          { runId, trigger, message }
NotificationCreated { notificationId, userId, title, message, kind }
```
`DomainEvent<T> = { id: uuid, type: T, occurredAt: Date, payload: EventMap[T] }`.

## Semántica del bus
- `subscribe(type, observer, {name, priority=0, once=false, retries=2, backoffMs=1000}) → {unsubscribe()}`.
- `publish(type, payload) → Promise<DeliveryReport>`; **nunca rechaza**. Los observadores de un evento corren **en secuencia**, ordenados por prioridad desc (empate: orden de suscripción), cada uno aislado: si falla, se reintenta (`retries` veces, espera `backoffMs·2^(n-1)`) y, agotado, se registra `FAILED` y se continúa con el siguiente.
- `once`: se da de baja antes de invocar. `idle()` espera las publicaciones en vuelo.
- Historial: `DomainEvent` y `EventDelivery` (observador, estado OK/FAILED, intentos, error). Un fallo al escribir el historial se loguea y no afecta la entrega.

## Notificaciones
Una notificación por cada `ScheduleChange` (ADDED/UPDATED/CANCELLED), con texto en español que describe qué cambió (aula/bloque/piso/hora/día/docente en UPDATED). El observador `notifications` las guarda y publica `NotificationCreated`. API propia (`/api/notifications`): solo ve las suyas (RRF-04).

## Ventana de envío (RRF-05)
Hora de Bogotá (`America/Bogota`), inclusiva 6:00, exclusiva 22:00 (configurable). Push SSE de `notification` y correo solo dentro; fuera, el correo queda pendiente (`emailedAt` nulo) y un job cada 5 min reintenta los de las últimas 48 h cuando la ventana abre. El evento `schedule-changed` (refresco de datos) no está sujeto a la ventana.

## Correo
`EmailPort.send({to, subject, text, html?})`. `EMAIL_MODE=console` (defecto) imprime destino y asunto. `EMAIL_MODE=brevo` usa la API v3 transaccional (`POST https://api.brevo.com/v3/smtp/email`, cabecera `api-key`). Reglas de seguridad: la clave solo en `backend/.env` (ignorado por git), nunca en logs ni respuestas de error; modo `brevo` exige `BREVO_API_KEY` y `MAIL_FROM_EMAIL`; fuera de producción exige además `EMAIL_REDIRECT_TO` (todos los correos van ahí y el asunto lleva `[DEV → destinatario original]`) para no escribir a usuarios de prueba (`@horariouni.test`). Ningún correo real sin confirmación del usuario.

## Tiempo real (SSE)
`GET /api/events/stream` (autenticado con la cabecera `Authorization`; el cliente usa `fetch` en streaming, no `EventSource`, para no poner el token en la URL). Latido `: ping` cada 25 s. Eventos enviados: `notification` (datos de la notificación) y `schedule-changed`. `SseHub` mantiene conexiones por usuario en memoria del proceso (limitación documentada: con varias réplicas el aviso solo llega a los conectados a la réplica que lo generó).

## Datos (UUID)
`DomainEvent(id, type, payload Json, occurredAt)`, `EventDelivery(id, eventId→DomainEvent, observer, status, attempts, error?, deliveredAt)`, `Notification(id, userId→User, kind, title, message, createdAt, readAt?, emailedAt?)`, `SyncRun.stats Json?` = `{added, updated, cancelled}`.

## API nueva
`GET /api/notifications?unread=1&limit=` → `{items, unread}`; `POST /api/notifications/:id/read` (404 si no es suya); `POST /api/notifications/read-all`; `GET /api/events/stream`; `GET /api/admin/events?limit=` (admin) → eventos con entregas.

## Frontend
`RealtimeClient` (`subscribe(type, handler) → unsubscribe`, `start/stop`, reconexión con espera 1 s→30 s, 401 detiene), `RealtimeProvider` (activo solo con sesión), `useRealtime`. `NotificationBell` en el encabezado (solo estudiantes): contador de no leídas, panel accesible (`aria-expanded`, Escape, foco), marcar leída/todas. `ToastProvider` con región `role="status"`. `SchedulePage` recarga al recibir `schedule-changed`. `AdminPage`: tarjetas de corridas muestran estadísticas (+agregadas ~modificadas −canceladas) y sección "Eventos recientes" con chips por observador.

## No funcionales
Cobertura ≥70 % (mismas exclusiones que antes más los adaptadores Prisma nuevos); nada de red real en tests; un fallo de un observador nunca rompe la sincronización; todo texto en español; WCAG AA.
