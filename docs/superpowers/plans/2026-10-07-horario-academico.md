# Horario UNI — Módulo Horario Académico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo de Horario Académico (RF-HOR-01..05) de Horario UNI: backend Node hexagonal + frontend React, con login mínimo, sincronización institucional (mock), exportación `.ics`/PDF, privacidad y auditoría.

**Architecture:** Monolito modular hexagonal. `http → application → domain`; `infrastructure` implementa los puertos (Repository, Adapter, EventBus, Exporter). Composición manual en `shared/container.ts`. Frontend feature-based con Context de sesión y API client.

**Tech Stack:** Node 20, Express 4, TypeScript, Prisma 5 + PostgreSQL, zod 3, argon2, jsonwebtoken, pdfkit, node-cron, Vitest + Supertest; React 18 + Vite + TypeScript + React Router 6 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-07-horario-uni-design.md`

## Global Constraints

- Idioma de UI y mensajes de error: español.
- JWT con expiración de 60 min (RNF-05); contraseñas con argon2 (RNF-04); nunca en texto plano.
- Horario solo se escribe vía `SyncScheduleUseCase` (RRF-02, RRF-07): ninguna ruta crea/edita/borra sesiones.
- Estudiante solo ve su horario; admin puede ver el de terceros y queda auditado (RRF-04, RNF-14).
- Solo se sincronizan estudiantes con matrícula vigente (RRF-01).
- Rutas bajo prefijo `/api`.
- Cobertura mínima 70% en backend (RNF-11).
- Interfaz responsive desde 320px, WCAG 2.1 AA (contraste, teclado, ARIA) (RNF-08/09).
- Home muestra el horario de hoy sin navegación adicional; ver horario ≤ 2 clics.
- Semestre activo por config `ACTIVE_SEMESTER` (por defecto `2026-2`), inicio `SEMESTER_START=2026-08-03` (lunes), `SEMESTER_WEEKS=16`.
- Días ISO: 1=lunes … 7=domingo. Horas `"HH:mm"` 24 h.
- Todos los IDs de entidad son UUID (`@default(uuid()) @db.Uuid`). Excepción: `actorId` en `AuditLog`/`SyncRun` es texto libre porque admite actores no-usuario (`system`, `seed`). Los IDs recibidos por HTTP (`:userId`, `?userId=`) se validan como UUID con zod (400 si no lo son).
- La carpeta no es un repo git: la Task 1 hace `git init`.

## File Structure

```
HorarioAQ/
  docker-compose.yml  README.md  .gitignore
  backend/
    package.json tsconfig.json vitest.config.ts .env.example Dockerfile
    prisma/schema.prisma  prisma/seed.ts
    src/
      main.ts
      shared/ errors.ts config.ts ports.ts eventBus.ts audit.ts container.ts http/{app.ts,auth.ts,asyncHandler.ts,errorHandler.ts}
      modules/
        auth/
          application/ ports.ts Login.ts Logout.ts
          infrastructure/ JwtTokenService.ts Argon2Hasher.ts PrismaUserRepository.ts PrismaRevokedTokenRepository.ts
          http/ authRoutes.ts
        schedule/
          domain/ types.ts diff.ts access.ts sort.ts
          application/ ports.ts SyncSchedule.ts GetWeeklySchedule.ts GetSessionDetail.ts ExportSchedule.ts
          infrastructure/ PrismaScheduleRepository.ts PrismaEnrollmentRepository.ts PrismaSyncRunRepository.ts MockInstitutionalAdapter.ts exporters/{BaseExporter.ts,IcsExporter.ts,PdfExporter.ts}
          http/ scheduleRoutes.ts adminRoutes.ts
        audit/ PrismaAuditLog.ts auditListener.ts
      jobs/ syncJob.ts
    tests/ (espejo de src) + helpers/inMemory.ts
  frontend/
    package.json vite.config.ts tsconfig.json index.html Dockerfile nginx.conf
    src/
      main.tsx App.tsx
      shared/ api.ts tokens.css app.css ProtectedRoute.tsx Layout.tsx
      features/auth/ AuthContext.tsx LoginPage.tsx
      features/schedule/ types.ts grid.ts WeeklyCalendar.tsx AgendaList.tsx ClassDetail.tsx ExportMenu.tsx useSchedule.ts SchedulePage.tsx
      features/admin/ AdminPage.tsx
```

---

### Task 1: Scaffold del backend, esquema Prisma y Postgres

**Files:**
- Create: `.gitignore`, `docker-compose.yml`, `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/.env.example`, `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: proyecto `backend` con `npm test`, base Postgres en `localhost:5432` (usuario/clave/db `horario`), tablas Prisma `User, Enrollment, ClassSession, ScheduleChange, SyncRun, AuditLog, RevokedToken`.

- [ ] **Step 1: Inicializar git y gitignore**

```bash
cd /Users/dilanrojascarmona/Desktop/HorarioAQ && git init
printf "node_modules\ndist\n.env\ncoverage\nbackups\n*.log\n" > .gitignore
```

- [ ] **Step 2: `docker-compose.yml` (solo Postgres por ahora; Task 10 lo amplía)**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: horario
      POSTGRES_PASSWORD: horario
      POSTGRES_DB: horario
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```

- [ ] **Step 3: `backend/package.json`**

```json
{
  "name": "horario-uni-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "prisma generate && tsc -p .",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:cov": "vitest run --coverage",
    "seed": "tsx prisma/seed.ts",
    "migrate": "prisma migrate dev"
  }
}
```

Instalar:

```bash
cd backend
npm i express@4 cors helmet express-rate-limit zod@3 argon2 jsonwebtoken pdfkit node-cron @prisma/client@5
npm i -D typescript tsx prisma@5 vitest@2 @vitest/coverage-v8@2 supertest @types/express@4 @types/cors @types/node @types/jsonwebtoken @types/pdfkit @types/supertest @types/node-cron
```

- [ ] **Step 4: `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Excluidos: arranque, jobs y adaptadores que requieren Postgres real.
      exclude: ['src/main.ts', 'src/jobs/**', 'src/**/Prisma*.ts', 'src/**/Argon2Hasher.ts'],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 },
    },
  },
});
```

- [ ] **Step 6: `backend/.env.example`** (copiar a `.env`)

```
DATABASE_URL=postgresql://horario:horario@localhost:5432/horario
JWT_SECRET=cambia-esto-en-produccion
PORT=4000
CORS_ORIGIN=http://localhost:5173
ACTIVE_SEMESTER=2026-2
SEMESTER_START=2026-08-03
SEMESTER_WEEKS=16
SYNC_CRON=0 3 * * *
SYNC_CONCURRENCY=5
SEED_PASSWORD=Cambiar123!
```

- [ ] **Step 7: `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  STUDENT
  ADMIN
}

model User {
  id           String        @id @default(uuid()) @db.Uuid
  name         String
  email        String        @unique
  passwordHash String
  role         Role          @default(STUDENT)
  active       Boolean       @default(true)
  enrollments  Enrollment[]
  sessions     ClassSession[]
}

model Enrollment {
  id       String  @id @default(uuid()) @db.Uuid
  userId   String  @db.Uuid
  semester String
  active   Boolean @default(true)
  user     User    @relation(fields: [userId], references: [id])

  @@unique([userId, semester])
}

model ClassSession {
  id         String @id @default(uuid()) @db.Uuid
  externalId String
  userId     String @db.Uuid
  semester   String
  courseCode String
  courseName String
  teacher    String
  weekday    Int
  startTime  String
  endTime    String
  block      String
  floor      Int
  room       String
  status     String @default("ACTIVE")
  user       User   @relation(fields: [userId], references: [id])

  @@unique([userId, externalId])
  @@index([userId, semester, weekday])
}

model ScheduleChange {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @db.Uuid
  externalId String
  type       String
  before     Json?
  after      Json?
  createdAt  DateTime @default(now())

  @@index([userId, createdAt])
}

model SyncRun {
  id             String    @id @default(uuid()) @db.Uuid
  trigger        String
  actorId        String?
  startedAt      DateTime  @default(now())
  finishedAt     DateTime?
  studentsSynced Int       @default(0)
  changesCount   Int       @default(0)
  status         String    @default("RUNNING")
}

model AuditLog {
  id        String   @id @default(uuid()) @db.Uuid
  actorId   String?
  action    String
  entity    String
  detail    Json?
  createdAt DateTime @default(now())

  @@index([createdAt])
}

model RevokedToken {
  jti       String   @id
  expiresAt DateTime
}
```

- [ ] **Step 8: Levantar Postgres, migrar y commit**

```bash
cd /Users/dilanrojascarmona/Desktop/HorarioAQ && docker compose up -d postgres
cd backend && cp .env.example .env && npx prisma migrate dev --name init
cd .. && git add -A && git commit -m "chore: scaffold backend, prisma schema, postgres"
```
Expected: migración `init` aplicada sin errores.

---

### Task 2: Núcleo compartido y dominio puro

**Files:**
- Create: `backend/src/shared/{errors,config,ports,eventBus,audit}.ts`, `backend/src/modules/schedule/domain/{types,diff,access,sort}.ts`
- Test: `backend/tests/shared/{eventBus,audit}.test.ts`, `backend/tests/schedule/domain/{diff,access,sort}.test.ts`

**Interfaces:**
- Produces:
  - `AppError(status, code, message)`; fábricas `badRequest(m)`, `unauthorized(m)`, `forbidden(m)`, `notFound(m)`.
  - `config` (objeto) con `port, jwtSecret, corsOrigin, semester, semesterStart, semesterWeeks, syncCron, syncConcurrency`.
  - `UseCase<I,O> { execute(input: I): Promise<O> }`, `AuditEntry`, `AuditPort.record(e)`, `DomainEvent`, `EventBus {publish, subscribe}`.
  - `InMemoryEventBus`, `withAudit(audit, action, uc, opts)`.
  - Dominio: `Role`, `Weekday`, `ClassSession`, `ChangeType`, `ScheduleChange`, `diffSchedules(local, remote)`, `assertCanView(requester, targetUserId)`, `sortSessions(sessions)`, `activeSessions(sessions)`.

- [ ] **Step 1: Código compartido**

`backend/src/shared/errors.ts`:
```ts
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (m = 'Solicitud inválida') => new AppError(400, 'BAD_REQUEST', m);
export const unauthorized = (m = 'No autenticado') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'Acceso denegado') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'No encontrado') => new AppError(404, 'NOT_FOUND', m);
```

`backend/src/shared/config.ts`:
```ts
const env = process.env;
export const config = {
  port: Number(env.PORT ?? 4000),
  jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
  corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  semester: env.ACTIVE_SEMESTER ?? '2026-2',
  semesterStart: env.SEMESTER_START ?? '2026-08-03',
  semesterWeeks: Number(env.SEMESTER_WEEKS ?? 16),
  syncCron: env.SYNC_CRON ?? '0 3 * * *',
  syncConcurrency: Number(env.SYNC_CONCURRENCY ?? 5),
};
export type Config = typeof config;
```

`backend/src/shared/ports.ts`:
```ts
export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
export interface AuditEntry {
  actorId?: string;
  action: string;
  entity: string;
  detail?: unknown;
}
export interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
}
export interface DomainEvent {
  type: string;
  [key: string]: unknown;
}
export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(type: string, handler: (event: DomainEvent) => void | Promise<void>): void;
}
```

`backend/src/shared/eventBus.ts`:
```ts
import { DomainEvent, EventBus } from './ports';

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Array<(e: DomainEvent) => void | Promise<void>>>();

  subscribe(type: string, handler: (e: DomainEvent) => void | Promise<void>) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  publish(event: DomainEvent) {
    for (const h of this.handlers.get(event.type) ?? []) {
      Promise.resolve()
        .then(() => h(event))
        .catch((err) => console.error(`[eventBus] handler de ${event.type} falló:`, err));
    }
  }
}
```

`backend/src/shared/audit.ts` (Decorator):
```ts
import { AuditPort, UseCase } from './ports';

export interface AuditOptions<I, O> {
  entity: string;
  actorOf: (input: I) => string | undefined;
  detailOf?: (input: I, output: O) => unknown;
  shouldAudit?: (input: I) => boolean;
}

export function withAudit<I, O>(
  audit: AuditPort,
  action: string,
  inner: UseCase<I, O>,
  opts: AuditOptions<I, O>,
): UseCase<I, O> {
  return {
    async execute(input: I): Promise<O> {
      const output = await inner.execute(input);
      if (!opts.shouldAudit || opts.shouldAudit(input)) {
        await audit.record({
          actorId: opts.actorOf(input),
          action,
          entity: opts.entity,
          detail: opts.detailOf?.(input, output),
        });
      }
      return output;
    },
  };
}
```

- [ ] **Step 2: Tests de compartido (fallan primero)**

`backend/tests/shared/eventBus.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus } from '../../src/shared/eventBus';

