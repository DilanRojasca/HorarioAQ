# Eventos de dominio y Observer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el Observer mínimo del proyecto en un subsistema de eventos completo (bus tipado con historial, observadores de auditoría/notificaciones/estadísticas/tiempo real/correo) con campana y avisos en vivo en el frontend.

**Architecture:** `EventBus` tipado (Subject) en `shared/events`; observadores en sus módulos, registrados en `wire()`; adaptadores tras puertos (`EmailPort`, `EventLog`, `NotificationRepository`); `SseHub` para tiempo real; frontend con `RealtimeClient` (Observer en el navegador).

**Tech Stack:** igual que el proyecto (Node 20+/TS, Express 4, Prisma 5, Vitest, React 18 + Tailwind v3). Sin dependencias nuevas salvo que una tarea lo justifique y lo documente.

**Spec:** `docs/superpowers/specs/2026-10-09-eventos-observer-design.md`

## Global Constraints

- Rama `feature/events-observer`. Commits SIN línea `Co-Authored-By` y sin mencionar a Claude/IA (pedido del usuario). No añadir nada de `.superpowers/` al repo; nunca commitear `.env`.
- Todos los IDs nuevos son UUID (`@default(uuid()) @db.Uuid`, FKs `@db.Uuid`). Migraciones con `npx prisma migrate dev --name <n>` contra la base local (`horario`).
- Texto de usuario y mensajes en español. Accesibilidad WCAG 2.1 AA en el frontend (≥44px, foco visible, `role=status`/`alert` correctos, contraste con los tokens del proyecto).
- Ningún test usa red real ni correo real. `EMAIL_MODE` por defecto `console`. La clave de Brevo nunca se escribe en código, tests, logs ni mensajes de error.
- Un observador que falla nunca debe romper `SyncScheduleUseCase` ni otros observadores.
- Ventana de envío (push y correo): 6:00 ≤ hora < 22:00 en `America/Bogota` (RRF-05).
- Un estudiante solo ve y modifica sus propias notificaciones (RRF-04); `/api/admin/*` solo ADMIN.
- Las IDs de ejemplo en tests en memoria pueden ser cortas, pero cualquier ruta HTTP que reciba un id valida UUID con zod (400 si no lo es).
- Cobertura backend ≥ 70 % (`npm run test:cov`); no bajar la cobertura actual de forma notable.
- Código siguiendo el estilo del proyecto (hexagonal: `application` depende de puertos, no de Prisma/Express). Íconos del frontend: nombres literales dentro de `<span className="material-symbols-outlined">`, y añadir cada ícono nuevo a `frontend/src/assets/fonts/icons.txt` regenerando el subset (`scripts/subset-icons.sh`).

## File Structure

```
backend/
  prisma/schema.prisma                         (+DomainEvent, EventDelivery, Notification, SyncRun.stats)
  src/shared/events/
    types.ts            EventMap, DomainEvent, Observer, SubscribeOptions, Subscription, DeliveryReport, EventLog, EventLogEntry
    EventBus.ts         EventBus (reemplaza shared/eventBus.ts)
    InMemoryEventLog.ts / PrismaEventLog.ts
  src/shared/ports.ts   (se quitan EventBus/DomainEvent antiguos)
  src/shared/window.ts  isWithinSendWindow
  src/modules/audit/auditObserver.ts            (reemplaza auditListener.ts)
  src/modules/schedule/observers/syncStatsObserver.ts
  src/modules/notifications/
    domain/messages.ts                 describeChange
    application/ports.ts               NotificationRepository, EmailPort
    application/NotificationObserver.ts
    application/EmailObserver.ts
    application/flushPendingEmails.ts
    infrastructure/PrismaNotificationRepository.ts, ConsoleEmailAdapter.ts, BrevoEmailAdapter.ts, buildEmailAdapter.ts
    http/notificationRoutes.ts
  src/modules/realtime/SseHub.ts, RealtimeObserver.ts, http/eventsRoutes.ts
  src/modules/schedule/http/adminRoutes.ts      (+GET /events)
  src/jobs/notificationFlushJob.ts
frontend/src/
  shared/realtime.ts (RealtimeClient), shared/RealtimeProvider.tsx
  features/notifications/{api.ts,useNotifications.ts,NotificationBell.tsx,ToastProvider.tsx}
  features/admin/{EventsPanel.tsx, runs.ts (+stats)}
  features/schedule/useSchedule.ts (+refetch), SchedulePage.tsx, shared/Layout.tsx
```

---

### Task 1: Bus de eventos tipado con historial (núcleo del Observer)

**Files:**
- Create: `backend/src/shared/events/{types,EventBus,InMemoryEventLog,PrismaEventLog}.ts`, `backend/tests/shared/events/EventBus.test.ts`
- Modify: `backend/prisma/schema.prisma` (+`DomainEvent`, `EventDelivery`), `backend/src/shared/ports.ts` (quitar `DomainEvent`/`EventBus` antiguos), `backend/src/modules/audit/auditListener.ts` → renombrar a `auditObserver.ts` con `registerAuditObserver(bus, audit)`, `backend/src/modules/schedule/application/SyncSchedule.ts` (publicar tipado), `backend/src/main.ts`, `backend/src/shared/container.ts`, `backend/prisma/seed.ts`, tests existentes que usan el bus (`tests/audit/auditListener.test.ts`, `tests/http/api.test.ts`, `tests/schedule/application/SyncSchedule.test.ts`); borrar `backend/src/shared/eventBus.ts` y `backend/tests/shared/eventBus.test.ts` (sustituidos).

