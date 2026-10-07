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

### Variables de entorno (`backend/.env`)

| Variable | Descripción | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (local: 5432; docker-compose publica el suyo en el **5433** del host) | `postgresql://horario:horario@localhost:5432/horario` |
| `JWT_SECRET` | Secreto de firma. En `NODE_ENV=production` se exigen ≥ 32 caracteres | `cambia-esto-en-produccion` |
| `PORT` | Puerto del API | `4000` |
| `CORS_ORIGIN` | Origen permitido del frontend | `http://localhost:5173` |
| `ACTIVE_SEMESTER`, `SEMESTER_START`, `SEMESTER_WEEKS` | Semestre activo (y base del `.ics`) | `2026-2`, `2026-08-03`, `16` |
| `SYNC_CRON` | Cron de sincronización automática | `0 3 * * *` |
| `SYNC_CONCURRENCY` | Estudiantes sincronizados en paralelo | `5` |
| `TRUST_PROXY` | Nº de proxies de confianza (`trust proxy`); `1` en Docker (nginx) para que rate-limit y auditoría vean la IP real | `0` |
| `SEED_PASSWORD` | Contraseña de los usuarios semilla | `Cambiar123!` |

## Docker

```bash
docker compose up --build        # postgres + backend + frontend + backup
```

- Aplicación: <http://localhost:8080> (nginx sirve el frontend y proxea `/api/` al backend).
- PostgreSQL se publica en el puerto **5433** del host (nunca 5432, para no chocar con un Postgres local).
- El backend ejecuta `prisma migrate deploy` al arrancar. En producción exige `JWT_SECRET` de ≥ 32 caracteres; el compose trae un valor por defecto solo de desarrollo, sobrescríbalo con `JWT_SECRET=... docker compose up`.
- `backup` escribe un `pg_dump` diario en `./backups/horario-AAAA-MM-DD.sql` (RNF-15, RPO ≤ 24 h) de forma atómica (archivo temporal y `mv` solo si el dump termina bien, así un fallo no pisa una copia buena) y borra copias de más de 14 días. `backend` y `backup` usan `restart: unless-stopped`. `backups/` está en `.gitignore`.
- Apagar y borrar contenedores y volumen: `docker compose down -v`.

### Sembrar datos en Docker

La imagen de producción no incluye `tsx`; el build compila el seed a JS (`dist-seed/`). Dos opciones equivalentes:

```bash
# a) dentro del contenedor del backend
docker compose exec backend npm run seed:prod

# b) desde el host, contra el Postgres del compose (puerto 5433)
cd backend && DATABASE_URL=postgresql://horario:horario@localhost:5433/horario npm run seed
```

El seed es idempotente (upsert de usuarios y matrículas) y hace la sincronización inicial.

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
| Observer / Domain Events | `shared/eventBus.ts` (`ScheduleChanged`), `modules/audit/auditListener.ts` |
| Facade | `schedule/application/SyncSchedule.ts` (adaptador → diff → persistencia → eventos) |
| Chain of Responsibility | Cadena de middlewares Express: `shared/http/app.ts`, `auth.ts` (`authenticate` → `requireRole`), `errorHandler.ts` |
| Decorator | `shared/audit.ts` (`withAudit`), aplicado en `shared/container.ts` |
| Dependency Injection | `shared/container.ts` (`buildContainer`), cableado en `main.ts` (`wire`) |
| Singleton | `shared/prisma.ts` (un `PrismaClient` por proceso) |

## Adaptador institucional mock y cómo sustituirlo

Los datos académicos vienen del puerto `InstitutionalPort` (`backend/src/modules/schedule/application/ports.ts`). Hoy lo implementa `MockInstitutionalAdapter`: la primera consulta devuelve el horario base y las siguientes devuelven cambios (ALG101 pasa a bloque B/aula 305, desaparece PHY201, aparece LAB301), útil para probar la detección de cambios.

Para integrar el sistema real: crear una clase que implemente `InstitutionalPort` (p. ej. `UniApiAdapter`) y cambiar la instancia en `wire()` de `backend/src/main.ts`. Ni los casos de uso ni las rutas cambian.

## Fuera de alcance de esta iteración

Registro de usuarios / OTP, detección de huecos, notificaciones (el evento `ScheduleChanged` se emite y audita, pero no se envía), búsqueda, CRUD de facultades/programas e integración con Brevo.

## Pruebas

```bash
cd backend  && npm test && npm run test:cov     # 57 tests; cobertura ≈ 97 % líneas
cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run build
```

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
