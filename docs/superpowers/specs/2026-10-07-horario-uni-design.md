# Horario UNI — Módulo Horario Académico (diseño)

Fuente: `Requisitos_HorarioUNI.pdf` (Universidad Católica Luis Amigó). Alcance de esta iteración: **solo el módulo de Horario Académico (RF-HOR-01..05)** con soporte mínimo de autenticación.

## Alcance
**Dentro**
- RF-HOR-01 Vista semanal (día × hora) agrupada por materia, salón y bloque.
- RF-HOR-02 Sincronización del horario institucional (adaptador mock) con detección de cambios.
- RF-HOR-03 Detalle de clase (materia, docente, bloque, piso, aula, franja).
- RF-HOR-04 Exportar a `.ics` y PDF.
- RF-HOR-05 Reflejo de adiciones/cancelaciones/cambios vía sincronización (máx. 24 h; job periódico + disparo manual por admin).
- Reglas: RRF-01 (solo matrícula vigente), RRF-02 (horario oficial único, sin edición manual), RRF-04 (privacidad), RRF-07 (cambios solo por sincronización).
- Auditoría de la sincronización y de consultas de terceros por admin (RNF-14).
- Soporte mínimo: login con usuarios semilla (estudiante, admin) y JWT 60 min; RBAC básico.

**Fuera (iteraciones futuras):** registro/OTP/recuperación, huecos, notificaciones (el evento `ScheduleChanged` se emite y se registra; no se consume), búsqueda/filtros, CRUD de facultades, gestión de roles, Brevo.

## Stack
- **Frontend:** React + Vite + TypeScript, React Router. Responsive desde 320px, WCAG 2.1 AA, tokens de diseño institucionales.
- **Backend:** Node + Express + TypeScript, Prisma, PostgreSQL, zod, helmet, CORS, argon2, jsonwebtoken, pdfkit (PDF), generador `.ics` propio.
- **Jobs:** `node-cron` (sincronización periódica).
- **Pruebas:** Vitest + Supertest; cobertura mínima 70% en backend (RNF-11).
- **Operación:** Docker Compose (postgres, backend, frontend/nginx). Backend sin estado.

## Arquitectura
Monolito modular, **hexagonal ligera** (puertos y adaptadores). Regla de dependencia: `http → application → domain`; `infrastructure` implementa los puertos definidos en `application`.

```
backend/src/
  modules/
    schedule/
      domain/          ClassSession, ScheduleDiff, reglas puras
      application/     casos de uso + puertos (ScheduleRepository, InstitutionalPort, EventBus, ExporterPort)
      infrastructure/  PrismaScheduleRepository, MockInstitutionalAdapter, IcsExporter, PdfExporter
      http/            routes, controllers, schemas zod
    auth/              (soporte mínimo) login, JWT, RBAC
    audit/             AuditLog (decorator + repositorio)
  shared/              container.ts (DI manual), eventBus, config, errors
  jobs/                syncJob.ts
frontend/src/
  features/schedule/   WeeklyCalendar, ClassDetail, ExportMenu, hooks
  features/auth/       LoginPage, AuthContext
  shared/              api client (interceptor), tokens CSS, ProtectedRoute
```

## Patrones de diseño
| Patrón | Dónde | Requisito |
|---|---|---|
| Repository | `ScheduleRepository`, `UserRepository` tras interfaces | pruebas con repos en memoria |
| Adapter | `InstitutionalPort` ↔ `MockInstitutionalAdapter` (real a futuro) | RF-HOR-02, RRF-07 |
| Template Method | `BaseExporter` → `IcsExporter`, `PdfExporter` | RF-HOR-04 |
| Observer / Domain Events | `ScheduleChanged` emitido tras sincronizar; listener de auditoría/log | RF-HOR-05, RNF-14 |
| Facade | `SyncScheduleUseCase` orquesta adapter → diff → persistencia → eventos | RF-HOR-02/05 |
| Chain of Responsibility | middlewares auth → RBAC → validación | RNF-05, RNF-06 |
| Decorator | `withAudit(useCase)` para auditoría transversal | RNF-14, no repudio |
| Dependency Injection | `container.ts` (composición manual) | pruebas, bajo acoplamiento |
| Singleton | cliente Prisma, config | pool único |

Frontend: feature-based, container/presentational con custom hooks, Context+Provider para sesión, ProtectedRoute, API client con interceptor.

## Modelo de datos (Prisma)
`User` (id, nombre, email único, passwordHash, rol, activo), `Enrollment` (user, semestre, vigente), `Course` (código, nombre), `ClassSession` (course, día, inicio, fin, bloque, piso, aula, docente, semestre, estado ACTIVA/CANCELADA, externalId único), `ScheduleChange` (session, tipo ADDED/UPDATED/CANCELLED, antes/después, fecha), `SyncRun` (inicio, fin, resultado, disparador), `AuditLog` (user, acción, entidad, detalle, fecha). Índices por `(userId, semestre, día)`.

## API
- Todas las rutas con prefijo `/api`.
- `POST /auth/login`, `POST /auth/logout`
- `GET /schedule/me` — horario semanal del semestre activo (RF-HOR-01)
- `GET /schedule/users/:userId` — solo admin; queda auditado (RRF-04)
- `GET /schedule/sessions/:id` — detalle (RF-HOR-03)
- `GET /schedule/me/export?format=ics|pdf` (RF-HOR-04)
- `POST /admin/sync` — dispara sincronización (RF-HOR-02/05); `GET /admin/sync/runs`
- Ninguna ruta permite crear/editar/borrar sesiones (RRF-02/07): el único escritor es `SyncScheduleUseCase`.

## Reglas clave
- Sincronización solo para estudiantes con matrícula vigente (RRF-01). Compara estado institucional vs. local y produce un `ScheduleDiff` (added/updated/cancelled); persiste en transacción y emite `ScheduleChanged`.
- Un estudiante solo ve su horario; admin consulta terceros con registro de auditoría.
- Cada sincronización y cada acceso de admin a terceros genera `AuditLog` con usuario, acción y fecha.

## No funcionales aplicados
Respuesta <2 s con índices (RNF-01); sin estado para escalar (RNF-10); argon2 y JWT 60 min (RNF-04/05); RBAC (RNF-06); responsive 320px+, navegación por teclado, ARIA y contraste AA (RNF-08/09); home muestra el horario de hoy; ver horario ≤2 clics; cobertura ≥70% (RNF-11).

## Supuestos
- Datos semilla: 1 admin, 2–3 estudiantes, ~6 materias por estudiante, con matrícula vigente.
- Mock institucional con escenarios deterministas para demostrar cambios de aula/bloque/cancelación.
- Pruebas de carga y uptime documentadas, no automatizadas.
