# Horario UNI — módulo Horario Académico

Módulo **Horario Académico** de Horario UNI (Universidad Católica Luis Amigó). Permite a un estudiante matriculado consultar su horario semanal, ver el detalle de cada clase, exportarlo (PDF / `.ics`) y enterarse de los cambios; un administrador puede lanzar la sincronización con el sistema institucional.

Stack: React 18 + Vite (frontend), Node 20 + Express + Prisma + PostgreSQL (backend).

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14+ **o** Docker (Docker Desktop / Engine con Compose v2)

## Arranque local (sin Docker)

1. Crear rol y base de datos (credenciales solo de desarrollo):

   ```sql
   CREATE ROLE horario LOGIN PASSWORD 'horario' CREATEDB;
   CREATE DATABASE horario OWNER horario;
   ```

2. Backend:

   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma migrate dev
   npm run seed
   npm run dev            # http://localhost:4000/api  (GET /api/health)
   ```

3. Frontend (otra terminal):

   ```bash
   cd frontend
   npm install
   npm run dev            # http://localhost:5173
   ```

   Si el puerto 5173 está ocupado, Vite elegirá otro; entonces ajuste `CORS_ORIGIN` en `backend/.env`.

   Íconos: la app usa una fuente Material Symbols reducida (`frontend/src/assets/fonts/material-symbols-subset.woff2`, ~6 KB). Al usar un ícono nuevo, añada su nombre a `frontend/src/assets/fonts/icons.txt` y ejecute `npm run icons` (requiere python3; regenera la fuente). Un test (`icons.test.ts`) falla si un ícono usado no está en la lista.

### Variables de entorno (`backend/.env`)

| Variable | Descripción | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (local: 5432; docker-compose publica el suyo en el **5433** del host) | `postgresql://horario:horario@localhost:5432/horario` |
| `JWT_SECRET` | Secreto de firma. En `NODE_ENV=production` el backend no arranca si tiene < 32 caracteres, es el valor de desarrollo o contiene `cambia-esto` | `dev-secret-change-me` (solo desarrollo) |
| `PORT` | Puerto del API | `4000` |
| `CORS_ORIGIN` | Origen permitido del frontend | `http://localhost:5173` |
| `ACTIVE_SEMESTER`, `SEMESTER_START`, `SEMESTER_WEEKS` | Semestre activo (y base del `.ics`) | `2026-2`, `2026-08-03`, `16` |
| `SYNC_CRON` | Cron de sincronización automática | `0 3 * * *` |
| `SYNC_CONCURRENCY` | Estudiantes sincronizados en paralelo | `5` |
| `TRUST_PROXY` | Nº de proxies de confianza (`trust proxy`); `1` en Docker (nginx) para que rate-limit y auditoría vean la IP real | `0` |
| `EMAIL_MODE`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `EMAIL_REDIRECT_TO` | Correo (`console` por defecto); ver «Eventos y patrón Observer». Nunca commitear claves | `console`, vacíos, `Horario UNI` |
| `NOTIFY_FLUSH_CRON`, `NOTIFY_WINDOW_START`, `NOTIFY_WINDOW_END`, `NOTIFY_WINDOW_TZ` | Job de correos pendientes y ventana de envío | `*/5 * * * *`, `6`, `22`, `America/Bogota` |
| `SSE_HEARTBEAT_MS` | Latido del flujo SSE (ms) | `25000` |
| `SEED_PASSWORD` | Contraseña de los usuarios **nuevos** del seed (no se modifica la de usuarios existentes). En `NODE_ENV=production` es obligatoria y no puede ser la pública `Cambiar123!` | `Cambiar123!` (solo desarrollo) |

## Docker

