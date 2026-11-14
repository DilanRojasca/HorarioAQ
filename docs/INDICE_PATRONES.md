# Índice de patrones de diseño (generado)

> **Archivo generado automáticamente** con `node scripts/patterns-index.mjs` (no editar a mano). Cada fila sale de una etiqueta
> `@pattern <Patrón> | <Rol> | <Por qué>` escrita en el JSDoc de la clase, función o interfaz que **implementa** el patrón;
> por eso el archivo y la línea siempre coinciden con el código actual. Para buscar a mano: `grep -rn "@pattern Observer" backend/src frontend/src`.
>
> Explicación de cada patrón y por qué se usa: [PATRONES.md](PATRONES.md) · [ARQUITECTURA.md](ARQUITECTURA.md).

**108 marcas** en **19 patrones** (65 archivos).

| Patrón | Marcas |
|---|---|
| [Adapter](#adapter) | 7 |
| [Chain of Responsibility](#chain-of-responsibility) | 13 |
| [Command](#command) | 1 |
| [Consumidor idempotente](#consumidor-idempotente) | 4 |
| [Custom Hook](#custom-hook) | 2 |
| [Decorator](#decorator) | 2 |
| [Dependency Injection](#dependency-injection) | 2 |
| [Facade](#facade) | 4 |
| [Factory](#factory) | 2 |
| [Guard](#guard) | 1 |
| [Hexagonal (puerto)](#hexagonal-puerto) | 6 |
| [Observer](#observer) | 16 |
| [Provider](#provider) | 3 |
| [Proxy](#proxy) | 2 |
| [Repository](#repository) | 22 |
| [Singleton](#singleton) | 1 |
| [Specification](#specification) | 9 |
| [Strategy](#strategy) | 7 |
| [Template Method](#template-method) | 4 |

## Adapter

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Adaptador de Argon2Hasher | `Argon2Hasher` (class) | [`backend/src/modules/auth/infrastructure/Argon2Hasher.ts:5`](../backend/src/modules/auth/infrastructure/Argon2Hasher.ts#L5) | Adapta la librería argon2 a PasswordHasher. |
| Adaptador de CryptoOtpCodec | `CryptoOtpCodec` (class) | [`backend/src/modules/auth/infrastructure/CryptoOtpCodec.ts:9`](../backend/src/modules/auth/infrastructure/CryptoOtpCodec.ts#L9) | Adapta node:crypto a OtpCodec (CSPRNG + HMAC). |
| Adaptador de EmailOtpMailer | `EmailOtpMailer` (class) | [`backend/src/modules/auth/infrastructure/EmailOtpMailer.ts:16`](../backend/src/modules/auth/infrastructure/EmailOtpMailer.ts#L16) | Conecta el puerto de correo de notifications con el puerto OtpMailer de auth (módulos desacoplados). |
| Adaptador de JwtTokenService | `JwtTokenService` (class) | [`backend/src/modules/auth/infrastructure/JwtTokenService.ts:8`](../backend/src/modules/auth/infrastructure/JwtTokenService.ts#L8) | Adapta la librería jsonwebtoken a la interfaz TokenService que espera auth. |
| Adaptador de BrevoEmailAdapter | `BrevoEmailAdapter` (class) | [`backend/src/modules/notifications/infrastructure/BrevoEmailAdapter.ts:21`](../backend/src/modules/notifications/infrastructure/BrevoEmailAdapter.ts#L21) | Adapta la API HTTP de Brevo a la interfaz EmailPort que usan los observadores. |
| Adaptador de ConsoleEmailAdapter | `ConsoleEmailAdapter` (class) | [`backend/src/modules/notifications/infrastructure/ConsoleEmailAdapter.ts:8`](../backend/src/modules/notifications/infrastructure/ConsoleEmailAdapter.ts#L8) | Adapta la consola a EmailPort para desarrollo. |
| Adaptador de MockInstitutionalAdapter | `MockInstitutionalAdapter` (class) | [`backend/src/modules/schedule/infrastructure/MockInstitutionalAdapter.ts:27`](../backend/src/modules/schedule/infrastructure/MockInstitutionalAdapter.ts#L27) | Simula Admisiones/Registro; el real solo requiere otra clase que implemente el puerto. |

## Chain of Responsibility

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Contrato del eslabón | `RegistrationRule` (interface) | [`backend/src/modules/auth/domain/registrationRules.ts:25`](../backend/src/modules/auth/domain/registrationRules.ts#L25) | Cada regla de registro valida una sola cosa. |
| Eslabón: correo institucional | `institutionalEmailRule` (const) | [`backend/src/modules/auth/domain/registrationRules.ts:34`](../backend/src/modules/auth/domain/registrationRules.ts#L34) | RRF-06: solo se acepta el dominio @amigo.edu.co, sin permitir correos externos. |
| Eslabón: nombre completo | `fullNameRule` (const) | [`backend/src/modules/auth/domain/registrationRules.ts:41`](../backend/src/modules/auth/domain/registrationRules.ts#L41) | Exige al menos nombre y apellido; no conoce las demás reglas. |
| Eslabón: documento | `documentRule` (const) | [`backend/src/modules/auth/domain/registrationRules.ts:48`](../backend/src/modules/auth/domain/registrationRules.ts#L48) | Comprueba que el tipo de documento exista y el número tenga formato válido. |
| Eslabón: contraseña fuerte | `passwordStrengthRule` (const) | [`backend/src/modules/auth/domain/registrationRules.ts:57`](../backend/src/modules/auth/domain/registrationRules.ts#L57) | Aplica la política de contraseña (8+, mayúsculas, minúsculas y número). |
| Cadena por defecto | `DEFAULT_REGISTRATION_CHAIN` (const) | [`backend/src/modules/auth/domain/registrationRules.ts:75`](../backend/src/modules/auth/domain/registrationRules.ts#L75) | Una validación nueva es un eslabón nuevo en esta lista. |
| Recorrido de la cadena | `runRegistrationChain` (function) | [`backend/src/modules/auth/domain/registrationRules.ts:80`](../backend/src/modules/auth/domain/registrationRules.ts#L80) | Variante «validar todo»: junta todos los errores a la vez. |
| Armado de la cadena de middlewares | `createApp` (function) | [`backend/src/shared/http/app.ts:23`](../backend/src/shared/http/app.ts#L23) | requestContext → helmet → cors → json → rutas → notFound → errorHandler. |
| Eslabón: autenticación | `authenticate` (const) | [`backend/src/shared/http/auth.ts:12`](../backend/src/shared/http/auth.ts#L12) | Si el token es inválido corta la cadena con 401; los siguientes eslabones no se ejecutan. |
| Eslabón: autorización por rol | `requireRole` (const) | [`backend/src/shared/http/auth.ts:26`](../backend/src/shared/http/auth.ts#L26) | RBAC (RNF-06): corta con 403 si el rol no alcanza. |
| Último eslabón (manejo de errores) | `errorHandler` (const) | [`backend/src/shared/http/errorHandler.ts:10`](../backend/src/shared/http/errorHandler.ts#L10) | Traduce cualquier error de la cadena a una respuesta coherente. |
| Eslabón de la cadena de middlewares | `requestContext` (const) | [`backend/src/shared/http/requestContext.ts:19`](../backend/src/shared/http/requestContext.ts#L19) | Primer eslabón: asigna el contexto que usan los siguientes. |
| Réplica en el cliente | `validateRegistration` (function) | [`frontend/src/features/auth/registrationRules.ts:26`](../frontend/src/features/auth/registrationRules.ts#L26) | Validación en tiempo real; el servidor valida siempre. |

## Command

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Contrato de caso de uso | `UseCase` (interface) | [`backend/src/shared/ports.ts:2`](../backend/src/shared/ports.ts#L2) | Cada acción del sistema es un objeto con execute(); permite decorarlo, probarlo y reutilizarlo. |

## Consumidor idempotente

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Uso único del refresh token | `consume` (método) | [`backend/src/modules/auth/infrastructure/PrismaRefreshTokenRepository.ts:8`](../backend/src/modules/auth/infrastructure/PrismaRefreshTokenRepository.ts#L8) | Solo la primera petición consume el token (rotación). |
| Reclamo atómico del correo | `claimEmail` (método) | [`backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts:45`](../backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts#L45) | UPDATE … WHERE emailedAt IS NULL: solo gana una entrega, no hay correos duplicados. |
| Reclamo atómico de programadas | `claimDue` (método) | [`backend/src/modules/notifications/infrastructure/PrismaScheduledNotificationRepository.ts:25`](../backend/src/modules/notifications/infrastructure/PrismaScheduledNotificationRepository.ts#L25) | Dos réplicas no disparan la misma notificación. |
| Una sola sincronización a la vez | `tryStart` (método) | [`backend/src/modules/schedule/infrastructure/PrismaSyncRunRepository.ts:14`](../backend/src/modules/schedule/infrastructure/PrismaSyncRunRepository.ts#L14) | Devuelve null si ya hay otra corrida activa. |

## Custom Hook

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Datos de notificaciones | `useNotifications` (function) | [`frontend/src/features/notifications/useNotifications.ts:19`](../frontend/src/features/notifications/useNotifications.ts#L19) | Separa la obtención de datos de la presentación. |
| Datos del horario | `useSchedule` (function) | [`frontend/src/features/schedule/useSchedule.ts:6`](../frontend/src/features/schedule/useSchedule.ts#L6) | El hook trae los datos («gana la última respuesta»); el componente solo dibuja. |

## Decorator

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Decorador de mailer | `DevLoggingOtpMailer` (class) | [`backend/src/modules/auth/infrastructure/DevLoggingOtpMailer.ts:11`](../backend/src/modules/auth/infrastructure/DevLoggingOtpMailer.ts#L11) | Envuelve otro OtpMailer y además imprime el código (solo desarrollo). |
| Decorador de auditoría | `withAudit` (function) | [`backend/src/shared/audit.ts:15`](../backend/src/shared/audit.ts#L15) | Envuelve cualquier caso de uso y registra quién, qué y cuándo sin modificarlo. |

## Dependency Injection

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Ensamblaje con adaptadores reales | `wire` (function) | [`backend/src/main.ts:36`](../backend/src/main.ts#L36) | Crea Prisma, correo y mock institucional y los inyecta en buildContainer. |
| Composition Root | `buildContainer` (function) | [`backend/src/shared/container.ts:57`](../backend/src/shared/container.ts#L57) | Recibe los puertos ya construidos y devuelve los casos de uso listos. |

## Facade

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Fachada del registro | `RegisterUseCase` (class) | [`backend/src/modules/auth/application/Register.ts:16`](../backend/src/modules/auth/application/Register.ts#L16) | Orquesta cadena de validación, unicidad, hash, cuenta inactiva y OTP. |
| Fachada interna de huecos | `GapService` (class) | [`backend/src/modules/gaps/application/GapUseCases.ts:21`](../backend/src/modules/gaps/application/GapUseCases.ts#L21) | Combina horario, repositorio y dominio para que los casos de uso sean de una línea. |
| Fachada de la sincronización | `SyncScheduleUseCase` (class) | [`backend/src/modules/schedule/application/SyncSchedule.ts:28`](../backend/src/modules/schedule/application/SyncSchedule.ts#L28) | Una sola llamada oculta adaptador, diff, persistencia, lotes y eventos. |
| Punto único de montaje de la API v1 | `buildV1Router` (function) | [`backend/src/shared/http/v1.ts:21`](../backend/src/shared/http/v1.ts#L21) | Une los routers de cada módulo bajo un solo prefijo versionado. |

## Factory

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Fábrica de EmailPort | `buildEmailAdapter` (function) | [`backend/src/modules/notifications/infrastructure/buildEmailAdapter.ts:16`](../backend/src/modules/notifications/infrastructure/buildEmailAdapter.ts#L16) | Decide consola o Brevo según la configuración y valida que producción tenga clave. |
| Fábrica de especificaciones | `buildScheduleSpec` (function) | [`backend/src/modules/schedule/domain/specifications.ts:48`](../backend/src/modules/schedule/domain/specifications.ts#L48) | Construye la especificación combinada a partir de los filtros presentes. |

## Guard

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Guarda de rutas por rol | `ProtectedRoute` (function) | [`frontend/src/shared/ProtectedRoute.tsx:5`](../frontend/src/shared/ProtectedRoute.tsx#L5) | Primero «¿hay sesión?», luego «¿tiene el rol?» antes de renderizar. |

## Hexagonal (puerto)

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Puerto: generación/hash de OTP | `OtpCodec` (interface) | [`backend/src/modules/auth/application/ports.ts:73`](../backend/src/modules/auth/application/ports.ts#L73) | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. |
| Puerto: entrega del OTP | `OtpMailer` (interface) | [`backend/src/modules/auth/application/ports.ts:83`](../backend/src/modules/auth/application/ports.ts#L83) | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. |
| Puerto: hash de contraseñas | `PasswordHasher` (interface) | [`backend/src/modules/auth/application/ports.ts:96`](../backend/src/modules/auth/application/ports.ts#L96) | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. |
| Puerto: tokens de sesión | `TokenService` (interface) | [`backend/src/modules/auth/application/ports.ts:107`](../backend/src/modules/auth/application/ports.ts#L107) | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. |
| Puerto: correo | `EmailPort` (interface) | [`backend/src/modules/notifications/application/ports.ts:58`](../backend/src/modules/notifications/application/ports.ts#L58) | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. |
| Puerto: sistema institucional | `InstitutionalPort` (interface) | [`backend/src/modules/schedule/application/ports.ts:17`](../backend/src/modules/schedule/application/ports.ts#L17) | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. |

## Observer

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Observador concreto: audit | `registerAuditObserver` (function) | [`backend/src/modules/audit/auditObserver.ts:10`](../backend/src/modules/audit/auditObserver.ts#L10) | Registra cada ScheduleChanged (prioridad 100, el primero en ejecutarse). |
| Observador concreto: email | `registerEmailObserver` (function) | [`backend/src/modules/notifications/application/EmailObserver.ts:28`](../backend/src/modules/notifications/application/EmailObserver.ts#L28) | Envía el correo de NotificationCreated respetando ventana horaria y canal. |
| Observador concreto: notifications | `registerNotificationObserver` (function) | [`backend/src/modules/notifications/application/NotificationObserver.ts:16`](../backend/src/modules/notifications/application/NotificationObserver.ts#L16) | Convierte ScheduleChanged en notificaciones y publica NotificationCreated. |
| Observadores concretos: realtime-* | `registerRealtimeObserver` (function) | [`backend/src/modules/realtime/RealtimeObserver.ts:24`](../backend/src/modules/realtime/RealtimeObserver.ts#L24) | Empujan ScheduleChanged y NotificationCreated al navegador por SSE. |
| Canal hacia el navegador | `SseHub` (class) | [`backend/src/modules/realtime/SseHub.ts:19`](../backend/src/modules/realtime/SseHub.ts#L19) | Mantiene las conexiones SSE por usuario; es por donde los observadores realtime emiten. |
| Observador concreto: sync-stats | `registerSyncStatsObserver` (function) | [`backend/src/modules/schedule/observers/syncStatsObserver.ts:10`](../backend/src/modules/schedule/observers/syncStatsObserver.ts#L10) | Guarda el desglose de cada corrida al llegar SyncCompleted. |
| Subject (el bus) | `EventBus` (class) | [`backend/src/shared/events/EventBus.ts:38`](../backend/src/shared/events/EventBus.ts#L38) | Publica eventos sin conocer a quién los escucha; aísla y reintenta cada observador. |
| Suscripción | `subscribe` (método) | [`backend/src/shared/events/EventBus.ts:55`](../backend/src/shared/events/EventBus.ts#L55) | Un observador se registra por tipo de evento, con prioridad y reintentos. |
| Notificación a los observadores | `publish` (método) | [`backend/src/shared/events/EventBus.ts:70`](../backend/src/shared/events/EventBus.ts#L70) | Selecciona los observadores del tipo y los ordena por prioridad antes de entregar. |
| Entrega secuencial | `deliver` (método) | [`backend/src/shared/events/EventBus.ts:89`](../backend/src/shared/events/EventBus.ts#L89) | Entrega en orden y guarda el resultado de cada observador en el historial. |
| Aislamiento y reintento | `invoke` (método) | [`backend/src/shared/events/EventBus.ts:101`](../backend/src/shared/events/EventBus.ts#L101) | Si un observador falla se reintenta con backoff y no afecta a los demás. |
| Catálogo tipado de eventos | `EventMap` (interface) | [`backend/src/shared/events/types.ts:15`](../backend/src/shared/events/types.ts#L15) | Tipo de evento → payload; el compilador valida productor y observador. |
| Contrato del observador | `Observer` (type) | [`backend/src/shared/events/types.ts:42`](../backend/src/shared/events/types.ts#L42) | Firma que debe cumplir cualquier observador. |
| Cableado de observadores | `registerObservers` (function) | [`backend/src/shared/registerObservers.ts:33`](../backend/src/shared/registerObservers.ts#L33) | Único lugar donde se suscriben todos; añadir uno nuevo es una línea aquí. |
| Subject en el navegador | `RealtimeClient` (class) | [`frontend/src/shared/realtime.ts:36`](../frontend/src/shared/realtime.ts#L36) | Mantiene el flujo SSE y reparte los eventos a quien llamó a subscribe(). |
| Suscripción desde React | `useRealtime` (function) | [`frontend/src/shared/RealtimeProvider.tsx:35`](../frontend/src/shared/RealtimeProvider.tsx#L35) | Hook que suscribe un manejador a un tipo de evento y lo da de baja al desmontar. |

## Provider

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Contexto de sesión | `AuthProvider` (function) | [`frontend/src/features/auth/AuthContext.tsx:23`](../frontend/src/features/auth/AuthContext.tsx#L23) | Usuario y acciones de sesión disponibles en todo el árbol sin pasar props. |
| Contexto de avisos | `ToastProvider` (function) | [`frontend/src/features/notifications/ToastProvider.tsx:64`](../frontend/src/features/notifications/ToastProvider.tsx#L64) | Cualquier pantalla puede mostrar un aviso emergente accesible. |
| Contexto del flujo en vivo | `RealtimeProvider` (function) | [`frontend/src/shared/RealtimeProvider.tsx:15`](../frontend/src/shared/RealtimeProvider.tsx#L15) | Una sola conexión SSE compartida por toda la app. |

## Proxy

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Refresh single-flight | `tryRefresh` (function) | [`frontend/src/shared/api.ts:31`](../frontend/src/shared/api.ts#L31) | Las peticiones concurrentes comparten UN solo intento de refresh. |
| Interceptor del cliente HTTP | `raw` (function) | [`frontend/src/shared/api.ts:49`](../frontend/src/shared/api.ts#L49) | Ante un 401 rota el refresh token y reintenta; las pantallas no se enteran. |

## Repository

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Puerto de usuarios | `UserRepository` (interface) | [`backend/src/modules/auth/application/ports.ts:33`](../backend/src/modules/auth/application/ports.ts#L33) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Puerto de códigos OTP | `OtpRepository` (interface) | [`backend/src/modules/auth/application/ports.ts:58`](../backend/src/modules/auth/application/ports.ts#L58) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Puerto de refresh tokens | `RefreshTokenRepository` (interface) | [`backend/src/modules/auth/application/ports.ts:88`](../backend/src/modules/auth/application/ports.ts#L88) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Puerto de tokens revocados | `RevokedTokenRepository` (interface) | [`backend/src/modules/auth/application/ports.ts:112`](../backend/src/modules/auth/application/ports.ts#L112) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Implementación con Prisma/PostgreSQL | `PrismaOtpRepository` (class) | [`backend/src/modules/auth/infrastructure/PrismaOtpRepository.ts:5`](../backend/src/modules/auth/infrastructure/PrismaOtpRepository.ts#L5) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Implementación con Prisma/PostgreSQL | `PrismaRefreshTokenRepository` (class) | [`backend/src/modules/auth/infrastructure/PrismaRefreshTokenRepository.ts:5`](../backend/src/modules/auth/infrastructure/PrismaRefreshTokenRepository.ts#L5) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Implementación con Prisma/PostgreSQL | `PrismaRevokedTokenRepository` (class) | [`backend/src/modules/auth/infrastructure/PrismaRevokedTokenRepository.ts:5`](../backend/src/modules/auth/infrastructure/PrismaRevokedTokenRepository.ts#L5) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Implementación con Prisma/PostgreSQL | `PrismaUserRepository` (class) | [`backend/src/modules/auth/infrastructure/PrismaUserRepository.ts:14`](../backend/src/modules/auth/infrastructure/PrismaUserRepository.ts#L14) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Puerto de facultades y programas | `CatalogRepository` (interface) | [`backend/src/modules/catalog/application/CatalogUseCases.ts:12`](../backend/src/modules/catalog/application/CatalogUseCases.ts#L12) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Implementación con Prisma/PostgreSQL | `PrismaCatalogRepository` (class) | [`backend/src/modules/catalog/infrastructure/PrismaCatalogRepository.ts:5`](../backend/src/modules/catalog/infrastructure/PrismaCatalogRepository.ts#L5) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Puerto de actividades y estado de huecos | `GapRepository` (interface) | [`backend/src/modules/gaps/application/ports.ts:13`](../backend/src/modules/gaps/application/ports.ts#L13) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Implementación con Prisma/PostgreSQL | `PrismaGapRepository` (class) | [`backend/src/modules/gaps/infrastructure/PrismaGapRepository.ts:8`](../backend/src/modules/gaps/infrastructure/PrismaGapRepository.ts#L8) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Puerto de notificaciones | `NotificationRepository` (interface) | [`backend/src/modules/notifications/application/ports.ts:28`](../backend/src/modules/notifications/application/ports.ts#L28) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Puerto de notificaciones programadas | `ScheduledNotificationRepository` (interface) | [`backend/src/modules/notifications/application/ports.ts:72`](../backend/src/modules/notifications/application/ports.ts#L72) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Implementación con Prisma/PostgreSQL | `PrismaNotificationRepository` (class) | [`backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts:9`](../backend/src/modules/notifications/infrastructure/PrismaNotificationRepository.ts#L9) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Implementación con Prisma/PostgreSQL | `PrismaScheduledNotificationRepository` (class) | [`backend/src/modules/notifications/infrastructure/PrismaScheduledNotificationRepository.ts:7`](../backend/src/modules/notifications/infrastructure/PrismaScheduledNotificationRepository.ts#L7) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Puerto de horarios | `ScheduleRepository` (interface) | [`backend/src/modules/schedule/application/ports.ts:4`](../backend/src/modules/schedule/application/ports.ts#L4) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Puerto de matrículas | `EnrollmentRepository` (interface) | [`backend/src/modules/schedule/application/ports.ts:11`](../backend/src/modules/schedule/application/ports.ts#L11) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Puerto de corridas de sincronización | `SyncRunRepository` (interface) | [`backend/src/modules/schedule/application/ports.ts:36`](../backend/src/modules/schedule/application/ports.ts#L36) | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. |
| Implementación con Prisma/PostgreSQL | `PrismaEnrollmentRepository` (class) | [`backend/src/modules/schedule/infrastructure/PrismaEnrollmentRepository.ts:5`](../backend/src/modules/schedule/infrastructure/PrismaEnrollmentRepository.ts#L5) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Implementación con Prisma/PostgreSQL | `PrismaScheduleRepository` (class) | [`backend/src/modules/schedule/infrastructure/PrismaScheduleRepository.ts:21`](../backend/src/modules/schedule/infrastructure/PrismaScheduleRepository.ts#L21) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |
| Implementación con Prisma/PostgreSQL | `PrismaSyncRunRepository` (class) | [`backend/src/modules/schedule/infrastructure/PrismaSyncRunRepository.ts:8`](../backend/src/modules/schedule/infrastructure/PrismaSyncRunRepository.ts#L8) | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. |

## Singleton

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Cliente de base de datos único | `prisma` (const) | [`backend/src/shared/prisma.ts:3`](../backend/src/shared/prisma.ts#L3) | Un solo PrismaClient por proceso: evita agotar las conexiones de PostgreSQL. |

## Specification

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Contrato | `Specification` (interface) | [`backend/src/modules/schedule/domain/specifications.ts:14`](../backend/src/modules/schedule/domain/specifications.ts#L14) | Cada criterio es un objeto con isSatisfiedBy. |
| Combinador and | `and` (const) | [`backend/src/modules/schedule/domain/specifications.ts:19`](../backend/src/modules/schedule/domain/specifications.ts#L19) | Compone criterios sin condicionales anidados. |
| Combinador or | `or` (const) | [`backend/src/modules/schedule/domain/specifications.ts:22`](../backend/src/modules/schedule/domain/specifications.ts#L22) | Compone criterios sin condicionales anidados. |
| Combinador not | `not` (const) | [`backend/src/modules/schedule/domain/specifications.ts:25`](../backend/src/modules/schedule/domain/specifications.ts#L25) | Invierte un criterio para expresar «todo menos esto» sin código nuevo. |
| Criterio: nombre o código | `courseMatches` (const) | [`backend/src/modules/schedule/domain/specifications.ts:31`](../backend/src/modules/schedule/domain/specifications.ts#L31) | RF-BUS-01: busca por nombre o código ignorando tildes y mayúsculas. |
| Criterio: día | `onWeekday` (const) | [`backend/src/modules/schedule/domain/specifications.ts:36`](../backend/src/modules/schedule/domain/specifications.ts#L36) | RF-BUS-02: filtra las clases de un día de la semana. |
| Criterio: bloque | `inBlock` (const) | [`backend/src/modules/schedule/domain/specifications.ts:38`](../backend/src/modules/schedule/domain/specifications.ts#L38) | RF-BUS-02: filtra por bloque o edificio. |
| Criterio: docente | `taughtBy` (const) | [`backend/src/modules/schedule/domain/specifications.ts:40`](../backend/src/modules/schedule/domain/specifications.ts#L40) | RF-BUS-02: filtra por nombre del docente. |
| Réplica en el cliente | `filterSessions` (function) | [`frontend/src/features/schedule/filter.ts:18`](../frontend/src/features/schedule/filter.ts#L18) | Filtra al instante mientras se escribe, con los mismos criterios que el backend. |

## Strategy

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Interfaz de la estrategia | `SuggestionStrategy` (interface) | [`backend/src/modules/gaps/domain/suggestions.ts:14`](../backend/src/modules/gaps/domain/suggestions.ts#L14) | Cada regla de sugerencia por duración implementa appliesTo/suggest. |
| Estrategia concreta: descanso (<30 min) | `restStrategy` (const) | [`backend/src/modules/gaps/domain/suggestions.ts:21`](../backend/src/modules/gaps/domain/suggestions.ts#L21) | RF-HUE-02: esta regla vive en un objeto propio; cambiarla no toca a las demás. |
| Estrategia concreta: alimentación (30–60 min) | `mealStrategy` (const) | [`backend/src/modules/gaps/domain/suggestions.ts:28`](../backend/src/modules/gaps/domain/suggestions.ts#L28) | RF-HUE-02: esta regla vive en un objeto propio; cambiarla no toca a las demás. |
| Estrategia concreta: estudio (>60 min) | `studyStrategy` (const) | [`backend/src/modules/gaps/domain/suggestions.ts:35`](../backend/src/modules/gaps/domain/suggestions.ts#L35) | RF-HUE-02: esta regla vive en un objeto propio; cambiarla no toca a las demás. |
| Contexto | `suggestFor` (function) | [`backend/src/modules/gaps/domain/suggestions.ts:44`](../backend/src/modules/gaps/domain/suggestions.ts#L44) | Recorre las estrategias y usa la primera que aplica, sin if/else. |
| Política por canal | `channelPolicy` (const) | [`backend/src/modules/notifications/domain/channelPolicy.ts:16`](../backend/src/modules/notifications/domain/channelPolicy.ts#L16) | IN_APP / EMAIL / BOTH deciden qué medios usar sin condicionales dispersos (RF-NOT-04). |
| Elección del exportador por formato | `ExportScheduleUseCase` (class) | [`backend/src/modules/schedule/application/ExportSchedule.ts:12`](../backend/src/modules/schedule/application/ExportSchedule.ts#L12) | exporters[format] selecciona PDF o ICS en tiempo de ejecución. |

## Template Method

| Rol | Símbolo | Ubicación | Por qué aquí |
|---|---|---|---|
| Clase base | `BaseExporter` (class) | [`backend/src/modules/schedule/infrastructure/exporters/BaseExporter.ts:12`](../backend/src/modules/schedule/infrastructure/exporters/BaseExporter.ts#L12) | Fija el esqueleto de la exportación; las subclases solo implementan render(). |
| Método plantilla | `export` (método) | [`backend/src/modules/schedule/infrastructure/exporters/BaseExporter.ts:22`](../backend/src/modules/schedule/infrastructure/exporters/BaseExporter.ts#L22) | Filtra y ordena → render() → arma el nombre del archivo. |
| Subclase: .ics | `IcsExporter` (class) | [`backend/src/modules/schedule/infrastructure/exporters/IcsExporter.ts:10`](../backend/src/modules/schedule/infrastructure/exporters/IcsExporter.ts#L10) | Solo implementa el paso render(); el resto del algoritmo lo hereda de BaseExporter. |
| Subclase: PDF | `PdfExporter` (class) | [`backend/src/modules/schedule/infrastructure/exporters/PdfExporter.ts:6`](../backend/src/modules/schedule/infrastructure/exporters/PdfExporter.ts#L6) | Solo implementa el paso render(); el resto del algoritmo lo hereda de BaseExporter. |
