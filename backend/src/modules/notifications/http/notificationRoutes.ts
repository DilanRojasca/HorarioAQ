import { Router } from 'express';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { notFound } from '../../../shared/errors';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate } from '../../../shared/http/auth';

const uuid = z.string().uuid('Identificador inválido');
const listQuery = z.object({
  unread: z.enum(['1', '0', 'true', 'false']).optional(),
  limit: z.coerce.number({ invalid_type_error: 'limit inválido' }).int('limit debe ser entero')
    .min(1, 'limit mínimo 1').max(100, 'limit máximo 100').default(30),
});

const scheduleBody = z.object({
  title: z.string(), message: z.string(),
  fireAt: z.coerce.date({ errorMap: () => ({ message: 'Fecha y hora inválidas' }) }),
  sessionExternalId: z.string().max(120).optional(),
}).strict();
const prefsBody = z.object({
  notifyChannel: z.enum(['IN_APP', 'EMAIL', 'BOTH']).optional(),
  reminderMinutes: z.number().int().optional(),
}).strict();

export function notificationRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked));

  r.get('/', asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const userId = req.auth!.sub;
    const [items, unread] = await Promise.all([
      c.notifications.listByUser(userId, { unreadOnly: q.unread === '1' || q.unread === 'true', limit: q.limit }),
      c.notifications.countUnread(userId),
    ]);
    res.json({ items, unread });
  }));

  // RF-NOT-01: notificaciones propias programadas
  r.get('/scheduled', asyncHandler(async (req, res) => { res.json(await c.listScheduled.execute({ userId: req.auth!.sub })); }));
  r.post('/scheduled', asyncHandler(async (req, res) => {
    const b = scheduleBody.parse(req.body);
    res.status(201).json(await c.createCustomNotification.execute({ userId: req.auth!.sub, ...b }));
  }));
  r.delete('/scheduled/:id', asyncHandler(async (req, res) => {
    await c.cancelScheduled.execute({ userId: req.auth!.sub, id: uuid.parse(req.params.id) });
    res.status(204).end();
  }));
  // RF-NOT-04 / RF-NOT-02: canal preferido y antelación del recordatorio
  r.put('/preferences', asyncHandler(async (req, res) => {
    res.json(await c.updatePreferences.execute({ userId: req.auth!.sub, ...prefsBody.parse(req.body) }));
  }));

  // Antes de '/:id/read' para que 'read-all' nunca se interprete como id.
  r.post('/read-all', asyncHandler(async (req, res) => {
    res.json({ updated: await c.notifications.markAllRead(req.auth!.sub) });
  }));

  r.post('/:id/read', asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    if (!(await c.notifications.markRead(req.auth!.sub, id))) throw notFound('Notificación no encontrada');
    res.status(204).end();
  }));
  return r;
}
