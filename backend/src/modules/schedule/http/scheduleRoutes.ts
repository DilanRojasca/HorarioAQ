import { Router } from 'express';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';
import { exportQuery, scheduleQuery, sessionDetailQuery, uuid } from './schemas';

export function scheduleRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked));

  r.get('/me', asyncHandler(async (req, res) => {
    res.json(await c.getWeekly.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, filter: scheduleQuery.parse(req.query) }));
  }));

  r.get('/me/export', asyncHandler(async (req, res) => {
    const { format } = exportQuery.parse(req.query);
    const out = await c.exportSchedule.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, format });
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.body);
  }));

  r.get('/users/:userId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    res.json(await c.getWeekly.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, targetUserId: uuid.parse(req.params.userId) }));
  }));

  r.get('/sessions/:externalId', asyncHandler(async (req, res) => {
    const { userId: ownerId } = sessionDetailQuery.parse(req.query);
    res.json(await c.getDetail.execute({
      requesterId: req.auth!.sub, requesterRole: req.auth!.role, externalId: req.params.externalId, ownerId,
    }));
  }));
  return r;
}
