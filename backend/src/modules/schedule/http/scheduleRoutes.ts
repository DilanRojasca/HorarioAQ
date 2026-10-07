import { Router } from 'express';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';

const uuid = z.string().uuid('Identificador inválido');
const formatSchema = z.object({ format: z.enum(['ics', 'pdf'], { errorMap: () => ({ message: 'Formato inválido (ics|pdf)' }) }) });

export function scheduleRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked));

  r.get('/me', asyncHandler(async (req, res) => {
    res.json(await c.getWeekly.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role }));
  }));

  r.get('/me/export', asyncHandler(async (req, res) => {
    const { format } = formatSchema.parse(req.query);
    const out = await c.exportSchedule.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, format });
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.body);
  }));

  r.get('/users/:userId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    res.json(await c.getWeekly.execute({ requesterId: req.auth!.sub, requesterRole: req.auth!.role, targetUserId: uuid.parse(req.params.userId) }));
  }));

  r.get('/sessions/:externalId', asyncHandler(async (req, res) => {
    const ownerId = req.query.userId === undefined ? undefined : uuid.parse(req.query.userId);
    res.json(await c.getDetail.execute({
      requesterId: req.auth!.sub, requesterRole: req.auth!.role, externalId: req.params.externalId, ownerId,
    }));
  }));
  return r;
}