**Interfaces:**
- Produces (`shared/events/types.ts`):
```ts
import type { ScheduleChange } from '../../modules/schedule/domain/types';
export type NotificationKind = 'SCHEDULE_ADDED' | 'SCHEDULE_UPDATED' | 'SCHEDULE_CANCELLED';
export interface EventMap {
  ScheduleChanged: { userId: string; semester: string; changes: ScheduleChange[] };
  SyncCompleted: { runId: string; trigger: 'MANUAL' | 'CRON'; studentsSynced: number; changesCount: number; failures: number; changesByType: { ADDED: number; UPDATED: number; CANCELLED: number } };
  SyncFailed: { runId: string; trigger: 'MANUAL' | 'CRON'; message: string };
  NotificationCreated: { notificationId: string; userId: string; title: string; message: string; kind: NotificationKind };
}
export type EventType = keyof EventMap;
export interface DomainEvent<T extends EventType = EventType> { id: string; type: T; occurredAt: Date; payload: EventMap[T] }
export type Observer<T extends EventType> = (event: DomainEvent<T>) => void | Promise<void>;
export interface SubscribeOptions { name: string; priority?: number; once?: boolean; retries?: number; backoffMs?: number }
export interface Subscription { unsubscribe(): void }
export interface DeliveryRecord { observer: string; status: 'OK' | 'FAILED'; attempts: number; error?: string }
export interface DeliveryReport { eventId: string; deliveries: DeliveryRecord[] }
export interface EventLogEntry { id: string; type: string; payload: unknown; occurredAt: Date; deliveries: Array<DeliveryRecord & { deliveredAt: Date }> }
export interface EventLog {
  recordEvent(e: DomainEvent): Promise<void>;
  recordDelivery(eventId: string, d: DeliveryRecord): Promise<void>;
  listRecent(limit: number): Promise<EventLogEntry[]>;
}
```
- Produces (`EventBus.ts`): `class EventBus { constructor(opts?: { log?: EventLog; sleep?: (ms: number) => Promise<void>; now?: () => Date; newId?: () => string }); subscribe<T extends EventType>(type: T, observer: Observer<T>, options: SubscribeOptions): Subscription; publish<T extends EventType>(type: T, payload: EventMap[T]): Promise<DeliveryReport>; idle(): Promise<void>; subscriberCount(type: EventType): number }`. Valores por defecto: `priority=0`, `once=false`, `retries=2`, `backoffMs=1000`.
- `InMemoryEventLog implements EventLog` (para tests, guarda arrays). `PrismaEventLog implements EventLog` (`recordEvent` crea `DomainEvent`; `recordDelivery` crea `EventDelivery`; `listRecent` ordena por `occurredAt desc` incluyendo `deliveries`).
- Prisma: `model DomainEvent { id String @id @default(uuid()) @db.Uuid; type String; payload Json; occurredAt DateTime @default(now()); deliveries EventDelivery[]; @@index([occurredAt]) }` y `model EventDelivery { id String @id @default(uuid()) @db.Uuid; eventId String @db.Uuid; observer String; status String; attempts Int; error String?; deliveredAt DateTime @default(now()); event DomainEvent @relation(fields: [eventId], references: [id], onDelete: Cascade); @@index([eventId]) }`.
- `registerAuditObserver(bus: EventBus, audit: AuditPort): Subscription[]` — suscribe `ScheduleChanged` con `{ name: 'audit', priority: 100 }` y registra `SCHEDULE_CHANGED` como lo hacía `registerAuditListener` (misma `detail`), SIN `console.log` ruidoso (usar un logger inyectable opcional `log = console.log` o eliminar el log).
- `SyncScheduleUseCase` publica `bus.publish('ScheduleChanged', { userId, semester, changes })` sin esperar (no `await`, pero sin dejar promesas sin manejar: `publish` nunca rechaza). El tipo de la dependencia `bus` pasa a ser `EventBus` (clase).
- `wire()` en `main.ts` crea `new EventBus({ log: new PrismaEventLog() })`, registra el observador de auditoría y devuelve `{ ...container, bus }`; el seed espera `bus.idle()` antes de `$disconnect` (sustituye el `idle()` anterior).

- [ ] **Step 1: Escribir los tests del bus (fallan primero)** en `backend/tests/shared/events/EventBus.test.ts`, usando `sleep` inyectado (`vi.fn(async () => {})`) y `InMemoryEventLog`. Casos obligatorios (nombres exactos de intención):
  1. entrega el evento a los observadores del tipo y no a otros tipos;
  2. el `DomainEvent` entregado trae `id` (UUID), `type`, `occurredAt` y `payload`;
  3. orden por prioridad desc, y a igual prioridad por orden de suscripción;
  4. `unsubscribe()` evita entregas posteriores; `subscriberCount` refleja altas/bajas;
  5. `once` entrega una sola vez (también si se publican dos eventos seguidos);
  6. aislamiento: un observador que lanza no impide que los siguientes reciban el evento, y `publish` no rechaza;
  7. reintentos: con `retries: 2` un observador que falla 2 veces y luego funciona termina `OK` con `attempts: 3`, y `sleep` se llamó con 1000 y 2000 (backoff exponencial, `backoffMs` configurable);
  8. agotados los reintentos queda `FAILED` con `attempts: retries+1` y el `error` es el mensaje de la excepción;
  9. el reporte devuelto por `publish` lista cada observador con estado y intentos, en orden de ejecución;
  10. el historial recibe el evento y cada entrega (`InMemoryEventLog`), y si `recordEvent`/`recordDelivery` lanzan, `publish` igual resuelve y los observadores corrieron;
  11. un observador que publica otro evento dentro de su ejecución funciona (re-entrada) y `idle()` espera a ambos;
  12. `idle()` resuelve inmediatamente cuando no hay publicaciones en vuelo.
  Ejecutar: `cd backend && npx vitest run tests/shared/events` → FAIL (módulo no existe).