describe('InMemoryEventBus', () => {
  it('entrega el evento a los suscriptores del tipo', async () => {
    const bus = new InMemoryEventBus();
    const h = vi.fn();
    bus.subscribe('X', h);
    bus.publish({ type: 'X', n: 1 });
    bus.publish({ type: 'Y' });
    await new Promise((r) => setTimeout(r, 0));
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({ type: 'X', n: 1 });
  });

  it('un handler que falla no rompe al publicador', async () => {
    const bus = new InMemoryEventBus();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.subscribe('X', () => { throw new Error('boom'); });
    expect(() => bus.publish({ type: 'X' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(err).toHaveBeenCalled();
  });
});
```

`backend/tests/shared/audit.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { withAudit } from '../../src/shared/audit';

describe('withAudit', () => {
  const inner = { execute: vi.fn(async (n: number) => n * 2) };

  it('registra auditoría tras ejecutar el caso de uso', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const uc = withAudit(audit, 'DOBLAR', inner, {
      entity: 'num', actorOf: () => 'u1', detailOf: (i, o) => ({ i, o }),
    });
    expect(await uc.execute(2)).toBe(4);
    expect(audit.record).toHaveBeenCalledWith({ actorId: 'u1', action: 'DOBLAR', entity: 'num', detail: { i: 2, o: 4 } });
  });

  it('respeta shouldAudit=false', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const uc = withAudit(audit, 'A', inner, { entity: 'e', actorOf: () => 'u', shouldAudit: () => false });
    await uc.execute(1);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no audita si el caso de uso lanza', async () => {
    const audit = { record: vi.fn(async () => {}) };
    const failing = { execute: async () => { throw new Error('x'); } };
    const uc = withAudit(audit, 'A', failing, { entity: 'e', actorOf: () => 'u' });
    await expect(uc.execute(1)).rejects.toThrow('x');
    expect(audit.record).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Ejecutar** `cd backend && npx vitest run tests/shared` → debe pasar (el código ya existe; si algún test falla, corregir).

- [ ] **Step 4: Dominio**

`backend/src/modules/schedule/domain/types.ts`:
```ts
export type Role = 'STUDENT' | 'ADMIN';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SessionStatus = 'ACTIVE' | 'CANCELLED';

export interface ClassSession {
  externalId: string;
  userId: string;
  semester: string;
  courseCode: string;
  courseName: string;
  teacher: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  block: string;
  floor: number;
  room: string;
  status: SessionStatus;
}

export type ChangeType = 'ADDED' | 'UPDATED' | 'CANCELLED';

export interface ScheduleChange {
  type: ChangeType;
  externalId: string;
  userId: string;
  before?: ClassSession;
  after?: ClassSession;
}
```

`backend/src/modules/schedule/domain/diff.ts`:
```ts
import { ClassSession, ScheduleChange } from './types';

const FIELDS: Array<keyof ClassSession> = [
  'courseCode', 'courseName', 'teacher', 'weekday', 'startTime', 'endTime',
  'block', 'floor', 'room', 'status',
];

const sameContent = (a: ClassSession, b: ClassSession) => FIELDS.every((f) => a[f] === b[f]);

export function diffSchedules(local: ClassSession[], remote: ClassSession[]): ScheduleChange[] {
  const localMap = new Map(local.map((s) => [s.externalId, s]));
  const remoteMap = new Map(remote.map((s) => [s.externalId, s]));
  const changes: ScheduleChange[] = [];

  for (const r of remote) {
    const l = localMap.get(r.externalId);
    if (!l) {
      if (r.status === 'ACTIVE') changes.push({ type: 'ADDED', externalId: r.externalId, userId: r.userId, after: r });
    } else if (l.status === 'ACTIVE' && r.status === 'CANCELLED') {
      changes.push({ type: 'CANCELLED', externalId: r.externalId, userId: r.userId, before: l, after: r });
    } else if (!sameContent(l, r)) {
      changes.push({ type: 'UPDATED', externalId: r.externalId, userId: r.userId, before: l, after: r });
    }
  }

  for (const l of local) {
    if (l.status === 'ACTIVE' && !remoteMap.has(l.externalId)) {
      changes.push({
        type: 'CANCELLED', externalId: l.externalId, userId: l.userId,
        before: l, after: { ...l, status: 'CANCELLED' },
      });
    }
  }
  return changes;
}
```

`backend/src/modules/schedule/domain/access.ts`:
```ts
import { forbidden } from '../../../shared/errors';
import { Role } from './types';

export function assertCanView(requester: { id: string; role: Role }, targetUserId: string): void {
  if (requester.id === targetUserId) return;
  if (requester.role === 'ADMIN') return;
  throw forbidden('Solo puedes consultar tu propio horario');
}
```

`backend/src/modules/schedule/domain/sort.ts`:
```ts
import { ClassSession } from './types';

export const activeSessions = (s: ClassSession[]) => s.filter((x) => x.status === 'ACTIVE');

export const sortSessions = (s: ClassSession[]) =>
  [...s].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
```

- [ ] **Step 5: Tests de dominio**

`backend/tests/schedule/domain/diff.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { diffSchedules } from '../../../src/modules/schedule/domain/diff';
import { ClassSession } from '../../../src/modules/schedule/domain/types';

const mk = (over: Partial<ClassSession> = {}): ClassSession => ({
  externalId: 'u1-ALG-1', userId: 'u1', semester: '2026-2', courseCode: 'ALG', courseName: 'Algoritmos',
  teacher: 'Marta', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201',
  status: 'ACTIVE', ...over,
});

describe('diffSchedules', () => {
  it('sin diferencias devuelve []', () => {
    expect(diffSchedules([mk()], [mk()])).toEqual([]);
  });
  it('detecta ADDED', () => {
    const c = diffSchedules([], [mk()]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ type: 'ADDED', externalId: 'u1-ALG-1' });
  });
  it('ignora sesiones remotas ya canceladas que no existen localmente', () => {
    expect(diffSchedules([], [mk({ status: 'CANCELLED' })])).toEqual([]);
  });
  it('detecta UPDATED (cambio de aula y bloque)', () => {
    const c = diffSchedules([mk()], [mk({ room: '305', block: 'B' })]);
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe('UPDATED');
    expect(c[0].before?.room).toBe('201');
    expect(c[0].after?.room).toBe('305');
  });
  it('detecta CANCELLED cuando falta en remoto', () => {
    const c = diffSchedules([mk()], []);
    expect(c[0]).toMatchObject({ type: 'CANCELLED' });
    expect(c[0].after?.status).toBe('CANCELLED');
  });
  it('detecta CANCELLED cuando remoto la marca cancelada', () => {
    const c = diffSchedules([mk()], [mk({ status: 'CANCELLED' })]);
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe('CANCELLED');
  });
  it('local cancelada y ausente en remoto no genera cambio', () => {
    expect(diffSchedules([mk({ status: 'CANCELLED' })], [])).toEqual([]);
  });
  it('reactivación se reporta como UPDATED', () => {
    const c = diffSchedules([mk({ status: 'CANCELLED' })], [mk()]);
    expect(c[0].type).toBe('UPDATED');
  });
});
```

`backend/tests/schedule/domain/access.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { assertCanView } from '../../../src/modules/schedule/domain/access';

describe('assertCanView', () => {
  it('permite ver el propio horario', () => {
    expect(() => assertCanView({ id: 'a', role: 'STUDENT' }, 'a')).not.toThrow();
  });
  it('estudiante no puede ver a otro', () => {
    expect(() => assertCanView({ id: 'a', role: 'STUDENT' }, 'b')).toThrow(/propio horario/);
  });
  it('admin puede ver a otro', () => {
    expect(() => assertCanView({ id: 'x', role: 'ADMIN' }, 'b')).not.toThrow();
  });
});
```

`backend/tests/schedule/domain/sort.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sortSessions, activeSessions } from '../../../src/modules/schedule/domain/sort';
import { ClassSession } from '../../../src/modules/schedule/domain/types';

const s = (weekday: number, startTime: string, status = 'ACTIVE') =>
  ({ weekday, startTime, status, externalId: `${weekday}${startTime}` }) as unknown as ClassSession;

describe('sort', () => {
  it('ordena por día y hora', () => {
    const r = sortSessions([s(2, '08:00'), s(1, '14:00'), s(1, '08:00')]);
    expect(r.map((x) => x.externalId)).toEqual(['108:00', '114:00', '208:00']);
  });
  it('activeSessions filtra canceladas', () => {
    expect(activeSessions([s(1, '08:00'), s(1, '09:00', 'CANCELLED')])).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Ejecutar y commit**

```bash
cd backend && npx vitest run
cd .. && git add -A && git commit -m "feat: shared core (errors, event bus, audit decorator) and schedule domain"
```
Expected: todos PASS.

---

### Task 3: Puertos y casos de uso del horario (Sync, Semanal, Detalle)

**Files:**
- Create: `backend/src/modules/auth/application/ports.ts`, `backend/src/modules/schedule/application/{ports,SyncSchedule,GetWeeklySchedule,GetSessionDetail}.ts`, `backend/tests/helpers/inMemory.ts`
- Test: `backend/tests/schedule/application/{SyncSchedule,GetWeeklySchedule,GetSessionDetail}.test.ts`

**Interfaces:**
- Consumes: Task 2 (`ClassSession`, `diffSchedules`, `assertCanView`, `UseCase`, `EventBus`, `notFound`).
- Produces:
  - `schedule/application/ports.ts`: `ScheduleRepository { findByUser(userId, semester): Promise<ClassSession[]>; findOne(userId, externalId): Promise<ClassSession|null>; applyChanges(userId, semester, changes: ScheduleChange[]): Promise<void> }`, `EnrollmentRepository { listActiveStudentIds(semester): Promise<string[]>; hasActive(userId, semester): Promise<boolean> }`, `InstitutionalPort { fetchSchedule(userId, semester): Promise<ClassSession[]> }`, `SyncRunRecord`, `SyncRunRepository { start(trigger, actorId?): Promise<{id}>; finish(id, r: {status:'OK'|'FAILED'; studentsSynced; changesCount}): Promise<void>; list(limit): Promise<SyncRunRecord[]> }`.
  - `auth/application/ports.ts`: `User`, `UserRepository`, `PasswordHasher`, `TokenPayload`, `TokenService`, `RevokedTokenRepository`.
  - `SyncScheduleUseCase(deps: {schedules, enrollments, institutional, syncRuns, bus}, opts:{semester, concurrency})`, `execute({trigger:'MANUAL'|'CRON', actorId?}) → {runId, studentsSynced, changesCount}`. Publica `{type:'ScheduleChanged', userId, semester, changes}`.
  - `GetWeeklyScheduleUseCase(schedules, enrollments, semester)`, `execute({requesterId, requesterRole, targetUserId?}) → {userId, semester, enrolled, sessions}` (solo ACTIVE, ordenadas).
  - `GetSessionDetailUseCase(schedules)`, `execute({requesterId, requesterRole, externalId, ownerId?}) → ClassSession`.
  - `tests/helpers/inMemory.ts`: `InMemoryScheduleRepo`, `InMemoryEnrollmentRepo`, `FakeInstitutional`, `InMemorySyncRuns`, `InMemoryUsers`, `InMemoryRevoked`, `FakeHasher`, `FakeTokens`, `RecordingAudit`, `session(over?)` fábrica.

- [ ] **Step 1: Puertos**

`backend/src/modules/schedule/application/ports.ts`:
```ts
import { ClassSession, ScheduleChange } from '../domain/types';

export interface ScheduleRepository {
  findByUser(userId: string, semester: string): Promise<ClassSession[]>;
  findOne(userId: string, externalId: string): Promise<ClassSession | null>;
  applyChanges(userId: string, semester: string, changes: ScheduleChange[]): Promise<void>;
}

export interface EnrollmentRepository {
  listActiveStudentIds(semester: string): Promise<string[]>;
  hasActive(userId: string, semester: string): Promise<boolean>;
}

export interface InstitutionalPort {
  fetchSchedule(userId: string, semester: string): Promise<ClassSession[]>;
}

export interface SyncRunRecord {
  id: string;
  trigger: string;
  actorId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  studentsSynced: number;
  changesCount: number;
  status: string;
}

export interface SyncRunRepository {
  start(trigger: string, actorId?: string): Promise<{ id: string }>;
  finish(id: string, r: { status: 'OK' | 'FAILED'; studentsSynced: number; changesCount: number }): Promise<void>;
  list(limit: number): Promise<SyncRunRecord[]>;
}
```

`backend/src/modules/auth/application/ports.ts`:
```ts
import { Role } from '../../schedule/domain/types';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
}
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
export interface TokenPayload {
  sub: string;
  role: Role;
  jti: string;
  exp: number;
}
export interface TokenService {
  sign(user: { id: string; role: Role }): string;
  verify(token: string): TokenPayload; // lanza unauthorized si es inválido/expirado
}
export interface RevokedTokenRepository {
  revoke(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
```

- [ ] **Step 2: Helper en memoria `backend/tests/helpers/inMemory.ts`**

```ts
import { ClassSession, ScheduleChange } from '../../src/modules/schedule/domain/types';
import {
  EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRecord, SyncRunRepository,
} from '../../src/modules/schedule/application/ports';
import {
  PasswordHasher, RevokedTokenRepository, TokenPayload, TokenService, User, UserRepository,
} from '../../src/modules/auth/application/ports';
import { AuditEntry, AuditPort } from '../../src/shared/ports';
import { unauthorized } from '../../src/shared/errors';

export const session = (over: Partial<ClassSession> = {}): ClassSession => ({
  externalId: 'u1-ALG-1', userId: 'u1', semester: '2026-2', courseCode: 'ALG', courseName: 'Algoritmos',
  teacher: 'Marta', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201',
  status: 'ACTIVE', ...over,
});

export class InMemoryScheduleRepo implements ScheduleRepository {
  rows: ClassSession[] = [];
  appliedChanges: ScheduleChange[] = [];
  async findByUser(userId: string, semester: string) {
    return this.rows.filter((r) => r.userId === userId && r.semester === semester);
  }
  async findOne(userId: string, externalId: string) {
    return this.rows.find((r) => r.userId === userId && r.externalId === externalId) ?? null;
  }
  async applyChanges(userId: string, _semester: string, changes: ScheduleChange[]) {
    for (const c of changes) {
      this.rows = this.rows.filter((r) => !(r.userId === userId && r.externalId === c.externalId));
      if (c.after) this.rows.push(c.after);
      this.appliedChanges.push(c);
    }
  }
}

export class InMemoryEnrollmentRepo implements EnrollmentRepository {
  constructor(public active: string[] = []) {}
  async listActiveStudentIds() { return this.active; }
  async hasActive(userId: string) { return this.active.includes(userId); }
}

export class FakeInstitutional implements InstitutionalPort {
  data = new Map<string, ClassSession[]>();
  calls = 0;
  async fetchSchedule(userId: string) { this.calls++; return this.data.get(userId) ?? []; }
}

export class InMemorySyncRuns implements SyncRunRepository {
  runs: SyncRunRecord[] = [];
  async start(trigger: string, actorId?: string) {
    const rec: SyncRunRecord = {
      id: `run${this.runs.length + 1}`, trigger, actorId: actorId ?? null,
      startedAt: new Date(), finishedAt: null, studentsSynced: 0, changesCount: 0, status: 'RUNNING',
    };
    this.runs.push(rec);
    return { id: rec.id };
  }
  async finish(id: string, r: { status: 'OK' | 'FAILED'; studentsSynced: number; changesCount: number }) {
    Object.assign(this.runs.find((x) => x.id === id)!, r, { finishedAt: new Date() });
  }
  async list(limit: number) { return this.runs.slice(-limit).reverse(); }
}

export class InMemoryUsers implements UserRepository {
  constructor(public users: User[] = []) {}
  async findByEmail(email: string) { return this.users.find((u) => u.email === email) ?? null; }
  async findById(id: string) { return this.users.find((u) => u.id === id) ?? null; }
}

export class InMemoryRevoked implements RevokedTokenRepository {
  set = new Set<string>();
  async revoke(jti: string) { this.set.add(jti); }
  async isRevoked(jti: string) { return this.set.has(jti); }
}

export class FakeHasher implements PasswordHasher {
  async hash(p: string) { return `hash:${p}`; }
  async verify(h: string, p: string) { return h === `hash:${p}`; }
}

/** Tokens "tok:<id>:<ROLE>:<jti>" — sin criptografía, solo para pruebas. */
export class FakeTokens implements TokenService {
  private n = 0;
  sign(u: { id: string; role: 'STUDENT' | 'ADMIN' }) { return `tok:${u.id}:${u.role}:j${++this.n}`; }
  verify(token: string): TokenPayload {
    const [p, sub, role, jti] = token.split(':');
    if (p !== 'tok') throw unauthorized('Token inválido');
    return { sub, role: role as 'STUDENT' | 'ADMIN', jti, exp: Math.floor(Date.now() / 1000) + 3600 };
  }
}

export class RecordingAudit implements AuditPort {
  entries: AuditEntry[] = [];
  async record(e: AuditEntry) { this.entries.push(e); }
}
```

- [ ] **Step 3: Test de Sync (falla primero)**

`backend/tests/schedule/application/SyncSchedule.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SyncScheduleUseCase } from '../../../src/modules/schedule/application/SyncSchedule';
import { InMemoryEventBus } from '../../../src/shared/eventBus';
import {
  FakeInstitutional, InMemoryEnrollmentRepo, InMemoryScheduleRepo, InMemorySyncRuns, session,
} from '../../helpers/inMemory';

describe('SyncScheduleUseCase', () => {
  let schedules: InMemoryScheduleRepo, inst: FakeInstitutional, runs: InMemorySyncRuns;
  let bus: InMemoryEventBus, events: any[], uc: SyncScheduleUseCase, enroll: InMemoryEnrollmentRepo;

  beforeEach(() => {
    schedules = new InMemoryScheduleRepo();
    inst = new FakeInstitutional();
    runs = new InMemorySyncRuns();
    bus = new InMemoryEventBus();
    events = [];
    bus.subscribe('ScheduleChanged', (e) => { events.push(e); });
    enroll = new InMemoryEnrollmentRepo(['u1', 'u2']);
    uc = new SyncScheduleUseCase(
      { schedules, enrollments: enroll, institutional: inst, syncRuns: runs, bus },
      { semester: '2026-2', concurrency: 2 },
    );
  });

  it('importa horario nuevo y emite ScheduleChanged', async () => {
    inst.data.set('u1', [session()]);
    const r = await uc.execute({ trigger: 'MANUAL', actorId: 'admin' });
    await new Promise((x) => setTimeout(x, 0));
    expect(r).toMatchObject({ studentsSynced: 2, changesCount: 1 });
    expect(schedules.rows).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ userId: 'u1', semester: '2026-2' });
    expect(runs.runs[0]).toMatchObject({ status: 'OK', changesCount: 1, trigger: 'MANUAL' });
  });

  it('solo sincroniza estudiantes con matrícula vigente (RRF-01)', async () => {
    enroll.active = ['u1'];
    inst.data.set('u2', [session({ userId: 'u2', externalId: 'u2-ALG-1' })]);
    await uc.execute({ trigger: 'CRON' });
    expect(inst.calls).toBe(1);
    expect(schedules.rows).toHaveLength(0);
  });

  it('segunda sincronización idéntica no genera cambios ni eventos', async () => {
    inst.data.set('u1', [session()]);
    await uc.execute({ trigger: 'MANUAL' });
    events.length = 0;
    const r = await uc.execute({ trigger: 'MANUAL' });
    expect(r.changesCount).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('marca la corrida FAILED si el adaptador lanza', async () => {
    inst.fetchSchedule = async () => { throw new Error('institución caída'); };
    await expect(uc.execute({ trigger: 'MANUAL' })).rejects.toThrow('institución caída');
    expect(runs.runs[0].status).toBe('FAILED');
  });
});
```

- [ ] **Step 4: Implementar `SyncSchedule.ts`**

```ts
import { EventBus, UseCase } from '../../../shared/ports';
import { diffSchedules } from '../domain/diff';
import { EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRepository } from './ports';

export interface SyncInput { trigger: 'MANUAL' | 'CRON'; actorId?: string }
export interface SyncResult { runId: string; studentsSynced: number; changesCount: number }
interface Deps {
  schedules: ScheduleRepository;
  enrollments: EnrollmentRepository;
  institutional: InstitutionalPort;
  syncRuns: SyncRunRepository;
  bus: EventBus;
}

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Facade: orquesta adaptador institucional → diff → persistencia → eventos. Único escritor del horario. */
export class SyncScheduleUseCase implements UseCase<SyncInput, SyncResult> {
  constructor(private d: Deps, private opts: { semester: string; concurrency: number }) {}

  async execute(input: SyncInput): Promise<SyncResult> {
    const { schedules, enrollments, institutional, syncRuns, bus } = this.d;
    const { semester, concurrency } = this.opts;
    const run = await syncRuns.start(input.trigger, input.actorId);
    try {
      const ids = await enrollments.listActiveStudentIds(semester);
      let changesCount = 0;
      for (const batch of chunk(ids, concurrency)) {
        await Promise.all(
          batch.map(async (userId) => {
            const [local, remote] = await Promise.all([
              schedules.findByUser(userId, semester),
              institutional.fetchSchedule(userId, semester),
            ]);
            const changes = diffSchedules(local, remote);
            if (changes.length === 0) return;
            await schedules.applyChanges(userId, semester, changes);
            changesCount += changes.length;
            bus.publish({ type: 'ScheduleChanged', userId, semester, changes });
          }),
        );
      }
      await syncRuns.finish(run.id, { status: 'OK', studentsSynced: ids.length, changesCount });
      return { runId: run.id, studentsSynced: ids.length, changesCount };
    } catch (err) {
      await syncRuns.finish(run.id, { status: 'FAILED', studentsSynced: 0, changesCount: 0 });
      throw err;
    }
  }
}
```

- [ ] **Step 5: Test + implementación de GetWeeklySchedule**

`backend/tests/schedule/application/GetWeeklySchedule.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GetWeeklyScheduleUseCase } from '../../../src/modules/schedule/application/GetWeeklySchedule';
import { InMemoryEnrollmentRepo, InMemoryScheduleRepo, session } from '../../helpers/inMemory';

const setup = () => {
  const repo = new InMemoryScheduleRepo();
  repo.rows = [
    session({ externalId: 'a', weekday: 2, startTime: '08:00' }),
    session({ externalId: 'b', weekday: 1, startTime: '14:00' }),
    session({ externalId: 'c', weekday: 1, startTime: '08:00', status: 'CANCELLED' }),
    session({ externalId: 'd', userId: 'u2', weekday: 3 }),
  ];
  return new GetWeeklyScheduleUseCase(repo, new InMemoryEnrollmentRepo(['u1', 'u2']), '2026-2');
};

describe('GetWeeklyScheduleUseCase', () => {
  it('devuelve solo sesiones activas del usuario, ordenadas', async () => {
    const r = await setup().execute({ requesterId: 'u1', requesterRole: 'STUDENT' });
    expect(r.enrolled).toBe(true);
    expect(r.sessions.map((s) => s.externalId)).toEqual(['b', 'a']);
  });
  it('estudiante no puede ver a otro (RRF-04)', async () => {
    await expect(setup().execute({ requesterId: 'u1', requesterRole: 'STUDENT', targetUserId: 'u2' }))
      .rejects.toMatchObject({ status: 403 });
  });
  it('admin puede ver a otro', async () => {
    const r = await setup().execute({ requesterId: 'admin', requesterRole: 'ADMIN', targetUserId: 'u2' });
    expect(r.userId).toBe('u2');
    expect(r.sessions).toHaveLength(1);
  });
  it('sin matrícula vigente: enrolled=false y lista vacía (RRF-01)', async () => {
    const uc = new GetWeeklyScheduleUseCase(new InMemoryScheduleRepo(), new InMemoryEnrollmentRepo([]), '2026-2');
    const r = await uc.execute({ requesterId: 'u1', requesterRole: 'STUDENT' });
    expect(r).toMatchObject({ enrolled: false, sessions: [] });
  });
});
```

`backend/src/modules/schedule/application/GetWeeklySchedule.ts`:
```ts
import { UseCase } from '../../../shared/ports';
import { assertCanView } from '../domain/access';
import { activeSessions, sortSessions } from '../domain/sort';
import { ClassSession, Role } from '../domain/types';
import { EnrollmentRepository, ScheduleRepository } from './ports';

export interface WeeklyInput { requesterId: string; requesterRole: Role; targetUserId?: string }
export interface WeeklyResult { userId: string; semester: string; enrolled: boolean; sessions: ClassSession[] }

export class GetWeeklyScheduleUseCase implements UseCase<WeeklyInput, WeeklyResult> {
  constructor(
    private schedules: ScheduleRepository,
    private enrollments: EnrollmentRepository,
    private semester: string,
  ) {}

  async execute(i: WeeklyInput): Promise<WeeklyResult> {
    const userId = i.targetUserId ?? i.requesterId;
    assertCanView({ id: i.requesterId, role: i.requesterRole }, userId);
    const enrolled = await this.enrollments.hasActive(userId, this.semester);
    if (!enrolled) return { userId, semester: this.semester, enrolled, sessions: [] };
    const all = await this.schedules.findByUser(userId, this.semester);
    return { userId, semester: this.semester, enrolled, sessions: sortSessions(activeSessions(all)) };
  }
}
```

- [ ] **Step 6: Test + implementación de GetSessionDetail**

`backend/tests/schedule/application/GetSessionDetail.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GetSessionDetailUseCase } from '../../../src/modules/schedule/application/GetSessionDetail';
import { InMemoryScheduleRepo, session } from '../../helpers/inMemory';

const uc = () => {
  const repo = new InMemoryScheduleRepo();
  repo.rows = [session()];
  return new GetSessionDetailUseCase(repo);
};

describe('GetSessionDetailUseCase', () => {
  it('devuelve el detalle de una clase propia', async () => {
    const s = await uc().execute({ requesterId: 'u1', requesterRole: 'STUDENT', externalId: 'u1-ALG-1' });
    expect(s).toMatchObject({ courseName: 'Algoritmos', teacher: 'Marta', block: 'A', floor: 2, room: '201' });
  });
  it('404 si no existe', async () => {
    await expect(uc().execute({ requesterId: 'u1', requesterRole: 'STUDENT', externalId: 'nope' }))
      .rejects.toMatchObject({ status: 404 });
  });
  it('403 si estudiante pide la de otro', async () => {
    await expect(uc().execute({ requesterId: 'u2', requesterRole: 'STUDENT', externalId: 'u1-ALG-1', ownerId: 'u1' }))
      .rejects.toMatchObject({ status: 403 });
  });
});
```

`backend/src/modules/schedule/application/GetSessionDetail.ts`:
```ts
import { notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { assertCanView } from '../domain/access';
import { ClassSession, Role } from '../domain/types';
import { ScheduleRepository } from './ports';

export interface DetailInput { requesterId: string; requesterRole: Role; externalId: string; ownerId?: string }

export class GetSessionDetailUseCase implements UseCase<DetailInput, ClassSession> {
  constructor(private schedules: ScheduleRepository) {}

  async execute(i: DetailInput): Promise<ClassSession> {
    const owner = i.ownerId ?? i.requesterId;
    assertCanView({ id: i.requesterId, role: i.requesterRole }, owner);
    const s = await this.schedules.findOne(owner, i.externalId);
    if (!s) throw notFound('Clase no encontrada');
    return s;
  }
}
```

- [ ] **Step 7: Ejecutar y commit**

```bash
cd backend && npx vitest run
cd .. && git add -A && git commit -m "feat: schedule ports and use cases (sync, weekly, detail)"
```
Expected: PASS.

---

### Task 4: Exportadores (Template Method) y caso de uso de exportación

**Files:**
- Create: `backend/src/modules/schedule/infrastructure/exporters/{BaseExporter,IcsExporter,PdfExporter}.ts`, `backend/src/modules/schedule/application/ExportSchedule.ts`
- Test: `backend/tests/schedule/exporters.test.ts`, `backend/tests/schedule/application/ExportSchedule.test.ts`

**Interfaces:**
- Consumes: Task 2 domain, Task 3 `GetWeeklyScheduleUseCase`, `UserRepository`.
- Produces:
  - `ExportResult {contentType, filename, body: Buffer}`; `BaseExporter.export(sessions, ownerName): Promise<ExportResult>`.
  - `IcsExporter(opts:{semesterStart:string; weeks:number; now?:()=>Date})`, `PdfExporter(opts:{semester:string})`.
  - `ExportScheduleUseCase(getWeekly, users, exporters: Record<'ics'|'pdf', BaseExporter>)`, `execute({requesterId, requesterRole, format}) → ExportResult`.

- [ ] **Step 1: Test de exportadores**

`backend/tests/schedule/exporters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { session } from '../helpers/inMemory';

describe('IcsExporter', () => {
  const ex = new IcsExporter({ semesterStart: '2026-08-03', weeks: 16, now: () => new Date('2026-10-07T12:00:00Z') });

  it('genera un VEVENT semanal compatible con Google Calendar/Outlook', async () => {
    const r = await ex.export([session({ weekday: 3, startTime: '08:00', endTime: '10:00' })], 'Ana Pérez');
    const text = r.body.toString('utf8');
    expect(r.contentType).toBe('text/calendar; charset=utf-8');
    expect(r.filename).toBe('horario-ana-perez.ics');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('DTSTART;TZID=America/Bogota:20260805T080000'); // miércoles de la 1.ª semana
    expect(text).toContain('DTEND;TZID=America/Bogota:20260805T100000');
    expect(text).toContain('RRULE:FREQ=WEEKLY;COUNT=16');
    expect(text).toContain('SUMMARY:Algoritmos');
    expect(text).toContain('LOCATION:Bloque A - Piso 2 - Aula 201');
    expect(text).toContain('UID:u1-ALG-1@horariouni');
    expect(text).toContain('\r\n');
    expect(text.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('omite sesiones canceladas', async () => {
    const r = await ex.export([session({ status: 'CANCELLED' })], 'Ana');
    expect(r.body.toString()).not.toContain('BEGIN:VEVENT');
  });

  it('escapa comas y punto y coma en el texto', async () => {
    const r = await ex.export([session({ courseName: 'A, B; C' })], 'Ana');
    expect(r.body.toString()).toContain('SUMMARY:A\\, B\\; C');
  });
});

describe('PdfExporter', () => {
  it('genera un PDF válido', async () => {
    const r = await new PdfExporter({ semester: '2026-2' }).export([session(), session({ externalId: 'x', weekday: 2 })], 'Ana Pérez');
    expect(r.contentType).toBe('application/pdf');
    expect(r.filename).toBe('horario-ana-perez.pdf');
    expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Implementación**

`BaseExporter.ts` (Template Method):
```ts
import { ClassSession } from '../../domain/types';
import { activeSessions, sortSessions } from '../../domain/sort';

export interface ExportResult { contentType: string; filename: string; body: Buffer }

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export abstract class BaseExporter {
  protected abstract readonly contentType: string;
  protected abstract readonly extension: string;
  protected abstract render(sessions: ClassSession[], ownerName: string): Promise<Buffer>;

  /** Plantilla: filtra y ordena, delega el render y arma el resultado. */
  async export(sessions: ClassSession[], ownerName: string): Promise<ExportResult> {
    const prepared = sortSessions(activeSessions(sessions));
    const body = await this.render(prepared, ownerName);
    return { contentType: this.contentType, filename: `horario-${slug(ownerName)}.${this.extension}`, body };
  }
}
```

`IcsExporter.ts`:
```ts
import { ClassSession } from '../../domain/types';
import { BaseExporter } from './BaseExporter';

interface Opts { semesterStart: string; weeks: number; now?: () => Date }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const pad = (n: number) => String(n).padStart(2, '0');

export class IcsExporter extends BaseExporter {
  protected readonly contentType = 'text/calendar; charset=utf-8';
  protected readonly extension = 'ics';
  constructor(private opts: Opts) { super(); }

  private dateFor(weekday: number): string {
    const [y, m, d] = this.opts.semesterStart.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const startWeekday = start.getUTCDay() || 7;
    const offset = (weekday - startWeekday + 7) % 7;
    const dt = new Date(start.getTime() + offset * 86_400_000);
    return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
  }

  private stamp(): string {
    const n = (this.opts.now ?? (() => new Date()))();
    return `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`;
  }

  protected async render(sessions: ClassSession[], ownerName: string): Promise<Buffer> {
    const hhmm = (t: string) => t.replace(':', '') + '00';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Horario UNI//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc('Horario ' + ownerName)}`];
    for (const s of sessions) {
      const day = this.dateFor(s.weekday);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.externalId}@horariouni`,
        `DTSTAMP:${this.stamp()}`,
        `DTSTART;TZID=America/Bogota:${day}T${hhmm(s.startTime)}`,
        `DTEND;TZID=America/Bogota:${day}T${hhmm(s.endTime)}`,
        `RRULE:FREQ=WEEKLY;COUNT=${this.opts.weeks}`,
        `SUMMARY:${esc(s.courseName)}`,
        `LOCATION:${esc(`Bloque ${s.block} - Piso ${s.floor} - Aula ${s.room}`)}`,
        `DESCRIPTION:${esc(`Docente: ${s.teacher}`)}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return Buffer.from(lines.join('\r\n') + '\r\n', 'utf8');
  }
}
```

`PdfExporter.ts`:
```ts
import PDFDocument from 'pdfkit';
import { ClassSession } from '../../domain/types';
import { BaseExporter, DAY_NAMES } from './BaseExporter';

export class PdfExporter extends BaseExporter {
  protected readonly contentType = 'application/pdf';
  protected readonly extension = 'pdf';
  constructor(private opts: { semester: string }) { super(); }

  protected render(sessions: ClassSession[], ownerName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Horario UNI', { align: 'left' });
      doc.fontSize(11).fillColor('#444').text(`${ownerName} — Semestre ${this.opts.semester}`).moveDown();
      doc.fillColor('#000');

      let currentDay = 0;
      for (const s of sessions) {
        if (s.weekday !== currentDay) {
          currentDay = s.weekday;
          doc.moveDown(0.5).fontSize(13).fillColor('#1F6F8B').text(DAY_NAMES[currentDay]).fillColor('#000');
        }
        doc.fontSize(11).text(`${s.startTime}–${s.endTime}  ${s.courseName} (${s.courseCode})`);
        doc.fontSize(9).fillColor('#555')
          .text(`Docente: ${s.teacher} · Bloque ${s.block}, piso ${s.floor}, aula ${s.room}`, { indent: 12 })
          .fillColor('#000');
      }
      if (sessions.length === 0) doc.fontSize(11).text('Sin clases registradas.');
      doc.end();
    });
  }
}
```

- [ ] **Step 3: Test + implementación del caso de uso**

`backend/tests/schedule/application/ExportSchedule.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ExportScheduleUseCase } from '../../../src/modules/schedule/application/ExportSchedule';
import { GetWeeklyScheduleUseCase } from '../../../src/modules/schedule/application/GetWeeklySchedule';
import { IcsExporter } from '../../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { InMemoryEnrollmentRepo, InMemoryScheduleRepo, InMemoryUsers, session } from '../../helpers/inMemory';

const build = () => {
  const repo = new InMemoryScheduleRepo();
  repo.rows = [session()];
  const weekly = new GetWeeklyScheduleUseCase(repo, new InMemoryEnrollmentRepo(['u1']), '2026-2');
  const users = new InMemoryUsers([{ id: 'u1', name: 'Ana Pérez', email: 'a@x.co', passwordHash: '', role: 'STUDENT', active: true }]);
  return new ExportScheduleUseCase(weekly, users, {
    ics: new IcsExporter({ semesterStart: '2026-08-03', weeks: 16 }),
    pdf: new PdfExporter({ semester: '2026-2' }),
  });
};

describe('ExportScheduleUseCase', () => {
  it('exporta ics', async () => {
    const r = await build().execute({ requesterId: 'u1', requesterRole: 'STUDENT', format: 'ics' });
    expect(r.filename).toBe('horario-ana-perez.ics');
    expect(r.body.toString()).toContain('Algoritmos');
  });
  it('exporta pdf', async () => {
    const r = await build().execute({ requesterId: 'u1', requesterRole: 'STUDENT', format: 'pdf' });
    expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
```

`backend/src/modules/schedule/application/ExportSchedule.ts`:
```ts
import { notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { UserRepository } from '../../auth/application/ports';
import { BaseExporter, ExportResult } from '../infrastructure/exporters/BaseExporter';
import { Role } from '../domain/types';
import { GetWeeklyScheduleUseCase } from './GetWeeklySchedule';

export type ExportFormat = 'ics' | 'pdf';
export interface ExportInput { requesterId: string; requesterRole: Role; format: ExportFormat }

export class ExportScheduleUseCase implements UseCase<ExportInput, ExportResult> {
  constructor(
    private weekly: GetWeeklyScheduleUseCase,
    private users: UserRepository,
    private exporters: Record<ExportFormat, BaseExporter>,
  ) {}

  async execute(i: ExportInput): Promise<ExportResult> {
    const user = await this.users.findById(i.requesterId);
    if (!user) throw notFound('Usuario no encontrado');
    const { sessions } = await this.weekly.execute({ requesterId: i.requesterId, requesterRole: i.requesterRole });
    return this.exporters[i.format].export(sessions, user.name);
  }
}
```

- [ ] **Step 4: Ejecutar y commit**

```bash
cd backend && npx vitest run
cd .. && git add -A && git commit -m "feat: ics/pdf exporters (template method) and export use case"
```

---

### Task 5: Autenticación mínima (Login, Logout, JWT, argon2)

**Files:**
- Create: `backend/src/modules/auth/application/{Login,Logout}.ts`, `backend/src/modules/auth/infrastructure/{JwtTokenService,Argon2Hasher}.ts`
- Test: `backend/tests/auth/{Login,Logout,JwtTokenService}.test.ts`

**Interfaces:**
- Consumes: Task 3 auth ports, `unauthorized`.
- Produces:
  - `LoginUseCase(users, hasher, tokens)`, `execute({email,password}) → {token, user:{id,name,email,role}}`; lanza 401 «Credenciales inválidas».
  - `LogoutUseCase(revoked)`, `execute({jti, exp}) → void`.
  - `JwtTokenService(secret)` implementa `TokenService` (expira en 60 min, `jti` único).
  - `Argon2Hasher` implementa `PasswordHasher`.

- [ ] **Step 1: Tests**

`backend/tests/auth/Login.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LoginUseCase } from '../../src/modules/auth/application/Login';
import { FakeHasher, FakeTokens, InMemoryUsers } from '../helpers/inMemory';

const users = new InMemoryUsers([
  { id: 'u1', name: 'Ana', email: 'ana@x.co', passwordHash: 'hash:Secreta123!', role: 'STUDENT', active: true },
  { id: 'u2', name: 'Off', email: 'off@x.co', passwordHash: 'hash:Secreta123!', role: 'STUDENT', active: false },
]);
const uc = new LoginUseCase(users, new FakeHasher(), new FakeTokens());

describe('LoginUseCase', () => {
  it('devuelve token y usuario sin passwordHash', async () => {
    const r = await uc.execute({ email: 'ANA@x.co', password: 'Secreta123!' });
    expect(r.token).toMatch(/^tok:u1:STUDENT:/);
    expect(r.user).toEqual({ id: 'u1', name: 'Ana', email: 'ana@x.co', role: 'STUDENT' });
  });
  it('401 con contraseña incorrecta', async () => {
    await expect(uc.execute({ email: 'ana@x.co', password: 'mala' })).rejects.toMatchObject({ status: 401 });
  });
  it('401 con usuario inexistente o inactivo', async () => {
    await expect(uc.execute({ email: 'no@x.co', password: 'x' })).rejects.toMatchObject({ status: 401 });
    await expect(uc.execute({ email: 'off@x.co', password: 'Secreta123!' })).rejects.toMatchObject({ status: 401 });
  });
});
```

`backend/tests/auth/Logout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LogoutUseCase } from '../../src/modules/auth/application/Logout';
import { InMemoryRevoked } from '../helpers/inMemory';

describe('LogoutUseCase', () => {
  it('revoca el jti del token', async () => {
    const revoked = new InMemoryRevoked();
    await new LogoutUseCase(revoked).execute({ jti: 'j1', exp: 1_900_000_000 });
    expect(await revoked.isRevoked('j1')).toBe(true);
  });
});
```

`backend/tests/auth/JwtTokenService.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtTokenService } from '../../src/modules/auth/infrastructure/JwtTokenService';

describe('JwtTokenService', () => {
  const svc = new JwtTokenService('secret');
  it('firma y verifica con expiración de 60 minutos', () => {
    const t = svc.sign({ id: 'u1', role: 'ADMIN' });
    const p = svc.verify(t);
    expect(p).toMatchObject({ sub: 'u1', role: 'ADMIN' });
    expect(p.jti).toBeTruthy();
    const raw = jwt.decode(t) as { iat: number; exp: number };
    expect(raw.exp - raw.iat).toBe(3600);
  });
  it('jti distinto por token', () => {
    expect(svc.verify(svc.sign({ id: 'u', role: 'STUDENT' })).jti).not.toBe(svc.verify(svc.sign({ id: 'u', role: 'STUDENT' })).jti);
  });
  it('401 con firma inválida', () => {
    const t = new JwtTokenService('otra').sign({ id: 'u1', role: 'STUDENT' });
    expect(() => svc.verify(t)).toThrow(/Token/);
  });
  it('401 con token expirado', () => {
    const t = jwt.sign({ role: 'STUDENT' }, 'secret', { subject: 'u1', expiresIn: -10, jwtid: 'j' });
    expect(() => svc.verify(t)).toThrow(/Token/);
  });
});
```

- [ ] **Step 2: Implementación**

`Login.ts`:
```ts
import { unauthorized } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { Role } from '../../schedule/domain/types';
import { PasswordHasher, TokenService, UserRepository } from './ports';

export interface LoginInput { email: string; password: string }
export interface LoginResult { token: string; user: { id: string; name: string; email: string; role: Role } }

export class LoginUseCase implements UseCase<LoginInput, LoginResult> {
  constructor(private users: UserRepository, private hasher: PasswordHasher, private tokens: TokenService) {}

  async execute({ email, password }: LoginInput): Promise<LoginResult> {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    const ok = u && u.active && (await this.hasher.verify(u.passwordHash, password));
    if (!u || !ok) throw unauthorized('Credenciales inválidas');
    return { token: this.tokens.sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } };
  }
}
```

`Logout.ts`:
```ts
import { UseCase } from '../../../shared/ports';
import { RevokedTokenRepository } from './ports';

export class LogoutUseCase implements UseCase<{ jti: string; exp: number }, void> {
  constructor(private revoked: RevokedTokenRepository) {}
  async execute({ jti, exp }: { jti: string; exp: number }): Promise<void> {
    await this.revoked.revoke(jti, new Date(exp * 1000));
  }
}
```

`JwtTokenService.ts`:
```ts
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { unauthorized } from '../../../shared/errors';
import { Role } from '../../schedule/domain/types';
import { TokenPayload, TokenService } from '../application/ports';

export class JwtTokenService implements TokenService {
  constructor(private secret: string) {}

  sign(user: { id: string; role: Role }): string {
    return jwt.sign({ role: user.role }, this.secret, { subject: user.id, expiresIn: '60m', jwtid: randomUUID() });
  }

  verify(token: string): TokenPayload {
    try {
      const p = jwt.verify(token, this.secret) as jwt.JwtPayload;
      return { sub: p.sub as string, role: p.role as Role, jti: p.jti as string, exp: p.exp as number };
    } catch {
      throw unauthorized('Token inválido o expirado');
    }
  }
}
```

`Argon2Hasher.ts`:
```ts
import argon2 from 'argon2';
import { PasswordHasher } from '../application/ports';

export class Argon2Hasher implements PasswordHasher {
  hash(plain: string) { return argon2.hash(plain, { type: argon2.argon2id }); }
  verify(hash: string, plain: string) { return argon2.verify(hash, plain).catch(() => false); }
}
```

- [ ] **Step 3: Ejecutar y commit**

```bash
cd backend && npx vitest run
cd .. && git add -A && git commit -m "feat: minimal auth (login, logout, jwt 60m, argon2)"
```

---

### Task 6: Infraestructura Prisma y adaptador institucional mock

**Files:**
- Create: `backend/src/shared/prisma.ts`, `backend/src/modules/schedule/infrastructure/{PrismaScheduleRepository,PrismaEnrollmentRepository,PrismaSyncRunRepository,MockInstitutionalAdapter}.ts`, `backend/src/modules/auth/infrastructure/{PrismaUserRepository,PrismaRevokedTokenRepository}.ts`, `backend/src/modules/audit/{PrismaAuditLog,auditListener}.ts`
- Test: `backend/tests/schedule/MockInstitutionalAdapter.test.ts`, `backend/tests/audit/auditListener.test.ts`

**Interfaces:**
- Consumes: puertos de Tasks 3 y 5, `AuditPort`, `EventBus`.
- Produces: clases `Prisma*` que implementan los puertos; `MockInstitutionalAdapter implements InstitutionalPort` (1.ª consulta por usuario = horario base; 2.ª y siguientes = variante con cambios: ALG101 pasa a bloque B/aula 305, PHY201 cancelada, aparece LAB301); `registerAuditListener(bus, audit)`.

- [ ] **Step 1: Test del mock y del listener**

`backend/tests/schedule/MockInstitutionalAdapter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MockInstitutionalAdapter } from '../../src/modules/schedule/infrastructure/MockInstitutionalAdapter';
import { diffSchedules } from '../../src/modules/schedule/domain/diff';

describe('MockInstitutionalAdapter', () => {
  it('1.ª consulta devuelve el horario base', async () => {
    const r = await new MockInstitutionalAdapter().fetchSchedule('u1', '2026-2');
    expect(r.length).toBe(8);
    expect(r.every((s) => s.userId === 'u1' && s.semester === '2026-2' && s.status === 'ACTIVE')).toBe(true);
    expect(new Set(r.map((s) => s.externalId)).size).toBe(8);
  });
  it('2.ª consulta del mismo usuario trae cambio de aula, cancelación y adición', async () => {
    const a = new MockInstitutionalAdapter();
    const first = await a.fetchSchedule('u1', '2026-2');
    const second = await a.fetchSchedule('u1', '2026-2');
    const changes = diffSchedules(first, second);
    const types = changes.map((c) => c.type);
    expect(types).toContain('UPDATED');
    expect(types).toContain('CANCELLED');
    expect(types).toContain('ADDED');
    const upd = changes.find((c) => c.type === 'UPDATED')!;
    expect(upd.after).toMatchObject({ block: 'B', room: '305' });
  });
  it('el estado es por usuario', async () => {
    const a = new MockInstitutionalAdapter();
    await a.fetchSchedule('u1', '2026-2');
    const other = await a.fetchSchedule('u2', '2026-2');
    expect(other.length).toBe(8);
  });
});
```

`backend/tests/audit/auditListener.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { InMemoryEventBus } from '../../src/shared/eventBus';
import { registerAuditListener } from '../../src/modules/audit/auditListener';
import { RecordingAudit } from '../helpers/inMemory';

describe('auditListener', () => {
  it('audita ScheduleChanged con tipo y cantidad de cambios', async () => {
    const bus = new InMemoryEventBus();
    const audit = new RecordingAudit();
    registerAuditListener(bus, audit);
    bus.publish({ type: 'ScheduleChanged', userId: 'u1', semester: '2026-2', changes: [{ type: 'UPDATED', externalId: 'e1' }] });
    await new Promise((r) => setTimeout(r, 0));
    expect(audit.entries[0]).toMatchObject({
      action: 'SCHEDULE_CHANGED', entity: 'schedule', actorId: 'system',
      detail: { userId: 'u1', semester: '2026-2', changes: [{ type: 'UPDATED', externalId: 'e1' }] },
    });
  });
});
```

- [ ] **Step 2: Implementar mock y listener**

`MockInstitutionalAdapter.ts`:
```ts
import { ClassSession, Weekday } from '../domain/types';
import { InstitutionalPort } from '../application/ports';

type Tpl = Omit<ClassSession, 'userId' | 'semester' | 'externalId' | 'status'>;

const BASE: Tpl[] = [
  { courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta Gómez', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201' },
  { courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta Gómez', weekday: 3, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201' },
  { courseCode: 'CAL102', courseName: 'Cálculo', teacher: 'Luis Ortiz', weekday: 2, startTime: '10:00', endTime: '12:00', block: 'B', floor: 1, room: '105' },
  { courseCode: 'CAL102', courseName: 'Cálculo', teacher: 'Luis Ortiz', weekday: 4, startTime: '10:00', endTime: '12:00', block: 'B', floor: 1, room: '105' },
  { courseCode: 'PHY201', courseName: 'Física', teacher: 'Ana Ruiz', weekday: 1, startTime: '14:00', endTime: '16:00', block: 'C', floor: 3, room: '310' },
  { courseCode: 'DBS202', courseName: 'Bases de Datos', teacher: 'Carlos Peña', weekday: 3, startTime: '14:00', endTime: '16:00', block: 'A', floor: 2, room: '204' },
  { courseCode: 'ENG103', courseName: 'Inglés', teacher: 'Julia Stone', weekday: 5, startTime: '07:00', endTime: '09:00', block: 'D', floor: 1, room: '102' },
  { courseCode: 'SOF301', courseName: 'Ingeniería de Software', teacher: 'Diego Mora', weekday: 5, startTime: '10:00', endTime: '12:00', block: 'B', floor: 2, room: '208' },
];

const LAB: Tpl = { courseCode: 'LAB301', courseName: 'Laboratorio de Software', teacher: 'Diego Mora', weekday: 4 as Weekday, startTime: '14:00', endTime: '16:00', block: 'C', floor: 1, room: '110' };

/**
 * Simula el sistema académico institucional (RRF-07). Por usuario: la 1.ª consulta
 * devuelve el horario base; las siguientes devuelven una variante con cambios
 * (ALG101 → bloque B aula 305, PHY201 cancelada, nueva LAB301).
 */
export class MockInstitutionalAdapter implements InstitutionalPort {
  private fetches = new Map<string, number>();

  async fetchSchedule(userId: string, semester: string): Promise<ClassSession[]> {
    const round = this.fetches.get(userId) ?? 0;
    this.fetches.set(userId, round + 1);

    const build = (t: Tpl, over: Partial<ClassSession> = {}): ClassSession => ({
      ...t, userId, semester, externalId: `${userId}-${t.courseCode}-${t.weekday}`, status: 'ACTIVE', ...over,
    });

    const rows = BASE.map((t) => {
      if (round === 0) return build(t);
      if (t.courseCode === 'ALG101') return build(t, { block: 'B', floor: 3, room: '305' });
      if (t.courseCode === 'PHY201') return build(t, { status: 'CANCELLED' });
      return build(t);
    });
    if (round > 0) rows.push(build(LAB));
    return rows;
  }
}
```

`auditListener.ts`:
```ts
import { AuditPort, EventBus } from '../../shared/ports';

export function registerAuditListener(bus: EventBus, audit: AuditPort) {
  bus.subscribe('ScheduleChanged', async (e) => {
    const changes = (e.changes as Array<{ type: string; externalId: string }>).map((c) => ({ type: c.type, externalId: c.externalId }));
    console.log(`[ScheduleChanged] usuario=${e.userId} cambios=${changes.length}`);
    await audit.record({
      actorId: 'system', action: 'SCHEDULE_CHANGED', entity: 'schedule',
      detail: { userId: e.userId, semester: e.semester, changes },
    });
  });
}
```

- [ ] **Step 3: Repositorios Prisma** (requieren Postgres; se verifican en Task 7)

`backend/src/shared/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient(); // Singleton: un solo pool por proceso
```

`PrismaScheduleRepository.ts`:
```ts
import { Prisma, ClassSession as Row } from '@prisma/client';
import { prisma } from '../../../shared/prisma';
import { ClassSession, ScheduleChange, SessionStatus, Weekday } from '../domain/types';
import { ScheduleRepository } from '../application/ports';

const toDomain = (r: Row): ClassSession => ({
  externalId: r.externalId, userId: r.userId, semester: r.semester, courseCode: r.courseCode,
  courseName: r.courseName, teacher: r.teacher, weekday: r.weekday as Weekday, startTime: r.startTime,
  endTime: r.endTime, block: r.block, floor: r.floor, room: r.room, status: r.status as SessionStatus,
});

const toData = (s: ClassSession) => ({
  externalId: s.externalId, userId: s.userId, semester: s.semester, courseCode: s.courseCode,
  courseName: s.courseName, teacher: s.teacher, weekday: s.weekday, startTime: s.startTime,
  endTime: s.endTime, block: s.block, floor: s.floor, room: s.room, status: s.status,
});

const json = (v?: ClassSession) => (v ? (v as unknown as Prisma.InputJsonValue) : Prisma.JsonNull);

export class PrismaScheduleRepository implements ScheduleRepository {
  async findByUser(userId: string, semester: string) {
    return (await prisma.classSession.findMany({ where: { userId, semester } })).map(toDomain);
  }

  async findOne(userId: string, externalId: string) {
    const r = await prisma.classSession.findUnique({ where: { userId_externalId: { userId, externalId } } });
    return r ? toDomain(r) : null;
  }

  async applyChanges(userId: string, _semester: string, changes: ScheduleChange[]) {
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const c of changes) {
      const where = { userId_externalId: { userId, externalId: c.externalId } };
      if (c.type === 'CANCELLED') {
        ops.push(prisma.classSession.update({ where, data: { status: 'CANCELLED' } }));
      } else {
        const data = toData(c.after!);
        ops.push(prisma.classSession.upsert({ where, create: data, update: data }));
      }
      ops.push(prisma.scheduleChange.create({
        data: { userId, externalId: c.externalId, type: c.type, before: json(c.before), after: json(c.after) },
      }));
    }
    await prisma.$transaction(ops);
  }
}
```

`PrismaEnrollmentRepository.ts`:
```ts
import { prisma } from '../../../shared/prisma';
import { EnrollmentRepository } from '../application/ports';

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  async listActiveStudentIds(semester: string) {
    const rows = await prisma.enrollment.findMany({
      where: { semester, active: true, user: { role: 'STUDENT', active: true } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
  async hasActive(userId: string, semester: string) {
    return (await prisma.enrollment.count({ where: { userId, semester, active: true } })) > 0;
  }
}
```

`PrismaSyncRunRepository.ts`:
```ts
import { prisma } from '../../../shared/prisma';
import { SyncRunRepository } from '../application/ports';

export class PrismaSyncRunRepository implements SyncRunRepository {
  async start(trigger: string, actorId?: string) {
    const r = await prisma.syncRun.create({ data: { trigger, actorId } });
    return { id: r.id };
  }
  async finish(id: string, r: { status: 'OK' | 'FAILED'; studentsSynced: number; changesCount: number }) {
    await prisma.syncRun.update({ where: { id }, data: { ...r, finishedAt: new Date() } });
  }
  list(limit: number) {
    return prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
  }
}
```

`PrismaUserRepository.ts`:
```ts
import { prisma } from '../../../shared/prisma';
import { UserRepository } from '../application/ports';

export class PrismaUserRepository implements UserRepository {
  findByEmail(email: string) { return prisma.user.findUnique({ where: { email } }); }
  findById(id: string) { return prisma.user.findUnique({ where: { id } }); }
}
```

`PrismaRevokedTokenRepository.ts`:
```ts
import { prisma } from '../../../shared/prisma';
import { RevokedTokenRepository } from '../application/ports';

export class PrismaRevokedTokenRepository implements RevokedTokenRepository {
  async revoke(jti: string, expiresAt: Date) {
    await prisma.revokedToken.upsert({ where: { jti }, create: { jti, expiresAt }, update: {} });
  }
  async isRevoked(jti: string) {
    return (await prisma.revokedToken.count({ where: { jti } })) > 0;
  }
}
```

`PrismaAuditLog.ts`:
```ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma';
import { AuditEntry, AuditPort } from '../../shared/ports';

export class PrismaAuditLog implements AuditPort {
  async record(e: AuditEntry) {
    await prisma.auditLog.create({
      data: {
        actorId: e.actorId, action: e.action, entity: e.entity,
        detail: e.detail === undefined ? Prisma.JsonNull : (e.detail as Prisma.InputJsonValue),
      },
    });
  }
}
```

- [ ] **Step 4: Ejecutar tests, compilar y commit**

```bash
cd backend && npx vitest run && npx tsc -p . --noEmit
cd .. && git add -A && git commit -m "feat: prisma repositories, mock institutional adapter, audit listener"
```
Expected: tests PASS; `tsc` sin errores.

---

### Task 7: HTTP, container, job de sincronización, seed y arranque

**Files:**
- Create: `backend/src/shared/container.ts`, `backend/src/shared/http/{app,auth,asyncHandler,errorHandler}.ts`, `backend/src/modules/auth/http/authRoutes.ts`, `backend/src/modules/schedule/http/{scheduleRoutes,adminRoutes}.ts`, `backend/src/jobs/syncJob.ts`, `backend/src/main.ts`, `backend/prisma/seed.ts`
- Test: `backend/tests/http/api.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `Ports` (todos los puertos + `bus` + `hasher` + `tokens` + `audit` + `exporters`) y `buildContainer(ports, cfg) → Container {login, logout, getWeekly, getDetail, exportSchedule, sync, syncRuns, tokens, revoked}`.
  - `createApp(c: Container): Express`. Rutas (todas con prefijo `/api`):
    - `POST /auth/login` `{email,password}` → `{token,user}`; `POST /auth/logout` (Bearer) → 204.
    - `GET /schedule/me` → `WeeklyResult`; `GET /schedule/users/:userId` (admin) → `WeeklyResult`; `GET /schedule/sessions/:externalId?userId=` → `ClassSession`; `GET /schedule/me/export?format=ics|pdf` → archivo.
    - `POST /admin/sync` (admin) → `SyncResult`; `GET /admin/sync/runs` (admin) → `SyncRunRecord[]`.
  - `req.auth: TokenPayload` tras `authenticate`.

- [ ] **Step 1: Test de integración HTTP (falla primero)**

`backend/tests/http/api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildContainer } from '../../src/shared/container';
import { createApp } from '../../src/shared/http/app';
import { InMemoryEventBus } from '../../src/shared/eventBus';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { registerAuditListener } from '../../src/modules/audit/auditListener';
import {
  FakeHasher, FakeInstitutional, FakeTokens, InMemoryEnrollmentRepo, InMemoryRevoked,
  InMemoryScheduleRepo, InMemorySyncRuns, InMemoryUsers, RecordingAudit, session,
} from '../helpers/inMemory';

const cfg = { port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16, syncCron: '', syncConcurrency: 2 };

const U2 = '22222222-2222-4222-8222-222222222222'; // las rutas validan UUID
let app: ReturnType<typeof createApp>;
let audit: RecordingAudit;
let inst: FakeInstitutional;
let schedules: InMemoryScheduleRepo;

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: 'Secreta123!' })).body.token as string;

beforeEach(() => {
  audit = new RecordingAudit();
  inst = new FakeInstitutional();
  schedules = new InMemoryScheduleRepo();
  const bus = new InMemoryEventBus();
  registerAuditListener(bus, audit);
  const mkUser = (id: string, role: 'STUDENT' | 'ADMIN', email = `${id}@x.co`) =>
    ({ id, name: `User ${id}`, email, passwordHash: 'hash:Secreta123!', role, active: true });
  const c = buildContainer({
    schedules, enrollments: new InMemoryEnrollmentRepo(['u1', U2]), institutional: inst,
    syncRuns: new InMemorySyncRuns(), users: new InMemoryUsers([mkUser('u1', 'STUDENT'), mkUser(U2, 'STUDENT', 'u2@x.co'), mkUser('admin', 'ADMIN')]),
    revoked: new InMemoryRevoked(), hasher: new FakeHasher(), tokens: new FakeTokens(), audit, bus,
    exporters: { ics: new IcsExporter({ semesterStart: cfg.semesterStart, weeks: 16 }), pdf: new PdfExporter({ semester: '2026-2' }) },
  }, cfg);
  app = createApp(c, cfg);
  inst.data.set('u1', [session()]);
  inst.data.set(U2, [session({ userId: U2, externalId: `${U2}-ALG-1` })]);
});

describe('API', () => {
  it('login: 200 con token, 401 con credenciales inválidas, 400 con body inválido', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'u1@x.co', password: 'Secreta123!' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'u1@x.co', password: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'no-email' })).status).toBe(400);
  });

  it('rutas protegidas exigen token', async () => {
    expect((await request(app).get('/api/schedule/me')).status).toBe(401);
  });

  it('logout invalida el token', async () => {
    const t = await login('u1@x.co');
    expect((await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${t}`)).status).toBe(204);
    expect((await request(app).get('/api/schedule/me').set('Authorization', `Bearer ${t}`)).status).toBe(401);
  });

  it('sincroniza (admin) y el estudiante ve su horario; no el de otro', async () => {
    const admin = await login('admin@x.co');
    const sync = await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    expect(sync.status).toBe(200);
    expect(sync.body).toMatchObject({ studentsSynced: 2, changesCount: 2 });

    const t1 = await login('u1@x.co');
    const mine = await request(app).get('/api/schedule/me').set('Authorization', `Bearer ${t1}`);
    expect(mine.body.sessions).toHaveLength(1);
    expect(mine.body.sessions[0].courseName).toBe('Algoritmos');

    const other = await request(app).get(`/api/schedule/users/${U2}`).set('Authorization', `Bearer ${t1}`);
    expect(other.status).toBe(403);
  });

  it('estudiante no puede sincronizar (RBAC)', async () => {
    const t1 = await login('u1@x.co');
    expect((await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${t1}`)).status).toBe(403);
  });

  it('admin ve el horario de terceros y queda auditado (RRF-04, RNF-14)', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    const r = await request(app).get(`/api/schedule/users/${U2}`).set('Authorization', `Bearer ${admin}`);
    expect(r.status).toBe(200);
    expect(audit.entries.some((e) => e.action === 'VIEW_THIRD_PARTY_SCHEDULE' && e.actorId === 'admin')).toBe(true);
    expect(audit.entries.some((e) => e.action === 'SYNC' && e.actorId === 'admin')).toBe(true);
  });

  it('detalle de clase', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    const t1 = await login('u1@x.co');
    const r = await request(app).get('/api/schedule/sessions/u1-ALG-1').set('Authorization', `Bearer ${t1}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ teacher: 'Marta', block: 'A', floor: 2, room: '201' });
    expect((await request(app).get('/api/schedule/sessions/nope').set('Authorization', `Bearer ${t1}`)).status).toBe(404);
  });

  it('exporta ics y pdf; formato inválido → 400', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    const t1 = await login('u1@x.co');
    const ics = await request(app).get('/api/schedule/me/export?format=ics').set('Authorization', `Bearer ${t1}`);
    expect(ics.status).toBe(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.headers['content-disposition']).toContain('horario-user-u1.ics');
    const pdf = await request(app).get('/api/schedule/me/export?format=pdf').set('Authorization', `Bearer ${t1}`);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((await request(app).get('/api/schedule/me/export?format=doc').set('Authorization', `Bearer ${t1}`)).status).toBe(400);
  });

  it('RRF-02/07: no existen rutas de escritura de sesiones', async () => {
    const t = await login('admin@x.co');
    for (const m of ['post', 'put', 'patch', 'delete'] as const) {
      const r = await request(app)[m]('/api/schedule/sessions/u1-ALG-1').set('Authorization', `Bearer ${t}`);
      expect(r.status).toBe(404);
    }
  });

  it('GET /admin/sync/runs lista corridas', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    const r = await request(app).get('/api/admin/sync/runs').set('Authorization', `Bearer ${admin}`);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].status).toBe('OK');
  });
});
```

- [ ] **Step 2: Container (composición manual / DI)**

`backend/src/shared/container.ts`:
```ts
import { withAudit } from './audit';
import { Config } from './config';
import { AuditPort, EventBus } from './ports';
import { LoginUseCase } from '../modules/auth/application/Login';
import { LogoutUseCase } from '../modules/auth/application/Logout';
import { PasswordHasher, RevokedTokenRepository, TokenService, UserRepository } from '../modules/auth/application/ports';
import { ExportScheduleUseCase, ExportFormat } from '../modules/schedule/application/ExportSchedule';
import { GetSessionDetailUseCase } from '../modules/schedule/application/GetSessionDetail';
import { GetWeeklyScheduleUseCase } from '../modules/schedule/application/GetWeeklySchedule';
import { EnrollmentRepository, InstitutionalPort, ScheduleRepository, SyncRunRepository } from '../modules/schedule/application/ports';
import { SyncScheduleUseCase } from '../modules/schedule/application/SyncSchedule';
import { BaseExporter } from '../modules/schedule/infrastructure/exporters/BaseExporter';

