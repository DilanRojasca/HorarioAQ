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