- [ ] **Step 2: Implementar `types.ts`, `EventBus.ts`, `InMemoryEventLog.ts`** hasta que pasen.
- [ ] **Step 3: Schema Prisma + migración + `PrismaEventLog`** (`npx prisma migrate dev --name event_log`). Verificar con un script desechable (fuera del repo, en el scratchpad) que `recordEvent`+`recordDelivery`+`listRecent` funcionan contra la base local y luego borrar las filas creadas.
- [ ] **Step 4: Migrar usos existentes**: `ports.ts`, auditoría → `auditObserver.ts` (+ test actualizado en `tests/audit/auditObserver.test.ts`, borrando el viejo), `SyncSchedule.ts`, `container.ts` (`Ports.bus: EventBus`), `main.ts`, `seed.ts`, y los tests existentes (`SyncSchedule.test.ts`, `api.test.ts`): sustituir `InMemoryEventBus` por `EventBus` (con `sleep` inyectado donde haga falta) y ajustar las aserciones al evento tipado (`event.payload.userId`, etc.). Borrar `shared/eventBus.ts` y su test.
- [ ] **Step 5: Verificar** `cd backend && npx vitest run && npx tsc -p . --noEmit && npm run test:cov` (umbral OK). Commit: `feat(events): typed event bus with priorities, retries, once and persistent history`.

---

### Task 2: Eventos de sincronización y observador de estadísticas

**Files:**
- Create: `backend/src/modules/schedule/observers/syncStatsObserver.ts`, `backend/tests/schedule/observers/syncStatsObserver.test.ts`, `backend/tests/http/events.test.ts`
- Modify: `backend/prisma/schema.prisma` (`SyncRun.stats Json?`), `backend/src/modules/schedule/application/{ports.ts,SyncSchedule.ts}`, `backend/src/modules/schedule/infrastructure/PrismaSyncRunRepository.ts`, `backend/tests/helpers/inMemory.ts` (`InMemorySyncRuns`), `backend/src/modules/schedule/http/adminRoutes.ts`, `backend/src/shared/container.ts`, `backend/src/main.ts`, tests de SyncSchedule.

**Interfaces:**
- Consumes: Task 1 (`EventBus`, `EventLog`, `EventLogEntry`).
- Produces:
  - `SyncRunRecord` gana `stats: { added: number; updated: number; cancelled: number } | null`; `SyncRunRepository` gana `saveStats(id: string, stats: { added: number; updated: number; cancelled: number }): Promise<void>`.
  - `SyncScheduleUseCase` calcula `changesByType` (suma por `ADDED|UPDATED|CANCELLED` de los `changes` aplicados) y, tras `syncRuns.finish(...)` exitoso (estados OK y PARTIAL), publica `SyncCompleted` con el payload de `EventMap`; si la corrida termina `FAILED` publica `SyncFailed { runId, trigger, message }` antes de relanzar el error. Ambas publicaciones sin `await` bloqueante (no deben retrasar ni romper la respuesta).
  - `registerSyncStatsObserver(bus: EventBus, syncRuns: SyncRunRepository): Subscription[]` — suscribe `SyncCompleted` con `{ name: 'sync-stats', priority: 40 }` y llama `syncRuns.saveStats(runId, { added: ADDED, updated: UPDATED, cancelled: CANCELLED })`.
  - `GET /api/admin/events?limit=` (solo ADMIN; `limit` entero 1–100, defecto 20, 400 si inválido) → `EventLogEntry[]` (serializa `occurredAt` ISO). El `Container` expone `eventLog` para la ruta.
  - `Ports` gana `eventLog: EventLog`; en tests HTTP se usa `InMemoryEventLog`.

- [ ] **Step 1: Tests (fallan primero)**: (a) `SyncSchedule`: tras una sincronización con cambios publica `SyncCompleted` con `changesByType` correcto y `failures`; una corrida FAILED publica `SyncFailed` con el mensaje; ninguna publicación bloquea (un observador lento/que falla no cambia el resultado); (b) `syncStatsObserver`: al recibir `SyncCompleted` guarda `{added, updated, cancelled}` en `InMemorySyncRuns`; si `saveStats` lanza, el bus lo reintenta y registra FAILED sin romper la sincronización; (c) HTTP: `GET /api/admin/events` devuelve eventos con sus entregas tras una sincronización (esperar `bus.idle()`), 403 para estudiante, 401 sin token, 400 con `limit=0` o `limit=abc`; el historial de una entrega fallida muestra `FAILED` y `attempts`.
- [ ] **Step 2: Implementar** (schema + migración `sync_stats`, repos Prisma/InMemory, caso de uso, observador, ruta, wiring).
- [ ] **Step 3: Verificar real** contra la base local: `npm run seed` ya cargó datos; arrancar el backend en un puerto libre (`PORT=4011`), iniciar sesión como admin y hacer `POST /api/admin/sync`; comprobar `GET /api/admin/events` y que `SyncRun.stats` quedó guardado (consulta SQL de solo lectura con el rol `horario`). Parar el servidor.
- [ ] **Step 4:** `npx vitest run && npx tsc -p . --noEmit && npm run test:cov`. Commit: `feat(events): sync completed/failed events and sync stats observer`.

