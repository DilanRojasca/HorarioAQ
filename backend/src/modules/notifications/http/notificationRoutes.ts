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