export interface Ports {
  schedules: ScheduleRepository;
  enrollments: EnrollmentRepository;
  institutional: InstitutionalPort;
  syncRuns: SyncRunRepository;
  users: UserRepository;
  revoked: RevokedTokenRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  audit: AuditPort;
  bus: EventBus;
  exporters: Record<ExportFormat, BaseExporter>;
}

export function buildContainer(p: Ports, cfg: Config) {
  const weekly = new GetWeeklyScheduleUseCase(p.schedules, p.enrollments, cfg.semester);

  const getWeekly = withAudit(p.audit, 'VIEW_THIRD_PARTY_SCHEDULE', weekly, {
    entity: 'schedule',
    actorOf: (i) => i.requesterId,
    shouldAudit: (i) => !!i.targetUserId && i.targetUserId !== i.requesterId,
    detailOf: (i) => ({ targetUserId: i.targetUserId }),
  });

  const sync = withAudit(
    p.audit, 'SYNC',
    new SyncScheduleUseCase(
      { schedules: p.schedules, enrollments: p.enrollments, institutional: p.institutional, syncRuns: p.syncRuns, bus: p.bus },
      { semester: cfg.semester, concurrency: cfg.syncConcurrency },
    ),
    { entity: 'schedule', actorOf: (i) => i.actorId ?? 'system', detailOf: (i, o) => ({ trigger: i.trigger, ...o }) },
  );

  return {
    login: new LoginUseCase(p.users, p.hasher, p.tokens),
    logout: new LogoutUseCase(p.revoked),
    getWeekly,
    getDetail: new GetSessionDetailUseCase(p.schedules),
    exportSchedule: new ExportScheduleUseCase(weekly, p.users, p.exporters),
    sync,
    syncRuns: p.syncRuns,
    tokens: p.tokens,
    revoked: p.revoked,
  };
}
export type Container = ReturnType<typeof buildContainer>;
```

- [ ] **Step 3: Capa HTTP**

`backend/src/shared/http/asyncHandler.ts`:
```ts
import { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };
```

`backend/src/shared/http/auth.ts` (Chain of Responsibility: authenticate → requireRole):
```ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../errors';
import { RevokedTokenRepository, TokenPayload, TokenService } from '../../modules/auth/application/ports';
import { Role } from '../../modules/schedule/domain/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { auth?: TokenPayload } }
}

