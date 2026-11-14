import { Router } from 'express';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';
import { Weekday } from '../../schedule/domain/types';
import { activityBody, gapKey, statusBody } from './schemas';

const asKey = (k: z.infer<typeof gapKey>) => ({ ...k, weekday: k.weekday as Weekday });

/** Capa HTTP del módulo de huecos: solo el estudiante dueño (RRF-04). */
export function gapRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked), requireRole('STUDENT'));
  r.get('/', asyncHandler(async (req, res) => { res.json(await c.listGaps.execute({ userId: req.auth!.sub })); }));
  r.put('/activity', asyncHandler(async (req, res) => {
    const b = activityBody.parse(req.body);
    res.json(await c.assignActivity.execute({ userId: req.auth!.sub, gap: asKey(b), title: b.title }));
  }));
  r.delete('/activity', asyncHandler(async (req, res) => {
    await c.removeActivity.execute({ userId: req.auth!.sub, gap: asKey(gapKey.parse(req.body)) });
    res.status(204).end();
  }));
  r.put('/status', asyncHandler(async (req, res) => {
    const b = statusBody.parse(req.body);
    await c.setGapStatus.execute({ userId: req.auth!.sub, gap: asKey(b), status: b.status });
    res.status(204).end();
  }));
  return r;
}