---

### Task 3: Notificaciones en la app (observador, repositorio y API)

**Files:**
- Create: `backend/src/shared/window.ts`, `backend/src/modules/notifications/domain/messages.ts`, `backend/src/modules/notifications/application/{ports.ts,NotificationObserver.ts}`, `backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts`, `backend/src/modules/notifications/http/notificationRoutes.ts`, tests: `backend/tests/shared/window.test.ts`, `backend/tests/notifications/{messages,NotificationObserver,notificationRoutes}.test.ts`
- Modify: `backend/prisma/schema.prisma` (`Notification`, relación en `User`), `backend/src/shared/{container.ts,config.ts,http/app.ts}`, `backend/src/main.ts`, `backend/tests/helpers/inMemory.ts` (`InMemoryNotifications`).

**Interfaces:**
- Consumes: Task 1 (`EventBus`, tipos), `ScheduleChange`/`ClassSession` del dominio.
- Produces:
  - `config`: `notifyWindowStart: number` (6), `notifyWindowEnd: number` (22), `notifyTimezone: string` ('America/Bogota') leídos de `NOTIFY_WINDOW_START/END/TZ`.
  - `isWithinSendWindow(date: Date, opts?: { start?: number; end?: number; timeZone?: string }): boolean` — hora local de la zona con `Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone })`; `start ≤ hora < end`.
  - `describeChange(change: ScheduleChange): { kind: NotificationKind; title: string; message: string }` (puro). ADDED: título `Nueva clase: {courseName}`, mensaje `{courseName} los {día} de {HH:mm} a {HH:mm} en Bloque {b}, Aula {r}.`; CANCELLED: `Clase cancelada: {courseName}` / `La clase de {courseName} del {día} ({HH:mm}–{HH:mm}) fue cancelada.`; UPDATED: título `Cambio en {courseName}` y mensaje que lista solo lo que cambió, p. ej. `Aula: 201 → 305 · Bloque: A → B · Piso: 2 → 3 · Horario: 08:00–10:00 → 09:00–11:00 · Día: Lunes → Martes · Docente: X → Y` (cada parte solo si cambió; días en español Lunes…Domingo).
  - Prisma: `model Notification { id String @id @default(uuid()) @db.Uuid; userId String @db.Uuid; kind String; title String; message String; createdAt DateTime @default(now()); readAt DateTime?; emailedAt DateTime?; user User @relation(fields: [userId], references: [id], onDelete: Cascade); @@index([userId, createdAt]) }`.
  - Dominio/puerto: `export interface NotificationRecord { id: string; userId: string; kind: NotificationKind; title: string; message: string; createdAt: Date; readAt: Date | null; emailedAt: Date | null }`; `NotificationRepository { create(n: { userId: string; kind: NotificationKind; title: string; message: string }): Promise<NotificationRecord>; listByUser(userId: string, opts: { unreadOnly?: boolean; limit: number }): Promise<NotificationRecord[]>; countUnread(userId: string): Promise<number>; markRead(userId: string, id: string): Promise<boolean>; markAllRead(userId: string): Promise<number>; findById(id: string): Promise<NotificationRecord | null>; markEmailed(id: string, at: Date): Promise<void>; listPendingEmail(since: Date, limit: number): Promise<NotificationRecord[]> }` (`markRead` devuelve `false` si no existe o no es del usuario).
  - `registerNotificationObserver(bus: EventBus, repo: NotificationRepository): Subscription[]` — suscribe `ScheduleChanged` con `{ name: 'notifications', priority: 50 }`: por cada `change` crea una notificación con `describeChange` y publica `NotificationCreated` (con `await bus.publish(...)` dentro del observador para que `bus.idle()` lo cubra y los errores no se pierdan; `publish` nunca rechaza).
  - HTTP (`authenticate` en todas): `GET /api/notifications?unread=1&limit=` (`limit` 1–100, defecto 30) → `{ items: NotificationRecord[], unread: number }`; `POST /api/notifications/:id/read` (`:id` UUID; 204; 404 si no es del usuario); `POST /api/notifications/read-all` → `{ updated: number }`. Montado en `app.ts` bajo `/api/notifications`. Ninguna ruta permite crear notificaciones por HTTP.

