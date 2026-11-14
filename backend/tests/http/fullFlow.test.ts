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
  InMemoryScheduleRepo, InMemorySyncRuns, InMemoryUsers, RecordingAudit, RecordingOtpMailer, extraPorts, session,
} from '../helpers/inMemory';

const cfg = { port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16, syncCron: '', syncConcurrency: 2 };
const U1 = '11111111-1111-4111-8111-111111111111';
const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let app: ReturnType<typeof createApp>;
let mailer: RecordingOtpMailer;
let audit: RecordingAudit;
let users: InMemoryUsers;

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const login = async (email: string, password = 'Secreta123!') => (await request(app).post('/api/v1/auth/login').send({ email, password })).body;

beforeEach(() => {
  audit = new RecordingAudit();
  const extra = extraPorts(audit);
  mailer = extra.otpMailer as RecordingOtpMailer;
  const schedules = new InMemoryScheduleRepo();
  schedules.rows = [
    session({ userId: U1, externalId: 'a', courseName: 'Álgebra', courseCode: 'ALG', startTime: '08:00', endTime: '10:00', weekday: 1, block: 'A', teacher: 'Marta' }),
    session({ userId: U1, externalId: 'b', courseName: 'Física', courseCode: 'FIS', startTime: '11:00', endTime: '13:00', weekday: 1, block: 'B', teacher: 'Luis' }),
  ];
  const mk = (id: string, role: 'STUDENT' | 'ADMIN', email: string) => ({ id, name: `U ${id}`, email, passwordHash: 'hash:Secreta123!', role, active: true, verifiedAt: new Date() });
  users = new InMemoryUsers([mk(U1, 'STUDENT', 'u1@x.co'), mk(ADMIN, 'ADMIN', 'admin@x.co')]);
  const c = buildContainer({
    schedules, enrollments: new InMemoryEnrollmentRepo([U1]), institutional: new FakeInstitutional(), syncRuns: new InMemorySyncRuns(), users,
    revoked: new InMemoryRevoked(), hasher: new FakeHasher(), tokens: new FakeTokens(), audit, bus: new EventBus({ sleep: async () => {} }),
    eventLog: new InMemoryEventLog(), notifications: new InMemoryNotifications(), hub: new SseHub(), ...extra,
    exporters: { ics: new IcsExporter({ semesterStart: cfg.semesterStart, weeks: 16 }), pdf: new PdfExporter({ semester: '2026-2' }) },
  }, cfg);
  app = createApp(c, cfg);
});

