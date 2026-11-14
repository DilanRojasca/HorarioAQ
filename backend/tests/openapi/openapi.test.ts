import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildContainer } from '../../src/shared/container';
import { createApp } from '../../src/shared/http/app';
import { buildV1Router } from '../../src/shared/http/v1';
import { buildOpenApiDocument } from '../../src/shared/openapi/spec';
import { SseHub } from '../../src/modules/realtime/SseHub';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import {
  FakeHasher, FakeInstitutional, FakeTokens, InMemoryEnrollmentRepo, InMemoryNotifications, InMemoryRevoked,
  InMemoryScheduleRepo, InMemorySyncRuns, InMemoryUsers, RecordingAudit, extraPorts, session,
} from '../helpers/inMemory';

const cfg = { port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16, syncCron: '', syncConcurrency: 2 };
const U1 = '11111111-1111-4111-8111-111111111111';

function makeContainer() {
  const audit = new RecordingAudit();
  const schedules = new InMemoryScheduleRepo();
  schedules.rows = [session({ userId: U1 })];
  const users = new InMemoryUsers([{ id: U1, name: 'U1', email: 'u1@x.co', passwordHash: 'hash:Secreta123!', role: 'STUDENT', active: true, verifiedAt: new Date() }]);
  return buildContainer({
    schedules, enrollments: new InMemoryEnrollmentRepo([U1]), institutional: new FakeInstitutional(), syncRuns: new InMemorySyncRuns(), users,
    revoked: new InMemoryRevoked(), hasher: new FakeHasher(), tokens: new FakeTokens(), audit, bus: new EventBus({ sleep: async () => {} }),
    eventLog: new InMemoryEventLog(), notifications: new InMemoryNotifications(), hub: new SseHub(), ...extraPorts(audit),
    exporters: { ics: new IcsExporter({ semesterStart: cfg.semesterStart, weeks: 16 }), pdf: new PdfExporter({ semester: '2026-2' }) },
  }, cfg);
}

/** Recorre el router de Express y devuelve «MÉTODO /ruta» (con `{param}` al estilo OpenAPI). */
function expressRoutes(router: unknown, base = ''): string[] {
  const out: string[] = [];
  for (const layer of (router as { stack: Array<Record<string, any>> }).stack) {
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) out.push(`${m.toUpperCase()} ${(base + layer.route.path).replace(/\/$/, '').replace(/:(\w+)/g, '{$1}')}`);
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const mount = layer.regexp.source.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
      out.push(...expressRoutes(layer.handle, base + mount));
    }
  }
  return out;
}

let app: ReturnType<typeof createApp>;
let container: ReturnType<typeof makeContainer>;
beforeAll(() => { container = makeContainer(); app = createApp(container, cfg); });