```bash
export JWT_SECRET=$(openssl rand -hex 32)      # obligatorio: el compose no trae valor por defecto
docker compose up --build        # postgres + backend + frontend + backup
# o en una línea: JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

`JWT_SECRET` también puede ir en un `.env` junto al `docker-compose.yml` (ver `.env.example`; `.env` no se versiona). Sin él, `docker compose config/up` falla con un mensaje claro.

- Aplicación: <http://localhost:8080> (nginx sirve el frontend y proxea `/api/` al backend).
- PostgreSQL se publica en el puerto **5433** del host (nunca 5432, para no chocar con un Postgres local).
- El backend ejecuta `prisma migrate deploy` al arrancar. En producción exige un `JWT_SECRET` propio de ≥ 32 caracteres (el compose lo requiere y no tiene valor por defecto).
- `backup` escribe un `pg_dump` diario en `./backups/horario-AAAA-MM-DD.sql` (RNF-15, RPO ≤ 24 h) de forma atómica (archivo temporal y `mv` solo si el dump termina bien, así un fallo no pisa una copia buena) y borra copias de más de 14 días. `backend` y `backup` usan `restart: unless-stopped`. `backups/` está en `.gitignore`.
- Apagar y borrar contenedores y volumen: `docker compose down -v`.

### Sembrar datos en Docker

La imagen de producción no incluye `tsx`; el build compila el seed a JS (`dist-seed/`). Dos opciones equivalentes:

`seed:prod` exige `SEED_PASSWORD` (definida al hacer `up`, p. ej. `SEED_PASSWORD=... docker compose up -d`) y rechaza la contraseña pública por defecto:

```bash
# a) dentro del contenedor del backend
docker compose exec backend npm run seed:prod