describe('Cuenta: registro → verificación → sesión → perfil', () => {
  it('flujo completo con refresh y logout', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Nueva Persona', documentType: 'CC', documentNumber: '12345678', email: 'nueva@amigo.edu.co', password: 'Segura1234' });
    expect(reg.status).toBe(201);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'nueva@amigo.edu.co', password: 'Segura1234' })).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/verify').send({ email: 'nueva@amigo.edu.co', code: '000000' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/verify').send({ email: 'nueva@amigo.edu.co', code: mailer.sent[0].code })).status).toBe(200);
    const s = await login('nueva@amigo.edu.co', 'Segura1234');
    expect(s.refreshToken).toBeTruthy();
    const me = await request(app).get('/api/v1/auth/me').set(bearer(s.token));
    expect(me.body).toMatchObject({ email: 'nueva@amigo.edu.co', documentNumber: '12345678', notifyChannel: 'BOTH' });
    const rot = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(rot.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401); // ya consumido
    expect((await request(app).post('/api/v1/auth/logout').set(bearer(rot.body.token)).send({ refreshToken: rot.body.refreshToken })).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: rot.body.refreshToken })).status).toBe(401);
    expect(audit.entries.map((e) => e.action)).toEqual(expect.arrayContaining(['REGISTER', 'VERIFY_ACCOUNT', 'LOGIN', 'LOGIN_FAILED']));
  });
  it('registro rechaza correo externo (400) y duplicado (409)', async () => {
    const body = { name: 'Nueva Persona', documentType: 'CC', documentNumber: '12345678', email: 'x@gmail.com', password: 'Segura1234' };
    expect((await request(app).post('/api/v1/auth/register').send(body)).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register').send({ ...body, email: 'u1@x.co' })).status).toBe(400);
  });
  it('recuperar contraseña con OTP', async () => {
    await request(app).post('/api/v1/auth/password/forgot').send({ email: 'u1@x.co' });
    const code = mailer.sent.at(-1)!.code;
    expect((await request(app).post('/api/v1/auth/password/reset').send({ email: 'u1@x.co', code, newPassword: 'Cambiada123' })).status).toBe(200);
    expect((await login('u1@x.co', 'Cambiada123')).token).toBeTruthy();
  });
  it('perfil: edita nombre/foto; rechaza intentar cambiar el correo; foto inválida 400', async () => {
    const t = (await login('u1@x.co')).token;
    const ok = await request(app).put('/api/v1/auth/me').set(bearer(t)).send({ name: 'Nombre Nuevo', avatarUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Nombre Nuevo');
    expect((await request(app).put('/api/v1/auth/me').set(bearer(t)).send({ email: 'otro@amigo.edu.co' })).status).toBe(400);
    expect((await request(app).put('/api/v1/auth/me').set(bearer(t)).send({ avatarUrl: 'javascript:alert(1)' })).status).toBe(400);
  });
});

describe('Horario: búsqueda y filtros (RF-BUS-01/02)', () => {
  it('filtra por texto, día, bloque y docente', async () => {
    const t = (await login('u1@x.co')).token;
    const get = async (qs: string) => (await request(app).get(`/api/v1/schedule/me${qs}`).set(bearer(t))).body.sessions.map((s: { externalId: string }) => s.externalId);
    expect(await get('')).toEqual(['a', 'b']);
    expect(await get('?q=algebra')).toEqual(['a']);
    expect(await get('?block=B')).toEqual(['b']);
    expect(await get('?teacher=luis&weekday=1')).toEqual(['b']);
    expect((await request(app).get('/api/v1/schedule/me?weekday=9').set(bearer(t))).status).toBe(400);
  });
});

describe('Huecos (RF-HUE-01..04)', () => {
  it('CRUD de actividades con códigos HTTP correctos y regla de negocio (409); el admin no tiene acceso', async () => {
    const t = (await login('u1@x.co')).token;
    const key = { weekday: 1, startTime: '10:00', endTime: '11:00' };
    const [gap] = (await request(app).get('/api/v1/gaps').set(bearer(t))).body;
    expect(gap).toMatchObject({ ...key, minutes: 60, suggestion: { kind: 'MEAL' } });

    const created = await request(app).post('/api/v1/gaps/activities').set(bearer(t)).send({ ...key, title: 'Biblioteca' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...key, title: 'Biblioteca' });
    expect((await request(app).post('/api/v1/gaps/activities').set(bearer(t)).send({ ...key, title: 'Otra' })).status).toBe(409);  // ya existe
    expect((await request(app).post('/api/v1/gaps/activities').set(bearer(t)).send({ ...key, startTime: '10:05', title: 'x' })).status).toBe(404); // hueco inexistente
    expect((await request(app).post('/api/v1/gaps/activities').set(bearer(t)).send({ ...key, title: '' })).status).toBe(400);       // validación
    expect((await request(app).get('/api/v1/gaps/activities').set(bearer(t))).body).toHaveLength(1);
    expect((await request(app).put('/api/v1/gaps/activities').set(bearer(t)).send({ ...key, title: 'Gimnasio' })).body.title).toBe('Gimnasio');
    expect((await request(app).get('/api/v1/gaps').set(bearer(t))).body[0]).toMatchObject({ activity: { title: 'Gimnasio' }, suggestion: null });

    expect((await request(app).delete('/api/v1/gaps/activities').set(bearer(t)).send(key)).status).toBe(204);
    expect((await request(app).delete('/api/v1/gaps/activities').set(bearer(t)).send(key)).status).toBe(404);
    expect((await request(app).put('/api/v1/gaps/status').set(bearer(t)).send({ ...key, status: 'OCCUPIED' })).status).toBe(204);
    expect((await request(app).post('/api/v1/gaps/activities').set(bearer(t)).send({ ...key, title: 'Nueva' })).status).toBe(409);  // hueco ocupado
    expect((await request(app).put('/api/v1/gaps/status').set(bearer(t)).send({ ...key, startTime: '10:05', status: 'OCCUPIED' })).status).toBe(404);

    expect((await request(app).get('/api/v1/gaps')).status).toBe(401);                       // sin token
    const a = (await login('admin@x.co')).token;
    expect((await request(app).get('/api/v1/gaps').set(bearer(a))).status).toBe(403);       // rol sin permiso
  });
});

describe('Notificaciones programadas y preferencias (RF-NOT-01/04)', () => {
  it('crea, lista y cancela; guarda preferencias', async () => {
    const t = (await login('u1@x.co')).token;
    const fireAt = new Date(Date.now() + 3_600_000).toISOString();
    const created = await request(app).post('/api/v1/notifications/scheduled').set(bearer(t)).send({ title: 'Parcial', message: 'Repasar', fireAt });
    expect(created.status).toBe(201);
    expect((await request(app).post('/api/v1/notifications/scheduled').set(bearer(t)).send({ title: 'x', message: 'y', fireAt: '2020-01-01T00:00:00Z' })).status).toBe(400);
    expect((await request(app).get('/api/v1/notifications/scheduled').set(bearer(t))).body).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/notifications/scheduled/${created.body[0].id}`).set(bearer(t))).status).toBe(204);
    const prefs = await request(app).put('/api/v1/notifications/preferences').set(bearer(t)).send({ notifyChannel: 'IN_APP', reminderMinutes: 30 });
    expect(prefs.body).toMatchObject({ notifyChannel: 'IN_APP', reminderMinutes: 30 });
    expect((await request(app).put('/api/v1/notifications/preferences').set(bearer(t)).send({ notifyChannel: 'SMS' })).status).toBe(400);
  });
});

describe('Administración: roles, catálogo y auditoría (RF-AUTH-07, RF-ADM-01/02)', () => {
  it('solo ADMIN; cambia roles, gestiona catálogo y consulta el log', async () => {
    const a = (await login('admin@x.co')).token; const s = (await login('u1@x.co')).token;
    expect((await request(app).get('/api/v1/admin/users').set(bearer(s))).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/users').set(bearer(a))).body).toHaveLength(2);
    expect((await request(app).put(`/api/v1/admin/users/${ADMIN}/role`).set(bearer(a)).send({ role: 'STUDENT' })).status).toBe(403); // propio rol
    expect((await request(app).put(`/api/v1/admin/users/${U1}/role`).set(bearer(a)).send({ role: 'ADMIN' })).body.role).toBe('ADMIN');

    const fac = await request(app).post('/api/v1/catalog/faculties').set(bearer(a)).send({ name: 'Ingeniería' });
    expect(fac.status).toBe(201);
    expect((await request(app).post('/api/v1/catalog/programs').set(bearer(a)).send({ code: 'ISI', name: 'Sistemas', facultyId: '99999999-9999-4999-8999-999999999999' })).status).toBe(400);
    const prog = await request(app).post('/api/v1/catalog/programs').set(bearer(a)).send({ code: 'ISI', name: 'Sistemas', facultyId: fac.body.id });
    expect(prog.status).toBe(201);
    expect((await request(app).post('/api/v1/catalog/faculties').set(bearer(s)).send({ name: 'X' })).status).toBe(403);
    expect((await request(app).get('/api/v1/catalog').set(bearer(s))).body[0].programs).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/catalog/programs/${prog.body.id}`).set(bearer(a))).status).toBe(204);

    const log = await request(app).get('/api/v1/admin/audit?limit=100').set(bearer(a));
    const actions = log.body.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN', 'CHANGE_ROLE', 'CATALOG_CREATE_FACULTY', 'CATALOG_CREATE_PROGRAM', 'CATALOG_DELETE_PROGRAM']));
    expect(log.body.find((e: { action: string }) => e.action === 'CHANGE_ROLE').actor).toContain('admin@x.co');
    expect((await request(app).get('/api/v1/admin/audit?action=CHANGE_ROLE').set(bearer(a))).body).toHaveLength(1);
  });
});