describe('Contrato OpenAPI', () => {
  const doc = buildOpenApiDocument() as any;

  it('es un documento OpenAPI 3 válido (referencias, esquemas y parámetros)', async () => {
    await expect(SwaggerParser.validate(JSON.parse(JSON.stringify(doc)))).resolves.toBeTruthy();
    expect(doc.openapi).toMatch(/^3\.0/);
    expect(doc.servers[0].url).toBe('/api/v1');
  });

  it('documenta EXACTAMENTE las rutas que existen (sin rutas sin documentar ni documentación huérfana)', () => {
    const real = expressRoutes(buildV1Router(container)).sort();
    const documented = Object.entries(doc.paths).flatMap(([p, ops]) => Object.keys(ops as object).map((m) => `${m.toUpperCase()} ${p}`)).sort();
    expect(documented).toEqual(real);
  });

  it('cada operación tiene operationId único, resumen, etiqueta y respuestas de error coherentes con su seguridad', () => {
    const ids = new Set<string>();
    for (const [path, ops] of Object.entries<any>(doc.paths)) {
      for (const [method, o] of Object.entries<any>(ops)) {
        const where = `${method.toUpperCase()} ${path}`;
        expect(o.operationId, where).toBeTruthy();
        expect(ids.has(o.operationId), `${where}: operationId repetido`).toBe(false);
        ids.add(o.operationId);
        expect(o.summary, where).toBeTruthy();
        expect(o.tags?.length, where).toBeGreaterThan(0);
        const isPublic = Array.isArray(o.security) && o.security.length === 0;
        if (!isPublic) {
          expect(o.security, where).toEqual([{ bearerAuth: [] }]);
          expect(o.responses['401'], `${where} debe documentar 401`).toBeTruthy();
        }
        if (/Solo (administradores|estudiantes)/.test(o.description)) expect(o.responses['403'], `${where} debe documentar 403`).toBeTruthy();
        if (o.requestBody) expect(o.responses['400'], `${where} debe documentar 400`).toBeTruthy();
        expect(Object.keys(o.responses).some((c) => /^2\d\d$/.test(c)), `${where} sin respuesta de éxito`).toBe(true);
      }
    }
  });

  it('los endpoints públicos son solo los de acceso a la cuenta y la salud', () => {
    const open = Object.entries<any>(doc.paths).flatMap(([p, ops]) => Object.entries<any>(ops).filter(([, o]) => o.security?.length === 0).map(([m]) => `${m.toUpperCase()} ${p}`)).sort();
    expect(open).toEqual([
      'GET /health', 'POST /auth/login', 'POST /auth/password/forgot', 'POST /auth/password/reset', 'POST /auth/refresh',
      'POST /auth/register', 'POST /auth/verify', 'POST /auth/verify/resend',
    ].sort());
  });

  it('define el esquema bearer JWT y el formato de error único', () => {
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(Object.keys(doc.components.responses).sort()).toEqual(['BadRequest', 'Conflict', 'Forbidden', 'NotFound', 'PayloadTooLarge', 'TooManyRequests', 'Unauthorized']);
    expect(doc.components.schemas.ErrorResponse.required).toEqual(expect.arrayContaining(['code', 'message', 'requestId']));
  });
});

describe('Documentación servida', () => {
  it('GET /api/v1/openapi.json devuelve el contrato', async () => {
    const r = await request(app).get('/api/v1/openapi.json');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/json/);
    expect(r.body.info.title).toMatch(/Horario UNI/);
  });
  it('GET /api/v1/docs/ sirve Swagger UI sin pedir token', async () => {
    const r = await request(app).get('/api/v1/docs/');
    expect(r.status).toBe(200);
    expect(r.text).toContain('swagger-ui');
  });
});

describe('Versionado y buenas prácticas de la API', () => {
  it('/api/v1/health responde con la versión y la sonda /api/health sigue sin versión', async () => {
    expect((await request(app).get('/api/v1/health')).body).toEqual({ ok: true, version: 'v1' });
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true });
  });
  it('las rutas sin versión siguen funcionando pero marcadas como obsoletas, con enlace a su sucesor', async () => {
    const legacy = await request(app).post('/api/auth/login').send({ email: 'u1@x.co', password: 'Secreta123!' });
    expect(legacy.status).toBe(200);
    expect(legacy.headers.deprecation).toBe('true');
    expect(legacy.headers.link).toContain('</api/v1/auth/login>; rel="successor-version"');
    const v1 = await request(app).post('/api/v1/auth/login').send({ email: 'u1@x.co', password: 'Secreta123!' });
    expect(v1.headers.deprecation).toBeUndefined();
  });
  it('X-Request-Id: se genera, se respeta el del cliente y se rechaza uno inseguro', async () => {
    const gen = await request(app).get('/api/v1/health');
    expect(gen.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect((await request(app).get('/api/v1/health').set('X-Request-Id', 'mi-correlacion-123')).headers['x-request-id']).toBe('mi-correlacion-123');
    expect((await request(app).get('/api/v1/health').set('X-Request-Id', 'x<script>')).headers['x-request-id']).not.toContain('<');
  });
  it('todo error usa el mismo formato { code, message, requestId } y el requestId coincide con la cabecera', async () => {
    for (const r of [
      await request(app).get('/api/v1/schedule/me'),                                       // 401
      await request(app).post('/api/v1/auth/login').send({ email: 'no-es-correo' }),       // 400
      await request(app).get('/api/v1/no-existe'),                                         // 404
    ]) {
      expect(r.body).toEqual(expect.objectContaining({ code: expect.any(String), message: expect.any(String), requestId: r.headers['x-request-id'] }));
    }
  });
  it('las respuestas de la API no se cachean (datos personales)', async () => {
    expect((await request(app).get('/api/v1/health')).headers['cache-control']).toBe('no-store');
  });
});
