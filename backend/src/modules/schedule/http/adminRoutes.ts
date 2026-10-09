import { Router } from 'express';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';

const eventsQuery = z.object({
  limit: z.coerce.number({ invalid_type_error: 'limit inválido' }).int('limit inválido').min(1, 'limit mínimo 1').max(100, 'limit máximo 100').default(20),
});

export function adminRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked), requireRole('ADMIN'));
  r.post('/sync', asyncHandler(async (req, res) => {
    res.json(await c.sync.execute({ trigger: 'MANUAL', actorId: req.auth!.sub }));
  }));
  r.get('/sync/runs', asyncHandler(async (_req, res) => {
    res.json(await c.syncRuns.list(20));
  }));
  r.get('/events', asyncHandler(async (req, res) => {
    const { limit } = eventsQuery.parse(req.query);
    res.json(await c.eventLog.listRecent(limit));
  }));
  return r;
}