# b) desde el host, contra el Postgres del compose (puerto 5433)
cd backend && DATABASE_URL=postgresql://horario:horario@localhost:5433/horario npm run seed
```

El seed es idempotente (upsert de usuarios y matrículas; no restablece la contraseña de usuarios existentes) y hace la sincronización inicial, que es una **carga base silenciosa** (no genera notificaciones, correos ni pushes; ver «Carga inicial silenciosa»).

## Usuarios semilla

Contraseña de todos: el valor de `SEED_PASSWORD` (por defecto, el de `backend/.env.example`).

| Correo | Rol | Nota |
|---|---|---|
| `admin@horariouni.test` | Administrador | Puede «Sincronizar ahora» |
| `dilan@horariouni.test` | Estudiante | Matriculado, 8 clases |
| `sebastian@horariouni.test` | Estudiante | Matriculado |
| `sinmatricula@horariouni.test` | Estudiante | Sin matrícula vigente (RRF-01) |

## Mapa requisito → código

| Requisito | Dónde |
|---|---|
| RF-HOR-01 (horario semanal) | `backend/src/modules/schedule/application/GetWeeklySchedule.ts`, ruta `GET /api/schedule/me` (`http/scheduleRoutes.ts`); `frontend/src/` (WeeklyCalendar / AgendaList) |
| RF-HOR-02 / RF-HOR-05 (sincronización y detección de cambios) | `domain/diff.ts`, `application/SyncSchedule.ts`, `backend/src/jobs/syncJob.ts`, `POST /api/admin/sync` (`http/adminRoutes.ts`) |
| RF-HOR-03 (detalle de clase) | `application/GetSessionDetail.ts`; pantalla de detalle en el frontend |
| RF-HOR-04 (exportar PDF / ICS) | `application/ExportSchedule.ts`, `infrastructure/exporters/{Base,Pdf,Ics}Exporter.ts` |
| RRF-01 (solo matrícula vigente) | `infrastructure/PrismaEnrollmentRepository.ts` + `GetWeeklySchedule.ts`; mensaje en el frontend |
| RRF-02 / RRF-07 (fuente única de escritura) | `SyncScheduleUseCase` es el único escritor; test «no existen rutas de escritura» |
| RRF-04 (acceso a horario de terceros) | `domain/access.ts` (`assertCanView`), `GET /api/schedule/users/:userId`, auditoría de terceros |
| RNF-01 (rendimiento) | Lectura indexada por usuario/semestre; ver «Prueba de carga» |
| RNF-04 (hash de contraseñas) | `auth/infrastructure/Argon2Hasher.ts` (argon2) |
| RNF-05 (sesión JWT 60 min, logout) | `JwtTokenService.ts`, `Logout.ts`, `PrismaRevokedTokenRepository.ts` |
| RNF-06 (RBAC) | `shared/http/auth.ts` (`authenticate`, `requireRole`) |
| RNF-08 / RNF-09 (responsive, accesibilidad AA) | Frontend: agenda por día a 320 px, foco visible, tokens de diseño |
| RNF-10 (escalado horizontal) | Backend sin estado (JWT + revocados en Postgres) |
| RNF-11 (cobertura) | `backend/vitest.config.ts` (umbrales 70 % líneas/funciones/sentencias, 60 % ramas) |
| RNF-14 (auditoría) | `shared/audit.ts`, `modules/audit/`, tabla `AuditLog` |
| RNF-15 (copias de seguridad) | Servicio `backup` en `docker-compose.yml` |

## Patrones de diseño

| Patrón | Dónde |
|---|---|
| Repository | Puertos en `schedule/application/ports.ts` y `auth/application/ports.ts`; `Prisma*Repository.ts` en `infrastructure/` |
| Adapter | `schedule/infrastructure/MockInstitutionalAdapter.ts` implementa `InstitutionalPort` |
| Template Method | `schedule/infrastructure/exporters/BaseExporter.ts` (+ `PdfExporter`, `IcsExporter`) |
| Observer / Domain Events | Bus tipado `shared/events/EventBus.ts` con observadores en `modules/audit/auditObserver.ts`, `modules/notifications/application/{Notification,Email}Observer.ts`, `modules/schedule/observers/syncStatsObserver.ts` y `modules/realtime/RealtimeObserver.ts`; flujo SSE en `modules/realtime/SseHub.ts`; en el navegador `frontend/src/shared/realtime.ts` (`RealtimeClient`). Ver «Eventos y patrón Observer» |
| Facade | `schedule/application/SyncSchedule.ts` (adaptador → diff → persistencia → eventos) |
| Chain of Responsibility | Cadena de middlewares Express: `shared/http/app.ts`, `auth.ts` (`authenticate` → `requireRole`), `errorHandler.ts` |
| Decorator | `shared/audit.ts` (`withAudit`), aplicado en `shared/container.ts` |
| Dependency Injection | `shared/container.ts` (`buildContainer`), cableado en `main.ts` (`wire`) |
| Singleton | `shared/prisma.ts` (un `PrismaClient` por proceso) |

## Eventos y patrón Observer

El módulo de eventos desacopla quien detecta un hecho (la sincronización) de quienes reaccionan (auditoría, estadísticas, notificaciones, correo, tiempo real). El publicador solo llama a `bus.publish(tipo, payload)`.

```
Backend (Sujeto: EventBus, backend/src/shared/events/EventBus.ts)

 SyncSchedule ─ publish ─▶ ScheduleChanged ──▶ audit (100) ─▶ notifications (50) ─▶ realtime-schedule (30)
                                                                      │
                                                          publish NotificationCreated
                                                                      ▼
                           NotificationCreated ──▶ realtime-notification (30) ─▶ email (10)
 SyncSchedule ─ publish ─▶ SyncCompleted ────▶ sync-stats (40)
 SyncSchedule ─ publish ─▶ SyncFailed        (sin observadores; queda en el historial)

Navegador (Sujeto: flujo SSE leído por RealtimeClient, frontend/src/shared/realtime.ts)

 GET /api/events/stream ──▶ RealtimeClient ──▶ ready               ──▶ useNotifications (recarga la campana)
                                           ├─▶ notification        ──▶ useNotifications (campana + toast)
                                           └─▶ schedule-changed    ──▶ SchedulePage (recarga el calendario + toast)