export const authenticate =
  (tokens: TokenService, revoked: RevokedTokenRepository): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header('authorization') ?? '';
      if (!header.startsWith('Bearer ')) throw unauthorized();
      const payload = tokens.verify(header.slice(7));
      if (await revoked.isRevoked(payload.jti)) throw unauthorized('Sesión cerrada');
      req.auth = payload;
      next();
    } catch (e) { next(e); }
  };

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(forbidden('No tienes permisos para esta acción'));
    next();
  };
```

`backend/src/shared/http/errorHandler.ts`:
```ts
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'Datos inválidos', issues: err.issues.map((i) => i.message) });
  }
  if (err instanceof AppError) return res.status(err.status).json({ code: err.code, message: err.message });
  console.error(err);
  res.status(500).json({ code: 'INTERNAL', message: 'Error interno del servidor' });
};
```

`backend/src/modules/auth/http/authRoutes.ts`:
```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate } from '../../../shared/http/auth';

const loginSchema = z.object({ email: z.string().email('Correo inválido'), password: z.string().min(1, 'Contraseña requerida') });

export function authRoutes(c: Container) {
  const r = Router();
  r.post('/login', rateLimit({ windowMs: 60_000, limit: 30 }), asyncHandler(async (req, res) => {
    res.json(await c.login.execute(loginSchema.parse(req.body)));
  }));
  r.post('/logout', authenticate(c.tokens, c.revoked), asyncHandler(async (req, res) => {
    await c.logout.execute({ jti: req.auth!.jti, exp: req.auth!.exp });
    res.status(204).end();
  }));
  return r;
}
```

`backend/src/modules/schedule/http/scheduleRoutes.ts`:
```ts
import { Router } from 'express';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';

