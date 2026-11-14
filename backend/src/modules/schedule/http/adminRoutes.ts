import { Router } from 'express';
import { z } from 'zod';
import { ClassSession, ScheduleChange } from '../domain/types';
import { notFound } from '../../../shared/errors';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';

const eventsQuery = z.object({
  limit: z.coerce.number({ invalid_type_error: 'limit inválido' }).int('limit inválido').min(1, 'limit mínimo 1').max(100, 'limit máximo 100').default(20),
});

const testEventBody = z.object({
  kind: z.enum(['ADDED', 'UPDATED', 'CANCELLED']).default('ADDED'),
  userId: z.string().uuid('userId inválido').optional(),
});

/** Cambio de horario ficticio para probar la cadena de observadores sin tocar los horarios reales. */
function demoChange(userId: string, semester: string, kind: 'ADDED' | 'UPDATED' | 'CANCELLED'): ScheduleChange {
  const base: ClassSession = {
    externalId: `DEMO-${Date.now()}`, userId, semester, courseCode: 'DEMO-101', courseName: 'Prueba de notificaciones',
    teacher: 'Docente Demo', weekday: 1, startTime: '08:00', endTime: '10:00', block: 'A', floor: 1, room: '101', status: 'ACTIVE',
  };
  if (kind === 'ADDED') return { type: 'ADDED', externalId: base.externalId, userId, after: base };
  if (kind === 'CANCELLED') return { type: 'CANCELLED', externalId: base.externalId, userId, before: base };
  return { type: 'UPDATED', externalId: base.externalId, userId, before: base, after: { ...base, room: '202', block: 'B', floor: 2, startTime: '10:00', endTime: '12:00' } };
}

const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(60).optional(),
});
const roleBody = z.object({ role: z.enum(['STUDENT', 'ADMIN']) }).strict();

export function adminRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked), requireRole('ADMIN'));
  r.post('/sync', asyncHandler(async (req, res) => {
    res.json(await c.sync.execute({ trigger: 'MANUAL', actorId: req.auth!.sub }));
  }));
  r.get('/sync/runs', asyncHandler(async (_req, res) => {
    res.json(await c.syncRuns.list(20));
  }));
  // RF-AUTH-07: gestión de roles
  r.get('/users', asyncHandler(async (_req, res) => { res.json(await c.listUsers.execute()); }));
  r.put('/users/:id/role', asyncHandler(async (req, res) => {
    res.json(await c.changeRole.execute({ actorId: req.auth!.sub, userId: z.string().uuid('Identificador inválido').parse(req.params.id), role: roleBody.parse(req.body).role }));
  }));
  // RF-ADM-02: consulta del log de auditoría (con el responsable resuelto a nombre/correo)
  r.get('/audit', asyncHandler(async (req, res) => {
    const q = auditQuery.parse(req.query);
    const rows = await c.auditReader.listRecent(q.limit, { action: q.action });
    const names = new Map<string, string>();
    for (const id of new Set(rows.map((x) => x.actorId).filter((x): x is string => !!x))) {
      const u = await c.users.findById(id).catch(() => null);
      if (u) names.set(id, `${u.name} <${u.email}>`);
    }
    res.json(rows.map((x) => ({ ...x, actor: x.actorId ? names.get(x.actorId) ?? x.actorId : 'sistema' })));
  }));
  r.get('/students', asyncHandler(async (_req, res) => {
    res.json((await c.users.listStudents()).map((u) => ({ id: u.id, name: u.name, email: u.email })));
  }));
  r.get('/events', asyncHandler(async (req, res) => {
    const { limit } = eventsQuery.parse(req.query);
    res.json(await c.eventLog.listRecent(limit));
  }));
  // Demo del patrón Observer: publica un ScheduleChanged ficticio dirigido al propio admin.
  r.post('/events/test', asyncHandler(async (req, res) => {
    const { kind, userId = req.auth!.sub } = testEventBody.parse(req.body ?? {});
    if (!(await c.users.findById(userId))) throw notFound('Usuario no encontrado');
    const report = await c.bus.publish('ScheduleChanged', {
      userId, semester: c.semester, initialLoad: false, changes: [demoChange(userId, c.semester, kind)],
    });
    res.status(201).json(report);
  }));
  return r;
}
