# módulo notifications — avisos en la app, correo y programados

Requisitos: RF-NOT-01..04 · RRF-05. Prefijo: `/api/notifications`.

| Capa | Archivos | Patrón y por qué |
|---|---|---|
| [`application/NotificationObserver.ts`](application/NotificationObserver.ts) | reacciona a `ScheduleChanged` → crea `Notification` → publica `NotificationCreated` | **Observer** (RF-NOT-03). La carga inicial es silenciosa. |
| [`application/EmailObserver.ts`](application/EmailObserver.ts) | reacciona a `NotificationCreated` → correo | **Observer** + **Idempotent Consumer** (`claimEmail` atómico: sin correos duplicados). Respeta ventana horaria y canal. |
| [`domain/channelPolicy.ts`](domain/channelPolicy.ts) | `IN_APP` / `EMAIL` / `BOTH` → qué medios se usan | **Strategy** (RF-NOT-04). |
| [`domain/reminders.ts`](domain/reminders.ts) | `planClassReminders`, `localClock` | Reglas puras (RF-NOT-02): clases de hoy que empiezan dentro de la antelación; la clave `usuario+clase+fecha` evita duplicados. |
| [`domain/messages.ts`](domain/messages.ts) | `describeChange` | Texto de cada cambio (puro). |
| [`application/ScheduledNotifications.ts`](application/ScheduledNotifications.ts) | `CreateCustomNotification`, `planReminders`, `dispatchDue` | Use Cases / servicios invocados por HTTP y por el job. `dispatchDue` convierte lo programado en `NotificationCreated`: desde ahí **el Observer** hace la entrega. |
| [`application/flushPendingEmails.ts`](application/flushPendingEmails.ts) | job de pendientes | Reintenta correos que quedaron fuera de ventana. |
| [`application/ports.ts`](application/ports.ts) | `NotificationRepository`, `ScheduledNotificationRepository`, `EmailPort` | Ports + Repository. |
| [`infrastructure/`](infrastructure/) | `BrevoEmailAdapter`, `ConsoleEmailAdapter`, `buildEmailAdapter`, `Prisma*Repository` | **Adapter** (correo), **Factory** (`buildEmailAdapter` elige consola/Brevo según `EMAIL_MODE`), **Repository**. |
| [`http/notificationRoutes.ts`](http/notificationRoutes.ts) | lista, leer, programadas, preferencias | Adaptador de entrada. |

**RRF-05:** ningún push ni correo sale fuera de 6:00–22:00 (zona `America/Bogota`). Lo decide `shared/window.ts`; lo aplican los observadores. Los correos que quedan pendientes los recoge el job.
Los correos de OTP son **transaccionales** (los pide el usuario en ese momento) y no pasan por esta ventana.
