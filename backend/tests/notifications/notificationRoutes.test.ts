import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildContainer } from '../../src/shared/container';
import { createApp } from '../../src/shared/http/app';
import { SseHub } from '../../src/modules/realtime/SseHub';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import {
  FakeHasher, FakeInstitutional, FakeTokens, InMemoryEnrollmentRepo, InMemoryNotifications, InMemoryRevoked,
  InMemoryScheduleRepo, InMemorySyncRuns, InMemoryUsers, RecordingAudit,
} from '../helpers/inMemory';

const cfg = {
  port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16,
  syncCron: '', syncConcurrency: 2, notifyWindowStart: 6, notifyWindowEnd: 22, notifyTimezone: 'America/Bogota',
};
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

let app: ReturnType<typeof createApp>;
let notes: InMemoryNotifications;
const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: 'Secreta123!' })).body.token as string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
  notes = new InMemoryNotifications();
  const eventLog = new InMemoryEventLog();
  const mkUser = (id: string, email: string) =>
    ({ id, name: email, email, passwordHash: 'hash:Secreta123!', role: 'STUDENT' as const, active: true });
  app = createApp(buildContainer({
    schedules: new InMemoryScheduleRepo(), enrollments: new InMemoryEnrollmentRepo([]), institutional: new FakeInstitutional(),
    syncRuns: new InMemorySyncRuns(), users: new InMemoryUsers([mkUser(U1, 'a@x.co'), mkUser(U2, 'b@x.co')]),
    revoked: new InMemoryRevoked(), hasher: new FakeHasher(), tokens: new FakeTokens(), audit: new RecordingAudit(),
    bus: new EventBus({ log: eventLog, sleep: async () => {} }), eventLog, notifications: notes, hub: new SseHub(),
    exporters: { ics: new IcsExporter({ semesterStart: cfg.semesterStart, weeks: 16 }), pdf: new PdfExporter({ semester: '2026-2' }) },
  }, cfg), cfg);
});

const seed = async (userId: string, title: string) =>
  notes.create({ userId, kind: 'SCHEDULE_ADDED', title, message: 'm' });

describe('/api/notifications', () => {
  it('401 sin token', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).post('/api/notifications/read-all')).status).toBe(401);
  });

  it('lista solo las propias, más recientes primero, con el conteo de no leídas', async () => {
    await seed(U1, 'uno'); await seed(U2, 'ajena'); await seed(U1, 'dos');
    const res = await request(app).get('/api/notifications').set(auth(await login('a@x.co')));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: any) => i.title)).toEqual(['dos', 'uno']);
    expect(res.body.unread).toBe(2);
  });

  it('unread=1 filtra las leídas', async () => {
    const a = await seed(U1, 'uno'); await seed(U1, 'dos');
    await notes.markRead(U1, a.id);
    const res = await request(app).get('/api/notifications?unread=1').set(auth(await login('a@x.co')));
    expect(res.body.items.map((i: any) => i.title)).toEqual(['dos']);
    expect(res.body.unread).toBe(1);
  });

  it('respeta limit y rechaza valores inválidos con 400', async () => {
    for (const t of ['a', 'b', 'c']) await seed(U1, t);
    const tok = await login('a@x.co');
    expect((await request(app).get('/api/notifications?limit=2').set(auth(tok))).body.items).toHaveLength(2);
    for (const bad of ['0', '101', 'x', '-1', '1.5']) {
      expect((await request(app).get(`/api/notifications?limit=${bad}`).set(auth(tok))).status).toBe(400);
    }
  });

  it('POST :id/read marca como leída (204)', async () => {
    const n = await seed(U1, 'uno');
    const res = await request(app).post(`/api/notifications/${n.id}/read`).set(auth(await login('a@x.co')));
    expect(res.status).toBe(204);
    expect(notes.rows[0].readAt).not.toBeNull();
  });

  it('read de otra persona o inexistente da 404 y no la modifica', async () => {
    const n = await notes.create({ userId: U2, kind: 'SCHEDULE_ADDED', title: 'ajena', message: 'm' });
    const tok = await login('a@x.co');
    expect((await request(app).post(`/api/notifications/${n.id}/read`).set(auth(tok))).status).toBe(404);
    expect(notes.rows[0].readAt).toBeNull();
  });

  it('id que no es UUID da 400', async () => {
    const res = await request(app).post('/api/notifications/no-es-uuid/read').set(auth(await login('a@x.co')));
    expect(res.status).toBe(400);
  });

  it('read-all solo toca las propias', async () => {
    await seed(U1, 'uno'); await seed(U1, 'dos'); await seed(U2, 'ajena');
    const res = await request(app).post('/api/notifications/read-all').set(auth(await login('a@x.co')));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 2 });
    expect(notes.rows.find((r) => r.userId === U2)!.readAt).toBeNull();
  });

  it('no existe ninguna ruta para crear notificaciones', async () => {
    const res = await request(app).post('/api/notifications').set(auth(await login('a@x.co'))).send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});