- [ ] **Step 1: Tests (fallan primero)**: `window.test.ts` (5:59 fuera, 6:00 dentro, 21:59 dentro, 22:00 fuera en Bogotá; un instante UTC que en Bogotá es 05:30 → fuera; configurable); `messages.test.ts` (los tres tipos, UPDATED con un solo campo cambiado, con varios, sin cambios relevantes → mensaje genérico `Se actualizó la clase.`); `NotificationObserver.test.ts` (una notificación por cambio, orden, publica `NotificationCreated` por cada una con los datos correctos, un fallo del repositorio en un cambio queda registrado FAILED tras reintentos sin lanzar); `notificationRoutes.test.ts` con `createApp` y el contenedor en memoria (lista solo las propias; `unread=1` filtra; `limit` inválido → 400; `read` marca; `read` de otra persona → 404; id no UUID → 400; `read-all` solo toca las propias; 401 sin token; un estudiante no ve notificaciones de otro aunque conozca el id).
- [ ] **Step 2: Implementar** (schema + migración `notifications`, repos Prisma/InMemory, observador, rutas, config, wiring: registrar el observador en `wire()` y exponer el repo en el `Container`).
- [ ] **Step 3: Verificar real**: backend en puerto libre; como admin `POST /api/admin/sync` dos veces (la 2.ª genera cambios si el estado lo permite; si no, ver nota); como `dilan@horariouni.test` `GET /api/notifications` → items con textos correctos y `unread`. Si la base no produce cambios nuevos, restablecer con el procedimiento documentado en README (borrar `ClassSession`/`ScheduleChange`/`SyncRun` de la base local de desarrollo y volver a correr `npm run seed`) — SOLO datos de desarrollo creados por este proyecto. Parar el servidor.
- [ ] **Step 4:** `npx vitest run && npx tsc -p . --noEmit && npm run test:cov`. Commit: `feat(notifications): in-app notifications observer, repository and API`.

---

### Task 4: Correo — puerto, adaptadores consola/Brevo, observador y job de pendientes

**Files:**
- Create: `backend/src/modules/notifications/application/{EmailObserver.ts,flushPendingEmails.ts}`, `backend/src/modules/notifications/infrastructure/{ConsoleEmailAdapter,BrevoEmailAdapter,buildEmailAdapter}.ts`, `backend/src/shared/safeEmailConfig.ts`, `backend/src/jobs/notificationFlushJob.ts`, tests `backend/tests/notifications/{ConsoleEmailAdapter,BrevoEmailAdapter,buildEmailAdapter,EmailObserver,flushPendingEmails}.test.ts`, `backend/tests/shared/safeEmailConfig.test.ts`
- Modify: `backend/src/modules/notifications/application/ports.ts` (+`EmailPort`), `backend/src/shared/{config.ts,container.ts}`, `backend/src/main.ts`, `backend/.env.example`, `backend/tests/helpers/inMemory.ts` (`RecordingEmail`).

**Interfaces:**
- Consumes: Task 3 (`NotificationRepository`, `isWithinSendWindow`, config de ventana), `UserRepository` (existente: `findById`).
- Produces:
  - `config`: `emailMode: 'console' | 'brevo'` (`EMAIL_MODE`, defecto `console`; cualquier otro valor → error al arrancar), `brevoApiKey: string | undefined` (`BREVO_API_KEY`), `mailFromEmail?`, `mailFromName` (defecto `Horario UNI`), `emailRedirectTo?`, `notifyFlushCron` (`NOTIFY_FLUSH_CRON`, defecto `*/5 * * * *`).
  - `EmailPort { send(msg: { to: string; subject: string; text: string; html?: string }): Promise<void> }`.
  - `ConsoleEmailAdapter(log = console.log)`: imprime `[email:console] para=<to> asunto=<subject>` (NO imprime el cuerpo completo; como máximo los primeros 120 caracteres).
  - `BrevoEmailAdapter({ apiKey, from: { email: string; name: string }, redirectTo?: string, fetchFn?: typeof fetch })`: `POST https://api.brevo.com/v3/smtp/email` con cabeceras `api-key`, `content-type: application/json`, `accept: application/json` y cuerpo `{ sender: { email, name }, to: [{ email }], subject, textContent, htmlContent? }`. Con `redirectTo`, el destinatario real pasa a `redirectTo` y el asunto se antepone con `[DEV → {to original}] `. Respuesta no 2xx → lanza `Error('Brevo respondió {status}')` SIN incluir la clave ni las cabeceras (puede incluir el `message` que devuelva Brevo, truncado a 200 caracteres).
  - `buildEmailAdapter(cfg): EmailPort` — `console` → `ConsoleEmailAdapter`; `brevo` → `BrevoEmailAdapter` (exige `brevoApiKey` y `mailFromEmail`, si faltan lanza error en español).
  - `assertSafeEmailConfig(cfg, env: string)` en `shared/safeEmailConfig.ts` (se llama al arrancar en `main.ts`, también en desarrollo): modo `brevo` sin `BREVO_API_KEY` o sin `MAIL_FROM_EMAIL` → lanza; modo `brevo` fuera de producción sin `EMAIL_REDIRECT_TO` → lanza (mensaje: evita escribir a usuarios de prueba); modo `console` → no hace nada.
  - `registerEmailObserver(deps: { bus: EventBus; notifications: NotificationRepository; users: UserRepository; email: EmailPort; now?: () => Date; window?: { start: number; end: number; timeZone: string } }): Subscription[]` — suscribe `NotificationCreated` con `{ name: 'email', priority: 10, retries: 3 }`: si fuera de la ventana → no envía (queda pendiente, sin error); si la notificación ya tiene `emailedAt` → no hace nada (idempotente); busca el usuario (si no existe o está inactivo → no envía, sin error); `email.send({ to: user.email, subject: title, text: message })`; al éxito `markEmailed(id, now)`. Si `send` lanza, el error se propaga al bus (reintentos).
  - `flushPendingEmails(deps: { notifications: NotificationRepository; bus: EventBus; now?: () => Date; window?: {...}; sinceHours?: number }): Promise<number>` — si dentro de la ventana, busca `listPendingEmail(now − sinceHours (defecto 48), 100)` y re-publica `NotificationCreated` por cada una (el observador es idempotente); devuelve cuántas re-publicó; fuera de la ventana devuelve 0 sin consultar.
  - `startNotificationFlushJob(deps, cron)` con `node-cron` (valida la expresión, captura errores; no arrancar en tests).
  - `.env.example`: añadir `EMAIL_MODE=console`, `BREVO_API_KEY=`, `MAIL_FROM_EMAIL=`, `MAIL_FROM_NAME=Horario UNI`, `EMAIL_REDIRECT_TO=`, `NOTIFY_FLUSH_CRON=*/5 * * * *`, `NOTIFY_WINDOW_START=6`, `NOTIFY_WINDOW_END=22`, `NOTIFY_TZ=America/Bogota` (todos vacíos/seguros; NUNCA una clave real).