const uuid = z.string().uuid('Identificador inválido');
const formatSchema = z.object({ format: z.enum(['ics', 'pdf'], { errorMap: () => ({ message: 'Formato inválido (ics|pdf)' }) }) });

export function scheduleRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked));

  r.get('/me', asyncHandler(async (req, res) => {
    res.json(await c.getWeekly.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role }));
  }));

  r.get('/me/export', asyncHandler(async (req, res) => {
    const { format } = formatSchema.parse(req.query);
    const out = await c.exportSchedule.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, format });
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.body);
  }));

  r.get('/users/:userId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    res.json(await c.getWeekly.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, targetUserId: uuid.parse(req.params.userId) }));
  }));

  r.get('/sessions/:externalId', asyncHandler(async (req, res) => {
    const ownerId = req.query.userId === undefined ? undefined : uuid.parse(req.query.userId);
    res.json(await c.getDetail.execute({
      requesterId: req.auth!.sub, requesterRole: req.auth!.role, externalId: req.params.externalId, ownerId,
    }));
  }));
  return r;
}
```

`backend/src/modules/schedule/http/adminRoutes.ts`:
```ts
import { Router } from 'express';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';

export function adminRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked), requireRole('ADMIN'));
  r.post('/sync', asyncHandler(async (req, res) => {
    res.json(await c.sync.execute({ trigger: 'MANUAL', actorId: req.auth!.sub }));
  }));
  r.get('/sync/runs', asyncHandler(async (_req, res) => {
    res.json(await c.syncRuns.list(20));
  }));
  return r;
}
```

`backend/src/shared/http/app.ts`:
```ts
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Config } from '../config';
import { Container } from '../container';
import { authRoutes } from '../../modules/auth/http/authRoutes';
import { adminRoutes } from '../../modules/schedule/http/adminRoutes';
import { scheduleRoutes } from '../../modules/schedule/http/scheduleRoutes';
import { notFound } from '../errors';
import { errorHandler } from './errorHandler';

