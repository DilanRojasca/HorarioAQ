import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildContainer } from '../../src/shared/container';
import { createApp } from '../../src/shared/http/app';
import { SseHub } from '../../src/modules/realtime/SseHub';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { registerAuditObserver } from '../../src/modules/audit/auditObserver';
import { registerSyncStatsObserver } from '../../src/modules/schedule/observers/syncStatsObserver';
import {
  FakeHasher, FakeInstitutional, FakeTokens, InMemoryEnrollmentRepo, InMemoryRevoked,
  InMemoryScheduleRepo, InMemorySyncRuns, InMemoryUsers, RecordingAudit, session,
} from '../helpers/inMemory';

const cfg = { port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16, syncCron: '', syncConcurrency: 2 };

let app: ReturnType<typeof createApp>;
let bus: EventBus;
let runs: InMemorySyncRuns;
let inst: FakeInstitutional;

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: 'Secreta123!' })).body.token as string;

beforeEach(() => {
  inst = new FakeInstitutional();
  runs = new InMemorySyncRuns();
  const eventLog = new InMemoryEventLog();
  bus = new EventBus({ log: eventLog, sleep: async () => {} });
  const audit = new RecordingAudit();
  registerAuditObserver(bus, audit);
  registerSyncStatsObserver(bus, runs);
  const mkUser = (id: string, role: 'STUDENT' | 'ADMIN') =>
    ({ id, name: id, email: `${id}@x.co`, passwordHash: 'hash:Secreta123!', role, active: true });
  app = createApp(buildContainer({
    schedules: new InMemoryScheduleRepo(), enrollments: new InMemoryEnrollmentRepo(['u1']), institutional: inst,
    syncRuns: runs, users: new InMemoryUsers([mkUser('u1', 'STUDENT'), mkUser('admin', 'ADMIN')]),
    revoked: new InMemoryRevoked(), hasher: new FakeHasher(), tokens: new FakeTokens(), audit, bus, eventLog, hub: new SseHub(),
    exporters: { ics: new IcsExporter({ semesterStart: cfg.semesterStart, weeks: 16 }), pdf: new PdfExporter({ semester: '2026-2' }) },
  }, cfg), cfg);
  inst.data.set('u1', [session()]);
});

describe('GET /api/admin/events', () => {
  it('devuelve los eventos de una sincronización con sus entregas y guarda las estadísticas', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`).expect(200);
    await bus.idle();
    const res = await request(app).get('/api/admin/events').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const types = res.body.map((e: any) => e.type).sort();
    expect(types).toEqual(['ScheduleChanged', 'SyncCompleted']);
    const completed = res.body.find((e: any) => e.type === 'SyncCompleted');
    expect(new Date(completed.occurredAt).toISOString()).toBe(completed.occurredAt);
    expect(completed.deliveries).toMatchObject([{ observer: 'sync-stats', status: 'OK', attempts: 1 }]);
    expect(runs.runs[0].stats).toEqual({ added: 1, updated: 0, cancelled: 0 });
  });

  it('una entrega fallida aparece como FAILED con sus intentos', async () => {
    runs.saveStats = async () => { throw new Error('bd caída'); };
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`).expect(200);
    await bus.idle();
    const res = await request(app).get('/api/admin/events').set('Authorization', `Bearer ${admin}`);
    const completed = res.body.find((e: any) => e.type === 'SyncCompleted');
    expect(completed.deliveries[0]).toMatchObject({ observer: 'sync-stats', status: 'FAILED', attempts: 3, error: 'bd caída' });
  });

  it('respeta limit', async () => {
    const admin = await login('admin@x.co');
    await request(app).post('/api/admin/sync').set('Authorization', `Bearer ${admin}`).expect(200);
    await bus.idle();
    const res = await request(app).get('/api/admin/events?limit=1').set('Authorization', `Bearer ${admin}`);
    expect(res.body).toHaveLength(1);
  });

  it('403 para estudiante y 401 sin token', async () => {
    const t = await login('u1@x.co');
    expect((await request(app).get('/api/admin/events').set('Authorization', `Bearer ${t}`)).status).toBe(403);
    expect((await request(app).get('/api/admin/events')).status).toBe(401);
  });

  it.each(['0', 'abc', '101', '1.5'])('400 con limit=%s', async (limit) => {
    const admin = await login('admin@x.co');
    expect((await request(app).get(`/api/admin/events?limit=${limit}`).set('Authorization', `Bearer ${admin}`)).status).toBe(400);
  });
});