- [ ] **Step 1: Tests (fallan primero)**: `BrevoEmailAdapter` con `fetchFn` simulado (URL, método y cabeceras exactas; cuerpo con sender/to/subject/textContent; redirección cambia `to` y antepone el asunto; respuesta 401/400/500 lanza sin filtrar la clave — comprobar que `String(error)` no contiene la clave de prueba; 2xx resuelve); `ConsoleEmailAdapter` (no imprime el cuerpo largo); `buildEmailAdapter` (console por defecto, brevo sin clave lanza); `safeEmailConfig` (todos los casos de arriba); `EmailObserver` con `RecordingEmail` (envía dentro de ventana y marca `emailedAt`, no envía fuera de ventana, idempotente, usuario inexistente/inactivo, fallo de `send` → reintentos del bus y estado FAILED con intentos, no marca enviado); `flushPendingEmails` (dentro de ventana re-publica pendientes y respeta `sinceHours`, fuera de ventana devuelve 0).
- [ ] **Step 2: Implementar**; cablear en `wire()` (adaptador por `config.emailMode`; `assertSafeEmailConfig` al arrancar; job de pendientes arrancado en `main` junto al de sincronización).
- [ ] **Step 3: Verificar** en modo consola: backend en puerto libre, sincronizar como admin, comprobar en el log del backend las líneas `[email:console] ...` para los usuarios afectados (destino = su correo `@horariouni.test`) y que `Notification.emailedAt` quedó marcado (consulta de solo lectura); verificar también que con `EMAIL_MODE=brevo` sin variables el arranque falla con el mensaje en español (probar en seco, sin red). NO enviar ningún correo real. Parar el servidor.
- [ ] **Step 4:** `npx vitest run && npx tsc -p . --noEmit && npm run test:cov`. Commit: `feat(notifications): email port with console and Brevo adapters, email observer and pending flush job`.

---

### Task 5: Tiempo real por SSE (SseHub, observador y ruta)

**Files:**
- Create: `backend/src/modules/realtime/{SseHub.ts,RealtimeObserver.ts}`, `backend/src/modules/realtime/http/eventsRoutes.ts`, tests `backend/tests/realtime/{SseHub,RealtimeObserver,eventsRoutes}.test.ts`
- Modify: `backend/src/shared/{container.ts,config.ts,http/app.ts}`, `backend/src/main.ts`.

**Interfaces:**
- Consumes: Task 1 (`EventBus`), Task 3 (`isWithinSendWindow`, config de ventana), `authenticate` existente.
- Produces:
  - `config.sseHeartbeatMs` (`SSE_HEARTBEAT_MS`, defecto 25000).
  - `SseHub`: `constructor(opts?: { heartbeatMs?: number })`; `connect(userId: string, res: SseWritable): () => void` (escribe el preámbulo y registra la conexión; devuelve la función de desconexión) donde `SseWritable = { write(chunk: string): boolean; end(): void; on(event: 'close', cb: () => void): unknown }`; `sendToUser(userId: string, event: string, data: unknown): number` (devuelve a cuántas conexiones escribió; formato `event: <nombre>\ndata: <json>\n\n`); `connectionCount(userId?: string): number`; `closeAll(): void`. Latido: `: ping\n\n` cada `heartbeatMs` a todas las conexiones, con `setInterval(...).unref()` iniciado al primer `connect` y detenido cuando no quedan conexiones. Al `close` de la respuesta se elimina la conexión.
  - `registerRealtimeObserver(bus: EventBus, hub: SseHub, deps?: { now?: () => Date; window?: {...} }): Subscription[]` — (1) `ScheduleChanged` `{ name: 'realtime-schedule', priority: 30 }` → `hub.sendToUser(userId, 'schedule-changed', { semester, count: changes.length })` SIEMPRE (no sujeto a la ventana); (2) `NotificationCreated` `{ name: 'realtime-notification', priority: 30 }` → solo dentro de la ventana: `hub.sendToUser(userId, 'notification', { id: notificationId, title, message, kind })`.
  - `GET /api/events/stream`: `authenticate`; cabeceras `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`; `res.flushHeaders()`; primer mensaje `retry: 3000\n\n` y `event: ready\ndata: {}\n\n`; registra la conexión del usuario autenticado (`req.auth.sub`) y la desregistra en `req.on('close')`. El `Container` expone `hub`; `wire()` crea `new SseHub({ heartbeatMs: config.sseHeartbeatMs })` y registra el observador. En `main` al cerrar el proceso, `hub.closeAll()`.