export function createApp(c: Container, cfg: Config) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: cfg.corsOrigin, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(c));
  app.use('/api/schedule', scheduleRoutes(c));
  app.use('/api/admin', adminRoutes(c));
  app.use((_req, _res, next) => next(notFound('Ruta no encontrada')));
  app.use(errorHandler);
  return app;
}
```

> Nota: `/api/schedule/sessions/:externalId` con `POST/PUT/DELETE` cae en el 404 final (no hay handlers), cumpliendo RRF-02/07.

- [ ] **Step 4: Ejecutar tests de integración**

```bash
cd backend && npx vitest run tests/http
```
Expected: PASS. Corregir si algún caso falla (p. ej. el 404 de métodos de escritura requiere pasar `authenticate` antes: el router de `/schedule` aplica `authenticate` y luego no encuentra handler → `next()` → 404 final).

- [ ] **Step 5: Job, main, seed**

`backend/src/jobs/syncJob.ts`:
```ts
import cron from 'node-cron';
import { Container } from '../shared/container';

/** Sincronización masiva periódica; por defecto 03:00 (baja demanda). */
export function startSyncJob(c: Container, expression: string) {
  if (!cron.validate(expression)) throw new Error(`SYNC_CRON inválido: ${expression}`);
  return cron.schedule(expression, () => {
    c.sync.execute({ trigger: 'CRON' }).catch((e) => console.error('[syncJob] falló:', e));
  });
}
```

`backend/src/main.ts`:
```ts
import 'dotenv/config';
import { config } from './shared/config';
import { buildContainer } from './shared/container';
import { InMemoryEventBus } from './shared/eventBus';
import { createApp } from './shared/http/app';
import { startSyncJob } from './jobs/syncJob';
import { Argon2Hasher } from './modules/auth/infrastructure/Argon2Hasher';
import { JwtTokenService } from './modules/auth/infrastructure/JwtTokenService';
import { PrismaRevokedTokenRepository } from './modules/auth/infrastructure/PrismaRevokedTokenRepository';
import { PrismaUserRepository } from './modules/auth/infrastructure/PrismaUserRepository';
import { PrismaAuditLog } from './modules/audit/PrismaAuditLog';
import { registerAuditListener } from './modules/audit/auditListener';
import { MockInstitutionalAdapter } from './modules/schedule/infrastructure/MockInstitutionalAdapter';
import { PrismaEnrollmentRepository } from './modules/schedule/infrastructure/PrismaEnrollmentRepository';
import { PrismaScheduleRepository } from './modules/schedule/infrastructure/PrismaScheduleRepository';
import { PrismaSyncRunRepository } from './modules/schedule/infrastructure/PrismaSyncRunRepository';
import { IcsExporter } from './modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from './modules/schedule/infrastructure/exporters/PdfExporter';

export function wire() {
  const bus = new InMemoryEventBus();
  const audit = new PrismaAuditLog();
  registerAuditListener(bus, audit);
  return buildContainer({
    schedules: new PrismaScheduleRepository(),
    enrollments: new PrismaEnrollmentRepository(),
    institutional: new MockInstitutionalAdapter(),
    syncRuns: new PrismaSyncRunRepository(),
    users: new PrismaUserRepository(),
    revoked: new PrismaRevokedTokenRepository(),
    hasher: new Argon2Hasher(),
    tokens: new JwtTokenService(config.jwtSecret),
    audit,
    bus,
    exporters: {
      ics: new IcsExporter({ semesterStart: config.semesterStart, weeks: config.semesterWeeks }),
      pdf: new PdfExporter({ semester: config.semester }),
    },
  }, config);
}

if (require.main === module) {
  const container = wire();
  const app = createApp(container, config);
  startSyncJob(container, config.syncCron);
  app.listen(config.port, () => console.log(`API en http://localhost:${config.port}/api`));
}
```

Instalar dotenv: `cd backend && npm i dotenv`.

`backend/prisma/seed.ts`:
```ts
import 'dotenv/config';
import { prisma } from '../src/shared/prisma';
import { Argon2Hasher } from '../src/modules/auth/infrastructure/Argon2Hasher';
import { config } from '../src/shared/config';
import { wire } from '../src/main';

async function main() {
  const password = process.env.SEED_PASSWORD ?? 'Cambiar123!';
  const hash = await new Argon2Hasher().hash(password);
  const users = [
    { name: 'Administrador UNI', email: 'admin@horariouni.test', role: 'ADMIN' as const, enrolled: false },
    { name: 'Dilan Rojas', email: 'dilan@horariouni.test', role: 'STUDENT' as const, enrolled: true },
    { name: 'Sebastian Velez', email: 'sebastian@horariouni.test', role: 'STUDENT' as const, enrolled: true },
    { name: 'Estudiante Sin Matrícula', email: 'sinmatricula@horariouni.test', role: 'STUDENT' as const, enrolled: false },
  ];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { name: u.name, email: u.email, role: u.role, passwordHash: hash },
      update: { passwordHash: hash },
    });
    if (u.enrolled) {
      await prisma.enrollment.upsert({
        where: { userId_semester: { userId: user.id, semester: config.semester } },
        create: { userId: user.id, semester: config.semester, active: true },
        update: { active: true },
      });
    }
  }
  // Carga inicial del horario base (1.ª consulta del adaptador mock).
  const r = await wire().sync.execute({ trigger: 'MANUAL', actorId: 'seed' });
  console.log('Seed OK. Sincronización inicial:', r);
}