```

Un número mayor se ejecuta antes. Un mismo tipo de evento se entrega en secuencia (no en paralelo); `NotificationCreated` es un evento distinto, publicado desde dentro del observador `notifications` en modo «dispara y olvida» (no se espera su resultado): un correo lento o fallido nunca retrasa a `realtime-schedule` ni a la sincronización, y `idle()` lo sigue cubriendo.

### Eventos

| Evento | Lo publica | Payload |
|---|---|---|
| `ScheduleChanged` | `SyncSchedule.ts` (uno por estudiante con cambios) | `userId`, `semester`, `changes[]`, `initialLoad` (`true` si el horario local del estudiante estaba vacío) |
| `SyncCompleted` | `SyncSchedule.ts` | `runId`, `trigger` (`MANUAL`/`CRON`), `studentsSynced`, `changesCount`, `failures`, `changesByType` (`ADDED`/`UPDATED`/`CANCELLED`) |
| `SyncFailed` | `SyncSchedule.ts` | `runId`, `trigger`, `message` |
| `NotificationCreated` | `NotificationObserver.ts` y `flushPendingEmails.ts` (este último con `replay: true`) | `notificationId`, `userId`, `title`, `message`, `kind` (`SCHEDULE_ADDED`/`SCHEDULE_UPDATED`/`SCHEDULE_CANCELLED`), `replay?` |

El catálogo tipado está en `backend/src/shared/events/types.ts` (`EventMap`).

### Observadores

| Observador | Prioridad | Evento | Qué hace | Archivo |
|---|---|---|---|---|
| `audit` | 100 | `ScheduleChanged` | Registra `SCHEDULE_CHANGED` en `AuditLog` (actor `system`) | `backend/src/modules/audit/auditObserver.ts` |
| `notifications` | 50 | `ScheduleChanged` | Crea una `Notification` por cambio y publica `NotificationCreated`; no hace nada si `initialLoad` es `true` | `backend/src/modules/notifications/application/NotificationObserver.ts` |
| `sync-stats` | 40 | `SyncCompleted` | Guarda el desglose de cambios en `SyncRun.stats` | `backend/src/modules/schedule/observers/syncStatsObserver.ts` |
| `realtime-schedule` | 30 | `ScheduleChanged` | Envía `schedule-changed` por SSE al usuario dueño | `backend/src/modules/realtime/RealtimeObserver.ts` |
| `realtime-notification` | 30 | `NotificationCreated` | Envía `notification` por SSE al dueño (dentro de la ventana y sin `replay`) | `backend/src/modules/realtime/RealtimeObserver.ts` |
| `email` | 10 (3 reintentos) | `NotificationCreated` | Envía el correo dentro de la ventana; sin duplicados gracias a un reclamo atómico de `emailedAt` (ver «Ventana de envío») | `backend/src/modules/notifications/application/EmailObserver.ts` |
| Campana y toasts | — | `ready`, `notification` | Carga/actualiza la lista y el contador de no leídas y muestra un toast | `frontend/src/features/notifications/` (`useNotifications.ts`, `NotificationBell.tsx`, `ToastProvider.tsx`) |
| Recarga del calendario | — | `schedule-changed` | Vuelve a pedir el horario y avisa con un toast | `frontend/src/features/schedule/SchedulePage.tsx` |

Los observadores del backend se registran en `registerObservers` (`backend/src/shared/registerObservers.ts`), que invoca `wire()` de `backend/src/main.ts`.

### Semántica del bus

- **Orden:** prioridad descendente; a igual prioridad, orden de suscripción. La entrega de un evento es secuencial.
- **Aislamiento:** si un observador falla no afecta a los demás.
- **Reintentos:** por defecto 2 reintentos con espera exponencial `backoffMs * 2^(intento-1)` (base 1000 ms); `email` usa 3. Agotados, la entrega queda `FAILED`.
- **`once`:** la suscripción se retira antes de su primera entrega. **`unsubscribe()`** retira una suscripción.
- **`idle()`:** espera las publicaciones en vuelo (incluidas las lanzadas desde observadores); se usa en las pruebas, en el seed y en el cierre ordenado (SIGTERM/SIGINT: se detienen los cron, se espera a `idle()` y se cierran los streams SSE; salida forzada a los 10 s).
- **`publish` nunca rechaza:** devuelve un `DeliveryReport`. Si falla la escritura del historial solo se registra en consola.
- **Historial persistente:** cada evento se guarda en `DomainEvent` y cada entrega (observador, estado, intentos, error) en `EventDelivery` (`PrismaEventLog.ts`). El administrador lo ve en la pantalla «Eventos recientes» (`frontend/src/features/admin/EventsPanel.tsx`, `GET /api/admin/events`).

### Ventana de envío (RRF-05)

Las notificaciones salientes solo se entregan entre las **6:00 y las 22:00 (hora de America/Bogotá)**; configurable con `NOTIFY_WINDOW_START`, `NOTIFY_WINDOW_END` y `NOTIFY_WINDOW_TZ` (`backend/src/shared/window.ts`).

| Se limita a la ventana | No se limita |
|---|---|
| Push SSE `notification` (`realtime-notification`) | Creación de la notificación en la app (la campana la muestra al recargar) |
| Correo (`email`) | Push SSE `schedule-changed` (solo recarga el calendario) |

#### Carga inicial silenciosa

Si el horario local de un estudiante estaba vacío antes de la sincronización, `ScheduleChanged` se publica con `initialLoad: true`: `audit` y `realtime-schedule` actúan igual, pero `notifications` no crea nada (sin campana, correo ni push `notification`). Así el seed (y el primer alta de un estudiante) no inunda de avisos. En la demostración, el seed hace la carga base silenciosa y la **primera** sincronización del administrador después del seed produce los cambios y las notificaciones.

#### Entrega del correo sin duplicados

`email` **reclama** la notificación de forma atómica antes de enviar (`claimEmail`: `UPDATE … SET emailedAt = ahora WHERE id = … AND emailedAt IS NULL`) y solo envía quien gana el reclamo; dos entregas concurrentes o una re-publicación no repiten el correo. Si el envío falla, libera el reclamo (`emailedAt` vuelve a nulo), suma `emailAttempts` y relanza el error para que el bus reintente. Usuario inexistente o inactivo: se fija `emailSkippedAt` (terminal, nunca se vuelve a recoger). El job de pendientes ignora las filas con `emailSkippedAt` o con `emailAttempts >= 5`, de modo que una fila atascada no bloquea a las nuevas (índice `(emailedAt, createdAt)`). Si el proceso muere entre el reclamo y el envío, ese correo no se reenvía (se prefiere perder uno a duplicarlo).

#### Pendientes

Un correo que cae fuera de la ventana queda pendiente (`Notification.emailedAt` nulo). El job `backend/src/jobs/notificationFlushJob.ts` (cron `NOTIFY_FLUSH_CRON`, por defecto cada 5 min) llama a `flushPendingEmails`, que dentro de la ventana re-publica `NotificationCreated` con `replay: true` para las pendientes de las últimas 48 h (hasta 100 por pasada, las más antiguas primero; una pasada nueva se omite si la anterior sigue en curso). Con `replay` solo reacciona el correo; el push SSE lo ignora.

### Correo

El puerto es `EmailPort` (`backend/src/modules/notifications/application/ports.ts`). Se elige con `EMAIL_MODE` (`buildEmailAdapter.ts`):

- `console` (por defecto): `ConsoleEmailAdapter` imprime `[email:console] para=… asunto=…`; no envía nada.
- `brevo`: `BrevoEmailAdapter` envía por la API de Brevo.

Variables (nombres; valores de ejemplo en `backend/.env.example`): `EMAIL_MODE`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `EMAIL_REDIRECT_TO`, `NOTIFY_FLUSH_CRON`, `NOTIFY_WINDOW_START`, `NOTIFY_WINDOW_END`, `NOTIFY_WINDOW_TZ`, `SSE_HEARTBEAT_MS`.

Reglas de seguridad:

- La clave de Brevo va solo en `backend/.env` (ignorado por git) y nunca se registra en el log.
- `EMAIL_MODE=brevo` exige `BREVO_API_KEY` y `MAIL_FROM_EMAIL`; fuera de producción exige además `EMAIL_REDIRECT_TO`, de modo que los usuarios de prueba nunca reciben correo. Si falta algo, el backend no arranca (`backend/src/shared/safeEmailConfig.ts`). La comprobación está en `buildEmailAdapter`, que usa `wire()`, así que cubre todos los caminos de arranque: servidor, `seed` y `seed:prod`.
- La petición a Brevo se aborta a los 10 s y cualquier mensaje que Brevo devuelva se trunca a 200 caracteres con la clave sustituida por `***`.
- Valores inválidos de `NOTIFY_WINDOW_START/END` (enteros 0–24, inicio < fin) o `NOTIFY_WINDOW_TZ` (zona IANA) hacen fallar el arranque con un mensaje claro; un `SSE_HEARTBEAT_MS` no válido vuelve a 25 000 ms.
- Con `EMAIL_REDIRECT_TO`, todo correo va a esa dirección y el asunto se prefija con `[DEV → destinatario real]`.

Cómo activar Brevo de forma segura:

1. Verificar el remitente (o el dominio) en Brevo.
2. Poner en `backend/.env`: `BREVO_API_KEY`, `MAIL_FROM_EMAIL` y `MAIL_FROM_NAME`.
3. Poner `EMAIL_REDIRECT_TO` con **su propia** dirección.
4. Cambiar a `EMAIL_MODE=brevo` y reiniciar el backend.
5. Provocar un cambio (ver «Restablecer los datos de demo») y comprobar que llega el correo a su dirección y que el panel de eventos muestra `email` en `OK`.
6. Rotar la clave si alguna vez se compartió en un chat o se subió a git.

### Tiempo real

`GET /api/events/stream` es un flujo SSE (`text/event-stream`) autenticado con el JWT en la cabecera `Authorization`. Por eso el cliente (`RealtimeClient`) usa `fetch` en streaming y no `EventSource`, que no permite cabeceras y obligaría a poner el token en la URL. Reconecta con espera exponencial (1 s a 30 s).

- Cabeceras: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- Al conectar se envía `retry: 3000` y el evento `ready`; cada 25 s (`SSE_HEARTBEAT_MS`) un comentario `: ping` mantiene viva la conexión.
- Aislamiento por usuario (RRF-04): `SseHub.sendToUser` solo escribe en las conexiones del dueño del evento.
- **Límite, un solo proceso:** `SseHub` guarda las conexiones en memoria. Con varias réplicas del backend, un evento solo llega a los usuarios conectados a la réplica que lo procesó; haría falta un bus compartido (p. ej. Redis pub/sub), no incluido.
- Si el cliente se desconecta mientras se autentica, la respuesta ya destruida no se registra en el hub.
- **Limitación conocida:** una conexión abierta no se corta cuando expira o se revoca el JWT; sigue recibiendo eventos hasta que el cliente se desconecta (el token solo se valida al abrir el flujo).

### API y tablas nuevas

| Endpoint | Rol | Descripción |
|---|---|---|
| `GET /api/notifications?unread=&limit=` | autenticado | Notificaciones propias (`limit` 1–100, 30 por defecto) y `unread` |
| `POST /api/notifications/:id/read` | autenticado | Marca una propia como leída (`204`; `404` si no existe o es ajena) |
| `POST /api/notifications/read-all` | autenticado | Marca todas las propias como leídas |
| `GET /api/events/stream` | autenticado | Flujo SSE del usuario |
| `GET /api/admin/events?limit=` | ADMIN | Eventos recientes con sus entregas (`limit` 1–100, 20 por defecto) |

Tablas (migraciones Prisma): `DomainEvent`, `EventDelivery`, `Notification` (con `emailedAt`, `emailSkippedAt`, `emailAttempts`); además `SyncRun.stats` (JSON).

Limitaciones conocidas del subsistema de eventos:

- El historial de eventos que ve el administrador incluye cambios de horario de otros usuarios (solo ADMIN) y no tiene retención ni poda: crece sin límite.
- No hay *outbox*: si el proceso muere entre aplicar los cambios del horario y ejecutar los observadores, esas notificaciones se pierden (los cambios sí quedan guardados).
- Las entregas concurrentes no tienen límite: con muchos estudiantes cambiando a la vez se lanzan sin tope (aceptable a esta escala).

### Restablecer los datos de demo en desarrollo

Solo sobre la base de desarrollo de este proyecto. El seed hace la carga base silenciosa; la primera sincronización del administrador después del seed produce los cambios y, por tanto, las notificaciones. Para repetir la demostración, en `psql` (o cualquier cliente) contra la base de desarrollo:

```sql
DELETE FROM "EventDelivery";
DELETE FROM "DomainEvent";
DELETE FROM "Notification";
DELETE FROM "ScheduleChange";
DELETE FROM "ClassSession";
DELETE FROM "SyncRun";
```

y luego `cd backend && npm run seed`. Con un estudiante conectado, el primer «Sincronizar ahora» del administrador tras el seed genera los cambios (ALG101, PHY201 cancelada, LAB301) y las notificaciones aparecen en la campana, con toast y recarga automática del calendario.

## Adaptador institucional mock y cómo sustituirlo

Los datos académicos vienen del puerto `InstitutionalPort` (`backend/src/modules/schedule/application/ports.ts`). Hoy lo implementa `MockInstitutionalAdapter`, determinista y sin estado propio (seguro ante reinicios y réplicas): la primera sincronización (la del seed) carga el horario base; la siguiente muestra cambios (ALG101 pasa a bloque B, piso 3, aula 305; PHY201 se devuelve como `CANCELLED` —en BD queda la fila cancelada y desaparece de la vista semanal—; aparece LAB301) y las posteriores no muestran ninguno. Lo decide el historial: la variante se sirve si existe al menos una corrida de sincronización con estado `OK`.

Para integrar el sistema real: crear una clase que implemente `InstitutionalPort` (p. ej. `UniApiAdapter`) y cambiar la instancia en `wire()` de `backend/src/main.ts`. Ni los casos de uso ni las rutas cambian.

## Decisiones

- `Course` está **denormalizado** en `ClassSession` (código, nombre y docente en la propia fila): en esta iteración no hay tabla `Course` separada.
- `GET /api/schedule/sessions/:externalId` existe en la API (y se audita si un admin consulta la de un tercero), pero la interfaz usa el payload del horario semanal.
- Sincronización: una sola corrida a la vez (single-flight, `409 SYNC_IN_PROGRESS`; una corrida `RUNNING` de más de 1 h se considera obsoleta). Los fallos por estudiante no abortan la corrida: estado `OK`, `PARTIAL` (algunos fallaron) o `FAILED` (todos, o falló el listado). Las sincronizaciones fallidas se auditan como `SYNC_FAILED`.

## Fuera de alcance de esta iteración

Registro de usuarios / OTP, detección de huecos, búsqueda y CRUD de facultades/programas.

Del módulo de notificaciones ya están entregados: bus de eventos, notificaciones en la app, tiempo real y correo con ventana de envío y la integración con Brevo (adaptador y pruebas con `fetch` simulado; el envío real queda por activar siguiendo «Cómo activar Brevo de forma segura»). Siguen pendientes: notificaciones personalizadas (RF-NOT-01), recordatorios programados (RF-NOT-02) y canal por usuario (RF-NOT-04).

## Pruebas

```bash
cd backend  && npm test && npm run test:cov     # 185 tests (frontend: 144); cobertura backend ~96,7 % líneas, ~95,3 % ramas (umbral 70/60)
cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run build
```

La cifra de cobertura **excluye** los repositorios Prisma, `Argon2Hasher`, `main.ts` y `jobs/` (ver `backend/vitest.config.ts`), por lo que la lógica de persistencia no entra en ese porcentaje; se verifica manualmente contra la base real.

### Prueba de carga

Con el backend sembrado y un token de `POST /api/auth/login`:

```bash
npx autocannon -c 200 -d 30 -H "Authorization: Bearer <token>" http://localhost:4000/api/schedule/me
```

Objetivo: p95 < 2 s con 200 conexiones.

## Notas honestas

- RNF-03 (disponibilidad / uptime) y RNF-02 (concurrencia sostenida) **no se verifican automáticamente**: dependen del despliegue y de pruebas de carga manuales.
- Con varias réplicas del backend (`docker compose up --scale backend=3` detrás de un balanceador) el cron de sincronización se ejecuta **en cada réplica**; deje `SYNC_CRON` activo en una sola. Además, el compose no publica el puerto del backend, así que el escalado real requiere un balanceador propio.
- Los secretos y contraseñas del repositorio son solo de desarrollo.