- [ ] **Step 1: Tests (fallan primero)**: `SseHub` con un `SseWritable` falso (registra escrituras; el latido con `vi.useFakeTimers()`: se emite cada `heartbeatMs`, se detiene sin conexiones; desconectar quita la conexión; `sendToUser` solo llega a las del usuario y devuelve el conteo; JSON con saltos de línea queda en una sola línea `data:`; `closeAll` termina todas); `RealtimeObserver` (schedule-changed siempre, incluso a las 03:00 Bogotá; notification solo dentro de la ventana; sin conexiones no falla); `eventsRoutes` con `createApp` y supertest/HTTP real en un puerto efímero: 401 sin token; con token recibe cabeceras SSE y el mensaje `ready`; tras `bus.publish('NotificationCreated', ...)` (hora simulada dentro de ventana) el cliente recibe `event: notification`; el usuario B no recibe lo del usuario A (RRF-04); al cerrar el cliente la conexión se elimina del hub.
- [ ] **Step 2: Implementar** y cablear.
- [ ] **Step 3: Verificar real** con `curl -N` (con token del estudiante obtenido por login local) contra el backend en un puerto libre: recibir `ready`, y desde otra terminal (otro curl) disparar `POST /api/admin/sync` como admin y comprobar que llegan `schedule-changed` y `notification` (si la hora actual de Bogotá está fuera de 6–22, comprobar que solo llega `schedule-changed` y explicarlo en el informe). Parar procesos propios.
- [ ] **Step 4:** `npx vitest run && npx tsc -p . --noEmit && npm run test:cov`. Commit: `feat(realtime): SSE hub, realtime observer and event stream endpoint`.

---

### Task 6: Frontend — cliente de tiempo real, campana, avisos y panel de eventos

**Files:**
- Create: `frontend/src/shared/{realtime.ts,RealtimeProvider.tsx}`, `frontend/src/features/notifications/{api.ts,useNotifications.ts,NotificationBell.tsx,ToastProvider.tsx}`, `frontend/src/features/admin/EventsPanel.tsx`, tests junto a cada archivo (`realtime.test.ts`, `NotificationBell.test.tsx`, `ToastProvider.test.tsx`, `EventsPanel.test.tsx`, `useNotifications.test.tsx`)
- Modify: `frontend/src/shared/Layout.tsx` (campana solo si `user.role === 'STUDENT'`), `frontend/src/main.tsx`/`App.tsx` (providers), `frontend/src/features/schedule/{useSchedule.ts,SchedulePage.tsx}` (`refetch` + `useRealtime('schedule-changed', refetch)`), `frontend/src/features/admin/{AdminPage.tsx,runs.ts}` (estadísticas por corrida + panel de eventos), `frontend/src/assets/fonts/icons.txt` y el subset woff2 (íconos nuevos: `notifications`, `notifications_active`, `done_all`, `mark_email_read`, `bolt`, `circle` si se usa), `scripts/` si hace falta.

**Interfaces:**
- Consumes: API de Tasks 2, 3 y 5; `api.ts`/`getToken` existentes; `useAuth`.
- Produces:
  - `RealtimeClient`: `constructor(opts: { url?: string; getToken: () => string | null; fetchFn?: typeof fetch; backoff?: { initialMs?: number; maxMs?: number }; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> })`; `subscribe(type: string, handler: (data: unknown) => void): () => void`; `start(): void`; `stop(): void`; `status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'stopped'` (+ `onStatus(cb)` opcional). Usa `fetch(url, { headers: { Authorization: 'Bearer …', Accept: 'text/event-stream' }, signal })` y lee `response.body.getReader()` parseando tramos SSE (`event:`/`data:` multilínea, comentarios `:` ignorados, `retry:` ignorado). Reconecta con espera 1 s → 2 s → … tope 30 s (se reinicia al abrir bien); **401 detiene** (`stopped`) sin reintentar; `stop()` aborta la petición; los manejadores que lanzan no afectan a los demás.
  - `RealtimeProvider` (inicia cuando hay sesión, detiene al cerrarla o al desmontar) y `useRealtime(type, handler)` (se suscribe/baja con el ciclo de vida; usa la última versión del handler).
  - `features/notifications/api.ts`: `listNotifications(opts)`, `markRead(id)`, `markAllRead()` sobre `api`.
  - `useNotifications()` → `{ items, unread, loading, error, markRead(id), markAllRead(), reload() }`; escucha `notification` en vivo (antepone sin duplicar por id, sube el contador) y muestra un toast con el título; al recibir `schedule-changed` no hace nada (lo maneja la página).
  - `NotificationBell`: botón 44×44 con ícono `notifications` y contador (`aria-label="Notificaciones, {n} sin leer"`), `aria-expanded`/`aria-controls`, panel (lista `role="list"`, título, mensaje, hora relativa `es-CO`, punto de no leída, botón "Marcar leída", botón "Marcar todas como leídas", estado vacío "No tienes notificaciones"); se cierra con Escape y clic fuera, devuelve el foco al botón; el contador se anuncia en una región `aria-live="polite"` siempre montada.
  - `ToastProvider`/`useToast()` → `toast({ title, message?, tone?: 'info'|'success'|'warning' })`; región `role="status" aria-live="polite"` siempre montada; auto-cierre a 6 s (cancelable al pasar el foco/ratón), botón cerrar de 44px, máximo 3 visibles; animaciones con `motion-safe:`.
  - Admin: `EventsPanel` ("Eventos recientes", `GET /admin/events?limit=20`): por evento tipo (etiquetas en español: `ScheduleChanged` → "Horario cambiado", `SyncCompleted` → "Sincronización completada", `SyncFailed` → "Sincronización fallida", `NotificationCreated` → "Notificación creada"), hora, y chips por observador (`audit`, `notifications`, `sync-stats`, `realtime-*`, `email`) con estado OK/Fallido e intentos; estados cargando/vacío/error; botón "Actualizar". Las tarjetas de corridas muestran las estadísticas `stats` (`+{added} ~{updated} −{cancelled}`) cuando existen (`runs.ts`: helper `statsLabel`).
  - `SchedulePage`: al recibir `schedule-changed`, recarga el horario (sin parpadeo de "Cargando…" si ya hay datos) y muestra un toast "Tu horario cambió".