main().finally(() => prisma.$disconnect());
```

> Nota: `main.ts` solo arranca el servidor si es el módulo principal (`require.main === module`), así el seed puede importar `wire`.

- [ ] **Step 6: Verificar con Postgres real y commit**

```bash
cd backend && npm run seed
npm run dev &   # luego:
curl -s -X POST localhost:4000/api/auth/login -H 'content-type: application/json' -d '{"email":"dilan@horariouni.test","password":"Cambiar123!"}'
```
Expected: JSON con `token`. Con ese token, `GET /api/schedule/me` devuelve 8 sesiones. Detener el servidor y:

```bash
cd backend && npx vitest run && npx tsc -p . --noEmit
cd .. && git add -A && git commit -m "feat: http layer, container, sync job, seed and server entry"
```

---

### Task 8: Frontend — scaffold, tokens de diseño, API client y autenticación

**Files:**
- Create: `frontend/` (Vite React TS), `frontend/vite.config.ts`, `frontend/src/shared/{api.ts,tokens.css,app.css,ProtectedRoute.tsx,Layout.tsx}`, `frontend/src/features/auth/{AuthContext.tsx,LoginPage.tsx}`, `frontend/src/{main.tsx,App.tsx}`
- Test: `frontend/src/features/auth/AuthContext.test.tsx`

**Interfaces:**
- Produces:
  - `api.ts`: `api.get<T>(path)`, `api.post<T>(path, body?)`, `api.download(path, fallbackName)`, `setToken(t|null)`, `getToken()`, clase `ApiError {status, message}`. Base `/api`. En 401 limpia el token y dispara `window.dispatchEvent(new Event('auth:expired'))`.
  - `AuthContext`: `useAuth() → {user: AuthUser|null, login(email,password), logout(), loading}`; `AuthUser {id,name,email,role:'STUDENT'|'ADMIN'}`; token persistido en `sessionStorage` (`horario_token`) y usuario en `horario_user`.
  - `ProtectedRoute({role?})` (Outlet o Navigate a `/login`), `Layout` (header + nav + `<main id="main">`).
  - Tokens CSS: `--color-primary:#1F6F8B; --color-primary-dark:#175468; --color-accent:#F28C28; --color-text:#1B2A33; --color-bg:#F5F8FA; --color-surface:#fff; --color-border:#C9D6DD; --color-danger:#B3261E`.

- [ ] **Step 1: Scaffold**

```bash
cd /Users/dilanrojascarmona/Desktop/HorarioAQ
npm create vite@latest frontend -- --template react-ts
cd frontend && npm i react-router-dom@6
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

`frontend/vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
});
```

`frontend/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

Añadir a `package.json` scripts: `"test": "vitest run"`. Borrar `src/App.css`, `src/index.css` y assets de ejemplo.

- [ ] **Step 2: Estilos**

`frontend/src/shared/tokens.css`:
```css
:root {
  --color-primary: #1F6F8B;
  --color-primary-dark: #175468;
  --color-accent: #F28C28;
  --color-text: #1B2A33;
  --color-muted: #4A5B66;
  --color-bg: #F5F8FA;
  --color-surface: #FFFFFF;
  --color-border: #C9D6DD;
  --color-danger: #B3261E;
  --color-ok: #1B6E3C;
  --radius: 10px;
  --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

`frontend/src/shared/app.css`:
```css
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); color: var(--color-text); background: var(--color-bg); line-height: 1.5; }
h1, h2, h3 { line-height: 1.2; margin: 0 0 .5rem; }
a { color: var(--color-primary-dark); }
:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.skip-link { position: absolute; left: -999px; top: 0; background: var(--color-surface); padding: .5rem 1rem; z-index: 10; }
.skip-link:focus { left: .5rem; top: .5rem; }

.app-header { background: var(--color-primary); color: #fff; display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.5rem; padding: .75rem 1rem; border-bottom: 4px solid var(--color-accent); }
.app-header a, .app-header button { color: #fff; }
.app-header nav { display: flex; gap: 1rem; flex: 1; }
.app-header .user { font-size: .9rem; }
.container { max-width: 1100px; margin: 0 auto; padding: 1rem; }

.btn { min-height: 44px; padding: .5rem 1rem; border-radius: var(--radius); border: 1px solid var(--color-primary-dark); background: var(--color-primary); color: #fff; font: inherit; cursor: pointer; }
.btn:hover:not(:disabled) { background: var(--color-primary-dark); }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.secondary { background: var(--color-surface); color: var(--color-primary-dark); }
.btn.link { background: none; border: none; text-decoration: underline; color: inherit; padding: 0 .25rem; min-height: 44px; }

.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 1rem; margin-bottom: 1rem; }
.field { display: flex; flex-direction: column; gap: .25rem; margin-bottom: 1rem; }
.field input { min-height: 44px; padding: .5rem; border: 1px solid var(--color-muted); border-radius: 8px; font: inherit; }
.error { color: var(--color-danger); font-weight: 600; }
.muted { color: var(--color-muted); }

.today-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
.today-list li { display: flex; gap: .75rem; align-items: baseline; }
.time { font-variant-numeric: tabular-nums; font-weight: 700; }

/* Calendario semanal (grid de 30 min) */
.week-wrap { overflow-x: auto; }
.week-grid { display: grid; grid-template-columns: 56px repeat(6, minmax(120px, 1fr)); grid-auto-rows: 28px; gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); min-width: 780px; }
.week-grid .head { background: var(--color-primary); color: #fff; font-weight: 700; text-align: center; padding: .25rem; grid-row: 1; }
.week-grid .hour { background: var(--color-surface); font-size: .75rem; color: var(--color-muted); padding: 2px 4px; }
.week-grid .slot { background: var(--color-surface); }
.session { text-align: left; background: #DCEFF5; border: 1px solid var(--color-primary); border-left: 5px solid var(--color-accent); border-radius: 6px; padding: 2px 6px; font: inherit; font-size: .8rem; color: var(--color-text); cursor: pointer; overflow: hidden; margin: 1px; }
.session:hover { background: #C5E4EE; }
.session strong { display: block; }

.agenda { display: none; }
.agenda ul { list-style: none; padding: 0; margin: 0 0 1rem; display: grid; gap: .5rem; }
.agenda li button { width: 100%; text-align: left; }

@media (max-width: 767px) {
  .week-wrap { display: none; }
  .agenda { display: block; }
}

.detail dl { display: grid; grid-template-columns: max-content 1fr; gap: .25rem 1rem; margin: 0; }
.detail dt { font-weight: 700; }
.detail dd { margin: 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: 1rem; }
table.runs { width: 100%; border-collapse: collapse; }
table.runs th, table.runs td { border-bottom: 1px solid var(--color-border); padding: .5rem; text-align: left; }
```

- [ ] **Step 3: API client**

`frontend/src/shared/api.ts`:
```ts
const BASE = '/api';
const KEY = 'horario_token';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let token: string | null = null;
try { token = sessionStorage.getItem(KEY); } catch { /* storage no disponible */ }

export const getToken = () => token;
export function setToken(t: string | null) {
  token = t;
  try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('auth:expired')); }
    let message = 'Error inesperado';
    try { message = (await res.json()).message ?? message; } catch { /* sin cuerpo */ }
    throw new ApiError(res.status, message);
  }
  return res;
}

export const api = {
  get: async <T>(path: string): Promise<T> => (await raw(path)).json(),
  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await raw(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
    return res.status === 204 ? (undefined as T) : res.json();
  },
  async download(path: string, fallbackName: string) {
    const res = await raw(path);
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  },
};
```

- [ ] **Step 4: Test del contexto de sesión (falla primero)**

`frontend/src/features/auth/AuthContext.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../../shared/api';

vi.mock('../../shared/api', async (orig) => {
  const real = await orig<typeof import('../../shared/api')>();
  return { ...real, api: { ...real.api, post: vi.fn(), get: vi.fn() } };
});

function Probe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ? user.name : 'anon'}</span>
      <button onClick={() => login('a@x.co', 'pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('login guarda usuario y logout lo limpia', async () => {
    (api.post as any).mockImplementation(async (path: string) =>
      path === '/auth/login' ? { token: 't1', user: { id: '1', name: 'Ana', email: 'a@x.co', role: 'STUDENT' } } : undefined);
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
    await userEvent.click(screen.getByText('login'));
    expect(screen.getByTestId('who')).toHaveTextContent('Ana');
    expect(sessionStorage.getItem('horario_token')).toBe('t1');
    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
    expect(sessionStorage.getItem('horario_token')).toBeNull();
  });

  it('auth:expired cierra la sesión', async () => {
    sessionStorage.setItem('horario_token', 't');
    sessionStorage.setItem('horario_user', JSON.stringify({ id: '1', name: 'Ana', email: 'a', role: 'STUDENT' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('Ana');
    act(() => { window.dispatchEvent(new Event('auth:expired')); });
    expect(screen.getByTestId('who')).toHaveTextContent('anon');
  });
});
```

- [ ] **Step 5: Implementar auth y shell**

`frontend/src/features/auth/AuthContext.tsx`:
```tsx
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken } from '../../shared/api';

export interface AuthUser { id: string; name: string; email: string; role: 'STUDENT' | 'ADMIN' }
interface Ctx {
  user: AuthUser | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);
const USER_KEY = 'horario_user';

const readUser = (): AuthUser | null => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);

  const clear = useCallback(() => {
    setToken(null);
    try { sessionStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:expired', clear);
    return () => window.removeEventListener('auth:expired', clear);
  }, [clear]);

  const value = useMemo<Ctx>(() => ({
    user,
    async login(email, password) {
      const r = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
      setToken(r.token);
      try { sessionStorage.setItem(USER_KEY, JSON.stringify(r.user)); } catch { /* ignore */ }
      setUser(r.user);
    },
    async logout() {
      try { await api.post('/auth/logout'); } catch { /* sesión ya inválida */ }
      clear();
    },
  }), [user, clear]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return c;
}
```

`frontend/src/features/auth/LoginPage.tsx`:
```tsx
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión'); }
    finally { setBusy(false); }
  }

  const valid = /\S+@\S+\.\S+/.test(email) && password.length > 0;
  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <h1>Horario UNI</h1>
      <p className="muted">Inicia sesión para ver tu horario.</p>
      <form className="card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="btn" type="submit" disabled={!valid || busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
