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

  it('admin que lee el detalle de una clase ajena queda auditado; el estudiante con la propia, no (RNF-14)', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    const t1 = await login('u1@x.co');
    expect((await request(app).get('/api/schedule/sessions/u1-ALG-1').set('Authorization', `Bearer ${t1}`)).status).toBe(200);
    expect(audit.entries.some((e) => e.action === 'VIEW_THIRD_PARTY_SESSION')).toBe(false);
    // Los ids de usuario de las rutas son UUID; u1 no lo es, así que se consulta la clase de U2.
    const r = await request(app).get(`/api/schedule/sessions/${U2}-ALG-1?userId=${U2}`).set('Authorization', `Bearer ${admin}`);
    expect(r.status).toBe(200);
    expect(audit.entries).toContainEqual(expect.objectContaining({
      action: 'VIEW_THIRD_PARTY_SESSION', actorId: 'admin', detail: { ownerId: U2, externalId: `${U2}-ALG-1` },
    }));
  });

  it('JSON malformado → 400 BAD_REQUEST (no 500)', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'BAD_REQUEST', message: 'Cuerpo de la solicitud inválido' });
  });

  it('cuerpo demasiado grande → 413', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }));
    expect(r.status).toBe(413);
  });

  it('dos sincronizaciones simultáneas: una 200 y otra 409', async () => {
    const admin = await login('admin@x.co');
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const orig = inst.fetchSchedule.bind(inst);
    inst.fetchSchedule = async (id: string) => { await gate; return orig(id); };
    const a = request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`).then((r) => r);
    await new Promise((x) => setTimeout(x, 50));
    const b = await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`);
    expect(b.status).toBe(409);
    expect(b.body.code).toBe('SYNC_IN_PROGRESS');
    release();
    expect((await a).status).toBe(200);
    expect(audit.entries.some((e) => e.action === 'SYNC_FAILED')).toBe(true);
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