- [ ] **Step 1: Tests (fallan primero)**: `RealtimeClient` con un `fetchFn` simulado que devuelve un `ReadableStream` controlado (tramos partidos en medio de líneas, `data:` multilínea, comentarios/latidos, dos manejadores donde uno lanza, `unsubscribe`, reconexión con `sleep` inyectado verificando 1000→2000→4000 y reinicio tras abrir, 401 detiene, `stop()` aborta, cabecera `Authorization` presente); `useNotifications` (carga inicial, evento en vivo antepone sin duplicar, markRead/markAllRead actualizan contador); `NotificationBell` (contador y `aria-label`, abrir/cerrar con clic/Escape/clic fuera, foco de vuelta, marcar leída, estado vacío); `ToastProvider` (aparece, auto-cierra con temporizadores simulados, máximo 3, cerrar manual); `EventsPanel` (lista con chips y estados, vacío, error, actualizar); `runs.ts` `statsLabel`; `SchedulePage` recarga y muestra toast al llegar `schedule-changed` (con un `RealtimeClient` falso inyectado por el provider).
- [ ] **Step 2: Implementar** (con las clases Tailwind/tokens del proyecto: mismo estilo que el resto; panel de la campana como `popover` anclado, a pantalla completa cómodo en móvil de 320 px; contraste AA). Regenerar el subset de íconos con los nombres nuevos.
- [ ] **Step 3: Verificar en el navegador real** (herramientas `mcp__Claude_Browser__*`; backend en puerto libre — el 4000 es de otro proyecto —, frontend con `VITE_API_TARGET`): con la sesión del estudiante abierta (login por UI con el usuario de prueba `dilan@horariouni.test`; la contraseña de desarrollo está en `backend/.env` como `SEED_PASSWORD`; si el entorno no te deja leerla, di que no pudiste verificar contra el backend real en vez de falsearlo), disparar una sincronización como admin desde otra pestaña/curl y comprobar: toast, campana con contador, calendario recargado. Revisar a 320 px y escritorio. Máx. 4 capturas, sin imágenes en la respuesta. Detener solo tus procesos.
- [ ] **Step 4:** `cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run build`. Commit: `feat(frontend): realtime client, notification bell, toasts and admin events panel`.

---

### Task 7: Documentación, cobertura y verificación de extremo a extremo

**Files:**
- Modify: `README.md` (sección "Eventos y Observer"), `backend/.env.example` (revisar), `docs/superpowers/specs/2026-10-09-eventos-observer-design.md` (solo si algo cambió respecto al diseño; anotar desviaciones).

- [ ] **Step 1:** README: diagrama simple (texto) Sujeto → Observadores con prioridades; tabla de eventos; tabla de observadores (nombre, prioridad, qué hace, archivo); ventana horaria; correo (modos, variables, reglas de seguridad, cómo activar Brevo de forma segura: remitente verificado + `EMAIL_REDIRECT_TO`); tiempo real (cabeceras, límite de réplicas); cómo restablecer los datos de demo en desarrollo; actualizar la tabla de patrones (Observer con los archivos nuevos) y los conteos de pruebas/cobertura reales.
- [ ] **Step 2:** `cd backend && npm run test:cov` y `cd frontend && npx vitest run` — reportar números; si la cobertura bajó del umbral, añadir pruebas.
- [ ] **Step 3: E2E real**: reiniciar la base de demo de desarrollo si hace falta; backend + frontend en puertos libres; flujo completo en el navegador (estudiante conectado → admin sincroniza → toast + campana + calendario; panel de eventos del admin con entregas OK; log `[email:console]`). Comprobar que con una entrega que falla a propósito (p. ej. observador de prueba que lanza, solo en script desechable) el historial muestra `FAILED` e intentos. Sin correos reales. Parar procesos.
- [ ] **Step 4:** Commit: `docs: events and observer documentation`.

---

## Self-Review (spec coverage)

- Bus tipado con prioridad/once/unsubscribe/aislamiento/reintentos/historial → Task 1. Eventos de sincronización + estadísticas + endpoint de eventos → Task 2. Notificaciones + ventana + API → Task 3. Correo (consola/Brevo, seguridad, pendientes) → Task 4. SSE → Task 5. Frontend (cliente, campana, toasts, refresco, panel admin) → Task 6. Docs/E2E → Task 7.
- Tipos y nombres consistentes entre tareas: `EventBus.publish(type, payload)`, `registerXObserver(...)`, `NotificationRepository`, `SseHub.sendToUser`, `isWithinSendWindow`.
- Brevo real: solo adaptador y pruebas con `fetch` simulado; activación real queda fuera hasta recibir remitente verificado y correo de pruebas del usuario.