```

`frontend/src/shared/ProtectedRoute.tsx`:
```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export default function ProtectedRoute({ role }: { role?: 'ADMIN' | 'STUDENT' }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
```

`frontend/src/shared/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <header className="app-header">
        <strong>Horario UNI</strong>
        <nav aria-label="Principal">
          {user?.role === 'STUDENT' && <NavLink to="/">Mi horario</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin">Sincronización</NavLink>}
        </nav>
        <span className="user">{user?.name}</span>
        <button className="btn link" onClick={() => logout()}>Cerrar sesión</button>
      </header>
      <main id="main" className="container"><Outlet /></main>
    </>
  );
}
```

`frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminPage from './features/admin/AdminPage';
import SchedulePage from './features/schedule/SchedulePage';
import Layout from './shared/Layout';
import ProtectedRoute from './shared/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute role="STUDENT" />}>
                <Route path="/" element={<SchedulePage />} />
              </Route>
              <Route element={<ProtectedRoute role="ADMIN" />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './shared/app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

Actualizar `index.html`: `<html lang="es">` y `<title>Horario UNI</title>`.

(`SchedulePage` y `AdminPage` se crean en Task 9; mientras tanto crear stubs `export default function X() { return null; }` para que compile, y reemplazarlos allí.)

- [ ] **Step 6: Ejecutar tests y commit**

```bash
cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.app.json
cd .. && git add -A && git commit -m "feat(frontend): scaffold, design tokens, api client, auth"
```

---

### Task 9: Frontend — horario semanal, hoy, detalle, exportación y panel de sincronización

**Files:**
- Create: `frontend/src/features/schedule/{types.ts,grid.ts,useSchedule.ts,WeeklyCalendar.tsx,AgendaList.tsx,ClassDetail.tsx,ExportMenu.tsx,SchedulePage.tsx}`, `frontend/src/features/admin/AdminPage.tsx` (reemplaza stubs)
- Test: `frontend/src/features/schedule/grid.test.ts`, `frontend/src/features/schedule/WeeklyCalendar.test.tsx`

**Interfaces:**
- Consumes: `api`, `useAuth` (Task 8); API de Task 7.
- Produces:
  - `types.ts`: `Session` (mismos campos que `ClassSession`), `WeeklyResult {userId, semester, enrolled, sessions}`.
  - `grid.ts`: `WEEKDAYS: {n:number; label:string}[]` (lunes–sábado), `toMinutes(t)`, `GRID_START=420` (07:00), `GRID_END=1260` (21:00), `gridRow(t) = (toMinutes(t)-GRID_START)/30 + 2`, `sessionsByDay(sessions) → Record<number, Session[]>`, `todaySessions(sessions, date=new Date())`.
  - `WeeklyCalendar({sessions, onSelect(s)})`, `AgendaList({sessions, onSelect})`, `ClassDetail({session, onClose})`, `ExportMenu()`, `useSchedule() → {data, error, loading}`.

- [ ] **Step 1: Tests de `grid` y calendario (fallan primero)**

`frontend/src/features/schedule/grid.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gridRow, sessionsByDay, todaySessions, toMinutes } from './grid';
import type { Session } from './types';

const s = (weekday: number, startTime: string, id = `${weekday}${startTime}`): Session => ({
  externalId: id, userId: 'u', semester: '2026-2', courseCode: 'X', courseName: 'X', teacher: 'T',
  weekday: weekday as Session['weekday'], startTime, endTime: '23:00', block: 'A', floor: 1, room: '1', status: 'ACTIVE',
});

describe('grid', () => {
  it('toMinutes', () => { expect(toMinutes('08:30')).toBe(510); });
  it('gridRow: 07:00 → fila 2; 08:00 → fila 4; 08:30 → fila 5', () => {
    expect(gridRow('07:00')).toBe(2);
    expect(gridRow('08:00')).toBe(4);
    expect(gridRow('08:30')).toBe(5);
  });
  it('sessionsByDay agrupa y ordena por hora', () => {
    const r = sessionsByDay([s(2, '10:00'), s(1, '14:00'), s(1, '08:00')]);
    expect(r[1].map((x) => x.startTime)).toEqual(['08:00', '14:00']);
    expect(r[2]).toHaveLength(1);
    expect(r[3]).toEqual([]);
  });
  it('todaySessions usa el día ISO de la fecha dada', () => {
    const wed = new Date('2026-10-07T12:00:00'); // miércoles
    expect(todaySessions([s(3, '08:00'), s(1, '08:00')], wed)).toHaveLength(1);
    const sun = new Date('2026-10-04T12:00:00'); // domingo → 7
    expect(todaySessions([s(7, '08:00')], sun)).toHaveLength(1);
  });
});
```

`frontend/src/features/schedule/WeeklyCalendar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeeklyCalendar from './WeeklyCalendar';
import type { Session } from './types';

const sess: Session = {
  externalId: 'e1', userId: 'u', semester: '2026-2', courseCode: 'ALG101', courseName: 'Algoritmos', teacher: 'Marta',
  weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 2, room: '201', status: 'ACTIVE',
};

describe('WeeklyCalendar', () => {
  it('muestra encabezados de días y la clase con materia, salón y bloque', () => {
    render(<WeeklyCalendar sessions={[sess]} onSelect={() => {}} />);
    expect(screen.getByText('Lunes')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Algoritmos/ });
    expect(btn).toHaveTextContent('Aula 201');
    expect(btn).toHaveTextContent('Bloque A');
  });
  it('al hacer clic llama onSelect con la sesión', async () => {
    const onSelect = vi.fn();
    render(<WeeklyCalendar sessions={[sess]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Algoritmos/ }));
    expect(onSelect).toHaveBeenCalledWith(sess);
  });
  it('la clase ocupa las filas correspondientes a su duración', () => {
    render(<WeeklyCalendar sessions={[sess]} onSelect={() => {}} />);
    const btn = screen.getByRole('button', { name: /Algoritmos/ });
    expect(btn.style.gridRow).toBe('4 / 8'); // 08:00 → fila 4; 10:00 → fila 8
    expect(btn.style.gridColumn).toBe('2');
  });
});
```

- [ ] **Step 2: Implementación**

`types.ts`:
```ts
export interface Session {
  externalId: string; userId: string; semester: string; courseCode: string; courseName: string; teacher: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; startTime: string; endTime: string;
  block: string; floor: number; room: string; status: 'ACTIVE' | 'CANCELLED';
}
export interface WeeklyResult { userId: string; semester: string; enrolled: boolean; sessions: Session[] }
```

`grid.ts`:
```ts
import type { Session } from './types';

export const WEEKDAYS = [
  { n: 1, label: 'Lunes' }, { n: 2, label: 'Martes' }, { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' }, { n: 5, label: 'Viernes' }, { n: 6, label: 'Sábado' },
];
export const GRID_START = 7 * 60;
export const GRID_END = 21 * 60;

export const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const gridRow = (t: string) => (toMinutes(t) - GRID_START) / 30 + 2;

export function sessionsByDay(sessions: Session[]): Record<number, Session[]> {
  const out: Record<number, Session[]> = {};
  for (const d of WEEKDAYS) out[d.n] = [];
  for (const s of sessions) (out[s.weekday] ??= []).push(s);
  for (const k of Object.keys(out)) out[+k].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return out;
}

export function todaySessions(sessions: Session[], date = new Date()): Session[] {
  const day = date.getDay() || 7;
  return sessions.filter((s) => s.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
}
```

`WeeklyCalendar.tsx`:
```tsx
import { GRID_END, GRID_START, WEEKDAYS, gridRow } from './grid';
import type { Session } from './types';

const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, i) => GRID_START / 60 + i);

export default function WeeklyCalendar({ sessions, onSelect }: { sessions: Session[]; onSelect(s: Session): void }) {
  return (
    <div className="week-wrap">
      <div className="week-grid" role="group" aria-label="Horario semanal">
        <div className="head" style={{ gridColumn: 1 }} aria-hidden="true" />
        {WEEKDAYS.map((d) => (
          <div key={d.n} className="head" style={{ gridColumn: d.n + 1 }}>{d.label}</div>
        ))}
        {HOURS.map((h) => (
          <div key={h} className="hour" style={{ gridColumn: 1, gridRow: `${(h * 60 - GRID_START) / 30 + 2} / span 2` }}>
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
        {sessions.map((s) => (
          <button
            key={s.externalId}
            type="button"
            className="session"
            style={{ gridColumn: String(s.weekday + 1), gridRow: `${gridRow(s.startTime)} / ${gridRow(s.endTime)}` }}
            onClick={() => onSelect(s)}
            aria-label={`${s.courseName}, ${WEEKDAYS.find((d) => d.n === s.weekday)?.label} ${s.startTime} a ${s.endTime}, bloque ${s.block}, aula ${s.room}`}
          >
            <strong>{s.courseName}</strong>
            <span>{s.startTime}–{s.endTime}</span><br />
            <span>Bloque {s.block} · Aula {s.room}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

> Nota de test: el `aria-label` incluye «Algoritmos», y `toHaveTextContent` lee el contenido visible (`Aula 201`, `Bloque A`).

`AgendaList.tsx` (vista móvil, misma información):
```tsx
import { WEEKDAYS, sessionsByDay } from './grid';
import type { Session } from './types';

export default function AgendaList({ sessions, onSelect }: { sessions: Session[]; onSelect(s: Session): void }) {
  const byDay = sessionsByDay(sessions);
  return (
    <div className="agenda">
      {WEEKDAYS.filter((d) => byDay[d.n].length > 0).map((d) => (
        <section key={d.n} aria-labelledby={`day-${d.n}`}>
          <h3 id={`day-${d.n}`}>{d.label}</h3>
          <ul>
            {byDay[d.n].map((s) => (
              <li key={s.externalId}>
                <button type="button" className="btn secondary" onClick={() => onSelect(s)}>
                  <span className="time">{s.startTime}–{s.endTime}</span> {s.courseName}<br />
                  <span className="muted">Bloque {s.block} · Piso {s.floor} · Aula {s.room}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`ClassDetail.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { WEEKDAYS } from './grid';
import type { Session } from './types';

export default function ClassDetail({ session, onClose }: { session: Session; onClose(): void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, onClose]);

  return (
    <section ref={ref} tabIndex={-1} className="card detail" aria-labelledby="detail-title" role="region">
      <h2 id="detail-title">{session.courseName}</h2>
      <dl>
        <dt>Código</dt><dd>{session.courseCode}</dd>
        <dt>Docente</dt><dd>{session.teacher}</dd>
        <dt>Día</dt><dd>{WEEKDAYS.find((d) => d.n === session.weekday)?.label}</dd>
        <dt>Franja</dt><dd>{session.startTime} – {session.endTime}</dd>
        <dt>Bloque</dt><dd>{session.block}</dd>
        <dt>Piso</dt><dd>{session.floor}</dd>
        <dt>Aula</dt><dd>{session.room}</dd>
      </dl>
      <p><button className="btn secondary" onClick={onClose}>Cerrar detalle</button></p>
    </section>
  );
}
```

`useSchedule.ts`:
```ts
import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import type { WeeklyResult } from './types';

export function useSchedule() {
  const [data, setData] = useState<WeeklyResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get<WeeklyResult>('/schedule/me')
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  return { data, error, loading };
}
```

`ExportMenu.tsx`:
```tsx
import { useState } from 'react';
import { api } from '../../shared/api';

export default function ExportMenu() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(format: 'ics' | 'pdf') {
    setBusy(true); setError('');
    try { await api.download(`/schedule/me/export?format=${format}`, `horario.${format}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo exportar'); }
    finally { setBusy(false); }
  }
  return (
    <div className="toolbar" role="group" aria-label="Exportar horario">
      <button className="btn secondary" disabled={busy} onClick={() => run('pdf')}>Exportar PDF</button>
      <button className="btn secondary" disabled={busy} onClick={() => run('ics')}>Exportar .ics (Google Calendar / Outlook)</button>
      {error && <span role="alert" className="error">{error}</span>}
    </div>
  );
}
```

`SchedulePage.tsx` (home: «Hoy» primero, semanal debajo — reconocimiento de idoneidad y ≤2 clics):
```tsx
import { useState } from 'react';
import AgendaList from './AgendaList';
import ClassDetail from './ClassDetail';
import ExportMenu from './ExportMenu';
import WeeklyCalendar from './WeeklyCalendar';
import { todaySessions, WEEKDAYS } from './grid';
import type { Session } from './types';
import { useSchedule } from './useSchedule';

export default function SchedulePage() {
  const { data, error, loading } = useSchedule();
  const [selected, setSelected] = useState<Session | null>(null);

  if (loading) return <p role="status">Cargando horario…</p>;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!data?.enrolled) {
    return <p className="card" role="status">No tienes matrícula vigente en el semestre {data?.semester}. Contacta a Admisiones y Registro.</p>;
  }

  const today = todaySessions(data.sessions);
  const dayName = WEEKDAYS.find((d) => d.n === (new Date().getDay() || 7))?.label ?? 'Domingo';

  return (
    <>
      <h1>Mi horario · {data.semester}</h1>
      <section className="card" aria-labelledby="today-title">
        <h2 id="today-title">Hoy ({dayName})</h2>
        {today.length === 0 ? <p className="muted">No tienes clases hoy.</p> : (
          <ul className="today-list">
            {today.map((s) => (
              <li key={s.externalId}>
                <span className="time">{s.startTime}–{s.endTime}</span>
                <button className="btn link" onClick={() => setSelected(s)}>{s.courseName}</button>
                <span className="muted">Bloque {s.block} · Aula {s.room}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && <ClassDetail session={selected} onClose={() => setSelected(null)} />}
      <ExportMenu />
      <h2>Semana</h2>
      <WeeklyCalendar sessions={data.sessions} onSelect={setSelected} />
      <AgendaList sessions={data.sessions} onSelect={setSelected} />
    </>
  );
}
```

`frontend/src/features/admin/AdminPage.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';

interface Run { id: string; trigger: string; startedAt: string; finishedAt: string | null; studentsSynced: number; changesCount: number; status: string }

export default function AdminPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get<Run[]>('/admin/sync/runs').then(setRuns).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await api.post<{ studentsSynced: number; changesCount: number }>('/admin/sync');
      setMsg(`Sincronización completada: ${r.studentsSynced} estudiantes, ${r.changesCount} cambios.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al sincronizar'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h1>Sincronización institucional</h1>
      <p className="muted">Los horarios solo cambian por sincronización con el sistema institucional.</p>
      <div className="toolbar">
        <button className="btn" onClick={sync} disabled={busy}>{busy ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
        {msg && <span role="status">{msg}</span>}
        {error && <span role="alert" className="error">{error}</span>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="runs">
          <caption className="muted" style={{ textAlign: 'left' }}>Últimas corridas</caption>
          <thead><tr><th>Inicio</th><th>Origen</th><th>Estudiantes</th><th>Cambios</th><th>Estado</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.startedAt).toLocaleString('es-CO')}</td><td>{r.trigger}</td>
                <td>{r.studentsSynced}</td><td>{r.changesCount}</td><td>{r.status}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={5} className="muted">Aún no hay corridas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Ejecutar tests, type-check, build y commit**

```bash
cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run build
cd .. && git add -A && git commit -m "feat(frontend): weekly schedule, today, detail, export and admin sync"
```
Expected: PASS y build exitoso.

---

### Task 10: Verificación end-to-end, Docker, README y cobertura

**Files:**
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `README.md`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `docker compose up --build` levanta postgres + backend + frontend en `http://localhost:8080`; README con arranque, usuarios semilla, mapa requisito→código y patrones.

- [ ] **Step 1: Cobertura del backend (RNF-11)**

```bash
cd backend && npm run test:cov
```
Expected: umbrales ≥70% cumplidos. Si no, añadir tests a los casos sin cubrir antes de continuar.

- [ ] **Step 2: Dockerfiles y nginx**

`backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

`frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`frontend/nginx.conf`:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location /api/ { proxy_pass http://backend:4000; }
  location / { try_files $uri /index.html; }
}
```

`docker-compose.yml` completo:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: horario, POSTGRES_PASSWORD: horario, POSTGRES_DB: horario }
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U horario"], interval: 5s, retries: 10 }
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://horario:horario@postgres:5432/horario
      JWT_SECRET: ${JWT_SECRET:-cambia-esto-en-produccion}
      CORS_ORIGIN: http://localhost:8080
    depends_on: { postgres: { condition: service_healthy } }
  frontend:
    build: ./frontend
    ports: ["8080:80"]
    depends_on: [backend]
  backup:
    image: postgres:16-alpine
    environment: { PGPASSWORD: horario }
    volumes: ["./backups:/backups"]
    depends_on: { postgres: { condition: service_healthy } }
    # Copia diaria (RNF-15, RPO ≤ 24 h)
    entrypoint: ["sh", "-c", "while true; do pg_dump -h postgres -U horario horario > /backups/horario-$$(date +%F).sql; sleep 86400; done"]
volumes:
  pgdata:
```

> Escalado horizontal (RNF-10): el backend no guarda estado (JWT + lista de revocados en Postgres), por lo que `docker compose up --scale backend=3` es viable detrás de un balanceador. Aviso: con varias réplicas el cron de sincronización se ejecutaría en cada una; en ese caso dejar `SYNC_CRON` activo en una sola (documentado en el README).

- [ ] **Step 3: Prueba manual end-to-end en navegador**

```bash
cd backend && npm run dev          # terminal 1 (tras `npm run seed`)
cd frontend && npm run dev         # terminal 2 → http://localhost:5173
```
Verificar, en este orden:
1. Login `dilan@horariouni.test` con la contraseña de `SEED_PASSWORD` → home muestra «Hoy» y el calendario semanal con 8 clases.
2. Clic en una clase → detalle (materia, docente, bloque, piso, aula, franja).
3. Exportar PDF y `.ics` → se descargan; abrir el `.ics` en un calendario.
4. Cerrar sesión; entrar como `admin@horariouni.test` → «Sincronizar ahora» (1.ª vez: 0 cambios; 2.ª vez: cambios).
5. Volver como Dilan → ALG101 en bloque B/aula 305, PHY201 desaparece, aparece LAB301.
6. Entrar como `sinmatricula@horariouni.test` → mensaje de matrícula no vigente (RRF-01).
7. Redimensionar a 320px → se muestra la agenda por día; navegación con Tab y foco visible.

- [ ] **Step 4: README.md** con: descripción, requisitos (Node 20, Docker), arranque local y con Docker, usuarios semilla, variables de entorno, tabla requisito → archivo (RF-HOR-01..05, RRF-01/02/04/07, RNF-01/04/05/06/08/09/10/11/14/15), tabla de patrones (copiar la de la spec), nota sobre el adaptador mock y cómo sustituirlo (`InstitutionalPort`), límites de esta iteración y cómo probar carga (`autocannon` contra `/api/schedule/me`, objetivo p95 < 2 s, 200 conexiones).

- [ ] **Step 5: Commit final**

```bash
cd /Users/dilanrojascarmona/Desktop/HorarioAQ
git add -A && git commit -m "chore: docker, readme, coverage verification"
```

---

## Self-Review (spec coverage)

- RF-HOR-01 → Tasks 3 (GetWeekly), 7 (`/schedule/me`), 9 (WeeklyCalendar/AgendaList). RF-HOR-02/05 → Tasks 2 (diff), 3 (Sync), 6 (mock), 7 (job + `/admin/sync`). RF-HOR-03 → Tasks 3, 7, 9 (ClassDetail). RF-HOR-04 → Task 4, 7, 9.
- RRF-01 → Task 3 (enrolled/lista de matriculados) + Task 9 mensaje. RRF-02/07 → único escritor `SyncScheduleUseCase`; test «no existen rutas de escritura». RRF-04 → `assertCanView` + auditoría de terceros.
- RNF-04/05 (argon2, JWT 60 min), RNF-06 (RBAC `requireRole`), RNF-08/09 (responsive/AA), RNF-10 (stateless), RNF-11 (cobertura, Task 10), RNF-14 (AuditLog: sync, terceros, ScheduleChanged), RNF-15 (servicio `backup`).
- Patrones: Repository, Adapter, Template Method, Observer, Facade, Chain, Decorator, DI, Singleton — todos presentes.
- Fuera de alcance (registro/OTP, huecos, notificaciones, búsqueda, Brevo): no se implementan; `ScheduleChanged` se emite y audita.
- Consistencia de tipos: `ClassSession`/`ScheduleChange` (Task 2) → usados idénticos en Tasks 3, 4, 6, 7; `WeeklyResult`/`Session` en frontend reflejan el backend; `SyncResult {runId, studentsSynced, changesCount}` coincide con lo que consume `AdminPage`.
- Desviaciones menores respecto a la spec: la ruta de terceros es `/api/schedule/users/:userId`; `Faculty/Program` no se modelan (fuera de alcance).
