# Patrones de diseño: dónde nacen, dónde se usan y por qué

Guía línea por línea. Cada patrón tiene la misma ficha:

* **Idea** en una frase.
* **Nace en**: el archivo y la línea donde se *define* el patrón (la interfaz, la clase base o el decorador).
* **Se usa en**: quién lo implementa o lo consume, con archivo y línea.
* **Por qué aquí**: el problema concreto del proyecto que resuelve y qué pasaría sin el patrón.
* **Cómo extenderlo**.

> Los números de línea corresponden al estado actual del repositorio. Si el código cambia, busca el nombre del símbolo (por ejemplo `EventBus`) en el archivo indicado.
> Visión general y diagramas: [ARQUITECTURA.md](ARQUITECTURA.md).

## Índice

| # | Patrón | Tipo | Carpeta donde nace |
|---|---|---|---|
| 1 | [Arquitectura hexagonal (puertos y adaptadores)](#1-arquitectura-hexagonal-puertos-y-adaptadores) | Arquitectónico | `modules/*/application/ports.ts` |
| 2 | [Dependency Injection / Composition Root](#2-dependency-injection--composition-root) | Creacional | `shared/container.ts` + `main.ts` |
| 3 | [Repository](#3-repository) | Estructural | `modules/*/application/ports.ts` |
| 4 | [Adapter](#4-adapter) | Estructural | `modules/*/infrastructure/` |
| 5 | [Factory](#5-factory) | Creacional | `notifications/infrastructure`, `schedule/domain` |
| 6 | [Singleton](#6-singleton) | Creacional | `shared/prisma.ts` |
| 7 | [Observer](#7-observer-bus-de-eventos) | Comportamiento | `shared/events/EventBus.ts` |
| 8 | [Facade](#8-facade) | Estructural | `schedule/application`, `auth/application`, `gaps/application` |
| 9 | [Decorator](#9-decorator) | Estructural | `shared/audit.ts` |
| 10 | [Strategy](#10-strategy) | Comportamiento | `gaps/domain/suggestions.ts` |
| 11 | [Specification](#11-specification) | Comportamiento | `schedule/domain/specifications.ts` |
| 12 | [Chain of Responsibility](#12-chain-of-responsibility) | Comportamiento | `shared/http/auth.ts`, `auth/domain/registrationRules.ts` |
| 13 | [Template Method](#13-template-method) | Comportamiento | `schedule/infrastructure/exporters/BaseExporter.ts` |
| 14 | [Command / Use Case](#14-command--use-case) | Comportamiento | `shared/ports.ts` |
| 15 | [Consumidor idempotente (reclamo atómico)](#15-consumidor-idempotente-reclamo-atómico) | Táctica de confiabilidad | `*/infrastructure/Prisma*Repository.ts` |
| 16 | [Frontend: Provider, Hooks, Proxy, Guard](#16-frontend) | Varios | `frontend/src/shared`, `frontend/src/features` |

Rutas abreviadas: `backend/src/modules` → `modules`, `backend/src/shared` → `shared`.

---

## 1. Arquitectura hexagonal (puertos y adaptadores)

**Idea:** el núcleo del negocio define *interfaces* (puertos) de lo que necesita del mundo exterior; la base de datos, el correo o el sistema institucional son *adaptadores* que las implementan. El núcleo nunca importa un adaptador.

**Nace en:** los archivos `ports.ts` de cada módulo.

| Puerto (interfaz) | Línea | Adaptador que lo implementa |
|---|---|---|
| `UserRepository` | [auth/application/ports.ts:29](../backend/src/modules/auth/application/ports.ts) | `PrismaUserRepository` — [auth/infrastructure/PrismaUserRepository.ts:10](../backend/src/modules/auth/infrastructure/PrismaUserRepository.ts) |
| `OtpMailer` | [auth/application/ports.ts:67](../backend/src/modules/auth/application/ports.ts) | `EmailOtpMailer` — [auth/infrastructure/EmailOtpMailer.ts:14](../backend/src/modules/auth/infrastructure/EmailOtpMailer.ts) |
| `ScheduleRepository` | [schedule/application/ports.ts:3](../backend/src/modules/schedule/application/ports.ts) | `PrismaScheduleRepository` — [PrismaScheduleRepository.ts:20](../backend/src/modules/schedule/infrastructure/PrismaScheduleRepository.ts) |
| `InstitutionalPort` | [schedule/application/ports.ts:14](../backend/src/modules/schedule/application/ports.ts) | `MockInstitutionalAdapter` — [MockInstitutionalAdapter.ts:25](../backend/src/modules/schedule/infrastructure/MockInstitutionalAdapter.ts) |
| `NotificationRepository` | [notifications/application/ports.ts:27](../backend/src/modules/notifications/application/ports.ts) | `PrismaNotificationRepository` — [PrismaNotificationRepository.ts:8](../backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts) |
| `EmailPort` | [notifications/application/ports.ts:53](../backend/src/modules/notifications/application/ports.ts) | `BrevoEmailAdapter` [:19](../backend/src/modules/notifications/infrastructure/BrevoEmailAdapter.ts), `ConsoleEmailAdapter` [:4](../backend/src/modules/notifications/infrastructure/ConsoleEmailAdapter.ts) |
| `GapRepository` | [gaps/application/ports.ts:9](../backend/src/modules/gaps/application/ports.ts) | `PrismaGapRepository` — [PrismaGapRepository.ts:7](../backend/src/modules/gaps/infrastructure/PrismaGapRepository.ts) |

**Por qué aquí:** el sistema institucional real todavía no existe (hoy hay un *mock*) y el correo cambia entre desarrollo (consola) y producción (Brevo). Sin puertos habría que tocar los casos de uso en cada cambio.
La prueba de que funciona: las pruebas usan `InMemoryUsers` ([tests/helpers/inMemory.ts:76](../backend/tests/helpers/inMemory.ts)) en lugar de Prisma, y los casos de uso ni se enteran.

**Regla verificable:** ninguna carpeta `domain/` ni `application/` importa `@prisma/client`, `express` ni `argon2`.

---

## 2. Dependency Injection / Composition Root

**Idea:** las clases reciben sus dependencias por el constructor; un único sitio las crea y las conecta.

**Nace en:** [shared/container.ts:56](../backend/src/shared/container.ts) (`buildContainer(p: Ports, cfg)`). Recibe los *puertos ya construidos* y devuelve los casos de uso.

**Se usa en:**
* [main.ts:35](../backend/src/main.ts) `wire()`: crea los adaptadores **reales** (`new MockInstitutionalAdapter` en la línea 50, `buildEmailAdapter` en la 45) y llama a `buildContainer` en la 47.
* Las pruebas HTTP ([tests/http/fullFlow.test.ts](../backend/tests/http/fullFlow.test.ts)) llaman a `buildContainer` con **dobles en memoria**.

**Por qué aquí:** es lo que hace posible el punto 1. Cambiar Prisma por memoria, o el mock por el sistema real, es cambiar **una línea** en `wire()`.

---

## 3. Repository

**Idea:** una interfaz con vocabulario del negocio (`findByEmail`, `claimDue`) que esconde cómo se guarda.

**Nace en:** los puertos `*Repository` de la tabla del punto 1 (p. ej. `UserRepository` en [auth/application/ports.ts:29](../backend/src/modules/auth/application/ports.ts)).

**Se usa en:** cada caso de uso recibe el repositorio por constructor, por ejemplo [Register.ts:15](../backend/src/modules/auth/application/Register.ts) recibe `UserRepository`.

**Por qué aquí:** el caso de uso «registrar» dice `users.create(...)` y no sabe si es SQL. Eso permite probarlo en milisegundos y migrar de base de datos sin tocar la lógica.

---

## 4. Adapter

**Idea:** convertir la interfaz de algo que no controlamos en la interfaz que el dominio espera.

| Adaptador | Qué adapta | Archivo:línea |
|---|---|---|
| `MockInstitutionalAdapter` | un «sistema institucional» simulado → `InstitutionalPort` | [MockInstitutionalAdapter.ts:25](../backend/src/modules/schedule/infrastructure/MockInstitutionalAdapter.ts) |
| `BrevoEmailAdapter` | la API HTTP de Brevo → `EmailPort` | [BrevoEmailAdapter.ts:19](../backend/src/modules/notifications/infrastructure/BrevoEmailAdapter.ts) |
| `EmailOtpMailer` | el puerto de correo de *notifications* → el puerto `OtpMailer` de *auth* | [EmailOtpMailer.ts:14](../backend/src/modules/auth/infrastructure/EmailOtpMailer.ts) |
| `Argon2Hasher` | la librería `argon2` → `PasswordHasher` | [Argon2Hasher.ts:4](../backend/src/modules/auth/infrastructure/Argon2Hasher.ts) |
| `JwtTokenService` | `jsonwebtoken` → `TokenService` | [JwtTokenService.ts:7](../backend/src/modules/auth/infrastructure/JwtTokenService.ts) |

**Por qué aquí:** `EmailOtpMailer` es el caso más interesante: `auth` no puede depender de `notifications` (módulos separados), así que define **su propio** puerto (`OtpMailer`) y un adaptador lo conecta con el correo. Los módulos quedan desacoplados.
Para el sistema institucional real basta escribir `UniApiAdapter implements InstitutionalPort` y cambiarlo en [main.ts:50](../backend/src/main.ts).

---

## 5. Factory

**Idea:** una función decide qué objeto concreto construir según la configuración.

* **Nace y se usa en** [buildEmailAdapter](../backend/src/modules/notifications/infrastructure/buildEmailAdapter.ts) (línea 14): según `EMAIL_MODE` devuelve `ConsoleEmailAdapter` o `BrevoEmailAdapter`, y valida que producción tenga clave. Se llama en [main.ts:45](../backend/src/main.ts).
* **`buildScheduleSpec`** — [specifications.ts:38](../backend/src/modules/schedule/domain/specifications.ts): construye la especificación combinada a partir de los filtros que el usuario realmente envió (ver patrón 11).

**Por qué aquí:** el resto del código pide «un `EmailPort`» y no decide si es Brevo o consola; esa decisión (y su validación de seguridad) vive en un solo sitio.

---

## 6. Singleton

**Idea:** una sola instancia por proceso.

**Nace y se usa en:** [shared/prisma.ts:2](../backend/src/shared/prisma.ts): `export const prisma = new PrismaClient()`.

**Por qué aquí:** cada `PrismaClient` abre su propio pool de conexiones; crear uno por petición agotaría PostgreSQL.
**Matiz honesto:** `EventBus` y `SseHub` también son únicos, pero **por composición** (se crean una vez en `wire()` y se inyectan), no como singletons globales. Eso los hace sustituibles en pruebas.

---

## 7. Observer (bus de eventos)

**Idea:** un *Subject* notifica a una lista de *Observers* sin conocerlos.

**Nace en:** [shared/events/EventBus.ts:36](../backend/src/shared/events/EventBus.ts) (`class EventBus`).

| Pieza | Línea | Qué hace |
|---|---|---|
| `subscribe` | [EventBus.ts:52](../backend/src/shared/events/EventBus.ts) | registra un observador por tipo de evento, con prioridad y reintentos |
| `publish` | [EventBus.ts:66](../backend/src/shared/events/EventBus.ts) | selecciona los observadores del tipo y los ordena por prioridad (línea 71) |
| `deliver` | [EventBus.ts:84](../backend/src/shared/events/EventBus.ts) | entrega en secuencia y guarda cada resultado en `EventDelivery` |
| `invoke` | [EventBus.ts:95](../backend/src/shared/events/EventBus.ts) | un observador a la vez: reintento con *backoff* exponencial; si falla definitivamente queda `FAILED` y **no afecta a los demás** |
| catálogo de eventos | [events/types.ts:11](../backend/src/shared/events/types.ts) (`EventMap`) | tipo de evento → forma del payload (tipado) |

**Quién publica (productores):**

| Evento | Publicado en |
|---|---|
| `ScheduleChanged` | [SyncSchedule.ts:58](../backend/src/modules/schedule/application/SyncSchedule.ts) y, para la demo del botón de admin, [adminRoutes.ts:71](../backend/src/modules/schedule/http/adminRoutes.ts) |
| `SyncCompleted` / `SyncFailed` | [SyncSchedule.ts:74](../backend/src/modules/schedule/application/SyncSchedule.ts) / [:81](../backend/src/modules/schedule/application/SyncSchedule.ts) |
| `NotificationCreated` | [NotificationObserver.ts:28](../backend/src/modules/notifications/application/NotificationObserver.ts), [ScheduledNotifications.ts:79](../backend/src/modules/notifications/application/ScheduledNotifications.ts), [flushPendingEmails.ts:30](../backend/src/modules/notifications/application/flushPendingEmails.ts) |

**Quién escucha (observadores):** todos se suscriben en un solo lugar, [shared/registerObservers.ts:31](../backend/src/shared/registerObservers.ts), invocado en [main.ts:46](../backend/src/main.ts).

| Observador (prioridad) | Evento | Archivo:línea | Para qué |
|---|---|---|---|
| `audit` (100) | `ScheduleChanged` | [auditObserver.ts:8](../backend/src/modules/audit/auditObserver.ts) | deja constancia de cada cambio (RNF-14) |
| `notifications` (50) | `ScheduleChanged` | [NotificationObserver.ts:17](../backend/src/modules/notifications/application/NotificationObserver.ts) | crea la notificación y publica `NotificationCreated` |
| `realtime-schedule` (30) | `ScheduleChanged` | [RealtimeObserver.ts:26](../backend/src/modules/realtime/RealtimeObserver.ts) | avisa por SSE que el horario cambió |
| `realtime-notification` (30) | `NotificationCreated` | [RealtimeObserver.ts:29](../backend/src/modules/realtime/RealtimeObserver.ts) | empuja el aviso al navegador |
| `email` (10) | `NotificationCreated` | [EmailObserver.ts:30](../backend/src/modules/notifications/application/EmailObserver.ts) | envía el correo (ventana 6–22 h y canal preferido) |
| `sync-stats` (40) | `SyncCompleted` | [syncStatsObserver.ts:8](../backend/src/modules/schedule/observers/syncStatsObserver.ts) | guarda el desglose de la corrida |

**Por qué aquí:** `SyncScheduleUseCase` solo hace `void bus.publish('ScheduleChanged', …)` ([línea 58](../backend/src/modules/schedule/application/SyncSchedule.ts)). Sin el patrón tendría que llamar él mismo a auditoría, notificaciones, SSE y correo: conocería a todos, un correo lento retrasaría la sincronización y un fallo del correo la rompería. Con el bus, cada observador falla y reintenta por separado.

**Lado navegador (otro Observer):** el *Subject* es el flujo SSE. [RealtimeClient](../frontend/src/shared/realtime.ts) (línea 34) expone `subscribe` (línea 56); el hook [`useRealtime`](../frontend/src/shared/RealtimeProvider.tsx) (línea 27) lo envuelve. Se usa en [SchedulePage.tsx:31](../frontend/src/features/schedule/SchedulePage.tsx) (recargar horario) y [useNotifications.ts:56](../frontend/src/features/notifications/useNotifications.ts) y [:58](../frontend/src/features/notifications/useNotifications.ts) (campana y avisos).

**Cómo extenderlo:** escribir el observador, suscribirlo con `bus.subscribe(...)` y añadir **una línea** en `registerObservers.ts`. Ningún caso de uso cambia. Puedes verlo funcionar con el botón «Enviar notificación de prueba» del panel de administración.

---

## 8. Facade

**Idea:** una sola puerta de entrada simple que orquesta varios pasos y subsistemas.

| Fachada | Línea | Qué oculta |
|---|---|---|
| `SyncScheduleUseCase.execute` | [SyncSchedule.ts:24](../backend/src/modules/schedule/application/SyncSchedule.ts) / [:27](../backend/src/modules/schedule/application/SyncSchedule.ts) | `tryStart` de corrida única (:30) → pedir horario al adaptador (:52) → `diffSchedules` (:54) → persistir (:56) → publicar eventos (:58) → cerrar corrida, por lotes de estudiantes (:47) |
| `RegisterUseCase.execute` | [Register.ts:14](../backend/src/modules/auth/application/Register.ts) / [:17](../backend/src/modules/auth/application/Register.ts) | cadena de validación (:18) → unicidad → hash argon2 → cuenta inactiva → emisión del OTP |
| `GapService` | [GapUseCases.ts:19](../backend/src/modules/gaps/application/GapUseCases.ts) | horario + repositorio de huecos + dominio puro + estrategias, para que los casos de uso sean de una línea |

**Por qué aquí:** la ruta HTTP solo llama a `c.sync.execute(...)`. Si mañana se añade un paso (por ejemplo, validar contra otra fuente), se cambia dentro de la fachada y ninguna ruta ni job se entera.

---

## 9. Decorator

**Idea:** envolver un objeto con otro de la **misma interfaz** para añadir comportamiento sin modificarlo.

**Nace en:** [shared/audit.ts:14](../backend/src/shared/audit.ts) — `withAudit(audit, acción, casoDeUso, opts)` devuelve otro `UseCase` que ejecuta el original y después registra quién, qué y cuándo (y `<ACCIÓN>_FAILED` si falla).

**Se usa en** [shared/container.ts](../backend/src/shared/container.ts), donde cada caso de uso sensible se envuelve:

| Caso de uso decorado | Línea | Acción auditada |
|---|---|---|
| ver horario de un tercero | [:59](../backend/src/shared/container.ts) | `VIEW_THIRD_PARTY_SCHEDULE` |
| detalle de tercero | [:66](../backend/src/shared/container.ts) | `VIEW_THIRD_PARTY_SESSION` |
| sincronización | [:73](../backend/src/shared/container.ts) | `SYNC` / `SYNC_FAILED` |
| login | [:88](../backend/src/shared/container.ts) | `LOGIN` / `LOGIN_FAILED` |
| registro / verificación / reset / perfil / roles | [:91](../backend/src/shared/container.ts), [:94](../backend/src/shared/container.ts), [:97](../backend/src/shared/container.ts), [:100](../backend/src/shared/container.ts), [:103](../backend/src/shared/container.ts) | `REGISTER`, `VERIFY_ACCOUNT`, `PASSWORD_RESET`, `UPDATE_PROFILE`, `CHANGE_ROLE` |

**Segundo decorador:** [DevLoggingOtpMailer.ts:9](../backend/src/modules/auth/infrastructure/DevLoggingOtpMailer.ts) envuelve a un `OtpMailer` y además imprime el código en consola. Se activa **solo en desarrollo** en [main.ts:64](../backend/src/main.ts).

**Por qué aquí:** la auditoría es una preocupación transversal (RNF-14). Si cada caso de uso llamara a `audit.record(...)`, se olvidaría en alguno y el código de negocio se llenaría de ruido. Con el decorador, `LoginUseCase` no sabe que lo auditan.

---

## 10. Strategy

**Idea:** encapsular cada variante de una regla en un objeto intercambiable; el contexto elige cuál usar sin `if/else`.

**Nace en:** [gaps/domain/suggestions.ts:13](../backend/src/modules/gaps/domain/suggestions.ts) — `interface SuggestionStrategy { appliesTo(min); suggest(min) }`.

| Estrategia | Línea | Regla (RF-HUE-02) |
|---|---|---|
| `restStrategy` | [:19](../backend/src/modules/gaps/domain/suggestions.ts) | `< 30 min` → descanso |
| `mealStrategy` | [:25](../backend/src/modules/gaps/domain/suggestions.ts) | `30–60 min` → alimentación |
| `studyStrategy` | [:31](../backend/src/modules/gaps/domain/suggestions.ts) | `> 60 min` → estudio |
| lista y contexto | [:37](../backend/src/modules/gaps/domain/suggestions.ts) `DEFAULT_STRATEGIES`, [:39](../backend/src/modules/gaps/domain/suggestions.ts) `suggestFor` | recorre las estrategias y usa la primera que aplica |

**Se usa en:** [GapUseCases.ts:37](../backend/src/modules/gaps/application/GapUseCases.ts): `suggestion: status === 'AVAILABLE' && !act ? suggestFor(g.minutes) : null` (RF-HUE-04: un hueco ocupado no recibe sugerencia).

**Segunda aplicación — canal de notificación (RF-NOT-04):** [channelPolicy.ts:9](../backend/src/modules/notifications/domain/channelPolicy.ts) define la política de cada canal (`IN_APP`, `EMAIL`, `BOTH`) y [channelPolicy.ts:15](../backend/src/modules/notifications/domain/channelPolicy.ts) la elige. La consultan [EmailObserver.ts:40](../backend/src/modules/notifications/application/EmailObserver.ts) (¿enviar correo?) y [RealtimeObserver.ts:32](../backend/src/modules/realtime/RealtimeObserver.ts) (¿empujar aviso?).

**Tercera — exportadores por formato:** [ExportSchedule.ts:22](../backend/src/modules/schedule/application/ExportSchedule.ts) hace `this.exporters[i.format].export(...)`; el mapa se arma en [main.ts:69](../backend/src/main.ts).

**Por qué aquí:** las reglas de sugerencia cambiarán (por ejemplo «> 180 min: ir a la biblioteca»). Con Strategy eso es **una constante nueva** y añadirla a la lista; sin él sería otro `else if` dentro de una función que crece sin fin y se prueba peor.

---

## 11. Specification

**Idea:** cada criterio de búsqueda es un objeto con `isSatisfiedBy`, combinable con `and`/`or`/`not`.

**Nace en:** [schedule/domain/specifications.ts:12](../backend/src/modules/schedule/domain/specifications.ts) (`interface Specification<T>`), combinadores `and` [:16](../backend/src/modules/schedule/domain/specifications.ts), criterios como `courseMatches` [:25](../backend/src/modules/schedule/domain/specifications.ts) y la fábrica `buildScheduleSpec` [:38](../backend/src/modules/schedule/domain/specifications.ts).

**Se usa en:** [GetWeeklySchedule.ts:23](../backend/src/modules/schedule/application/GetWeeklySchedule.ts) (`const spec = buildScheduleSpec(i.filter ?? {})`) y la línea 25 (`.filter((x) => spec.isSatisfiedBy(x))`). La ruta `GET /api/schedule/me?q=&weekday=&block=&teacher=` pasa los filtros.

**Réplica en el cliente:** [filter.ts:17](../frontend/src/features/schedule/filter.ts) (`filterSessions`), usada en [SchedulePage.tsx:24](../frontend/src/features/schedule/SchedulePage.tsx) para filtrar al instante mientras se escribe (RF-BUS-01 «tiempo real»).

**Por qué aquí:** el usuario puede combinar nombre + día + bloque + docente en cualquier orden. Sin el patrón sería un `if` por cada combinación posible. Con él, solo se componen los criterios presentes.

---

## 12. Chain of Responsibility

**Idea:** una petición (o un dato) pasa por una cadena de eslabones; cada uno decide si continúa o corta.

### 12.1 Middlewares HTTP

**Nace en:** la cadena que arma [shared/http/app.ts:20-34](../backend/src/shared/http/app.ts) (`helmet` → `cors` → `json` → rutas → `notFound` → `errorHandler`). Dentro de cada ruta protegida: [`authenticate`](../backend/src/shared/http/auth.ts) (línea 11) y luego [`requireRole`](../backend/src/shared/http/auth.ts) (línea 24). Si `authenticate` rechaza con 401, `requireRole` y el caso de uso **no se ejecutan**.
**Por qué aquí:** autenticar, autorizar (RNF-06), validar (zod) y manejar errores son responsabilidades distintas; encadenarlas evita repetir comprobaciones en cada ruta.

### 12.2 Reglas de registro

**Nace en:** [auth/domain/registrationRules.ts:21](../backend/src/modules/auth/domain/registrationRules.ts) (`interface RegistrationRule`). Eslabones: `institutionalEmailRule` [:29](../backend/src/modules/auth/domain/registrationRules.ts) y los demás; la cadena por defecto es `DEFAULT_REGISTRATION_CHAIN` [:63](../backend/src/modules/auth/domain/registrationRules.ts) y se recorre en `runRegistrationChain` [:67](../backend/src/modules/auth/domain/registrationRules.ts).
**Se usa en:** [Register.ts:18](../backend/src/modules/auth/application/Register.ts); réplica cliente [validateRegistration](../frontend/src/features/auth/registrationRules.ts) (línea 25), usada en [RegisterPage.tsx:19](../frontend/src/features/auth/RegisterPage.tsx).
**Por qué aquí:** variante «validar todo»: junta **todos** los errores para mostrarlos a la vez (mejor usabilidad que parar en el primero). Una regla nueva es un eslabón nuevo en la lista.

### 12.3 Guard de rutas (frontend)

[ProtectedRoute.tsx:4](../frontend/src/shared/ProtectedRoute.tsx), usado en [App.tsx:31](../frontend/src/App.tsx), [:33](../frontend/src/App.tsx) y [:39](../frontend/src/App.tsx): primero «¿hay sesión?», luego «¿tiene el rol?».

---

## 13. Template Method

**Idea:** una clase base fija el esqueleto de un algoritmo y las subclases rellenan solo un paso.

**Nace en:** [BaseExporter.ts:11](../backend/src/modules/schedule/infrastructure/exporters/BaseExporter.ts). El método plantilla es `export` (línea 17): prepara (filtra activas y ordena, línea 18) → llama al paso abstracto `render` (declarado en la línea 14, invocado en la 19) → arma el nombre de archivo (línea 20).

**Se implementa en:** [PdfExporter.ts:5](../backend/src/modules/schedule/infrastructure/exporters/PdfExporter.ts) y [IcsExporter.ts:9](../backend/src/modules/schedule/infrastructure/exporters/IcsExporter.ts); solo cambia `render`, `contentType` y `extension`.

**Por qué aquí:** PDF y `.ics` comparten el 80 % (qué clases, en qué orden, cómo se llama el archivo). Sin el patrón esa lógica estaría copiada en dos clases y divergiría.

---

## 14. Command / Use Case

**Idea:** cada acción del sistema es un objeto con una única operación.

**Nace en:** [shared/ports.ts:1](../backend/src/shared/ports.ts) — `interface UseCase<I, O> { execute(input: I): Promise<O> }`.

**Se usa en:** todos los casos de uso (`RegisterUseCase`, `SyncScheduleUseCase`, `AssignActivityUseCase`…). Es lo que permite que `withAudit` (patrón 9) decore **cualquiera** de ellos, y que HTTP y `cron` los invoquen igual (por ejemplo [jobs/syncJob.ts](../backend/src/jobs/syncJob.ts) llama a `sync.execute({ trigger: 'CRON' })`).

---

## 15. Consumidor idempotente (reclamo atómico)

No es un patrón GoF; es la táctica que hace seguro el trabajo cuando hay **reintentos o varias réplicas**. Todos usan la misma idea: un `UPDATE … WHERE campo IS NULL` que solo gana una vez.

| Dónde | Línea | Qué evita |
|---|---|---|
| `claimEmail` (puerto en [ports.ts](../backend/src/modules/notifications/application/ports.ts), SQL en [PrismaNotificationRepository.ts:43](../backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts), usado en [EmailObserver.ts:44](../backend/src/modules/notifications/application/EmailObserver.ts)) | | enviar dos veces el mismo correo |
| `claimDue` — [PrismaScheduledNotificationRepository.ts:23](../backend/src/modules/notifications/infrastructure/PrismaScheduledNotificationRepository.ts) | | que dos réplicas disparen la misma notificación programada |
| `consume` — [PrismaRefreshTokenRepository.ts:6](../backend/src/modules/auth/infrastructure/PrismaRefreshTokenRepository.ts) | | usar dos veces un refresh token |
| `tryStart` — [PrismaSyncRunRepository.ts:9](../backend/src/modules/schedule/infrastructure/PrismaSyncRunRepository.ts), usado en [SyncSchedule.ts:30](../backend/src/modules/schedule/application/SyncSchedule.ts) | | dos sincronizaciones masivas simultáneas |

**Por qué aquí:** el cron corre en cada réplica (RNF-10, escalamiento horizontal) y el bus reintenta. Sin reclamos atómicos habría correos y notificaciones duplicados.

---

## 16. Frontend

| Patrón | Nace en | Se usa en | Por qué |
|---|---|---|---|
| **Provider / Context** | [AuthProvider](../frontend/src/features/auth/AuthContext.tsx) (:22), [ToastProvider](../frontend/src/features/notifications/ToastProvider.tsx) (:60), [RealtimeProvider](../frontend/src/shared/RealtimeProvider.tsx) (:11) | se montan en [App.tsx:22](../frontend/src/App.tsx) | sesión, avisos y flujo en vivo disponibles en todo el árbol sin pasar props |
| **Custom Hook** | [useSchedule](../frontend/src/features/schedule/useSchedule.ts) (:5), [useNotifications](../frontend/src/features/notifications/useNotifications.ts) (:15) | `SchedulePage`, `NotificationBell` | el hook trae datos («gana la última respuesta»); el componente solo dibuja |
| **Proxy / Interceptor** | [api.ts:47](../frontend/src/shared/api.ts) `raw`, [:30](../frontend/src/shared/api.ts) `tryRefresh`, [:32](../frontend/src/shared/api.ts) `refreshing ??=` | toda llamada `api.get/post/put/del` | ante un 401 rota el refresh token **una sola vez** (single-flight) y reintenta ([:53](../frontend/src/shared/api.ts)); las pantallas no se enteran (RNF-05) |
| **Guard** | [ProtectedRoute.tsx:4](../frontend/src/shared/ProtectedRoute.tsx) | [App.tsx:31](../frontend/src/App.tsx) | RBAC en el cliente (el servidor valida siempre) |

---

## Resumen: «¿dónde está el patrón X?»

| Quiero ver… | Abre |
|---|---|
| el bus de eventos | `backend/src/shared/events/EventBus.ts` |
| quién escucha qué | `backend/src/shared/registerObservers.ts` |
| la auditoría transversal | `backend/src/shared/audit.ts` + `container.ts` |
| las sugerencias de huecos | `backend/src/modules/gaps/domain/suggestions.ts` |
| los filtros del horario | `backend/src/modules/schedule/domain/specifications.ts` |
| la validación del registro | `backend/src/modules/auth/domain/registrationRules.ts` |
| el ensamblaje de todo | `backend/src/shared/container.ts` y `backend/src/main.ts` |
| un puerto y su adaptador | tabla del punto 1 |
