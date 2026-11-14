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
  // Recurso «actividades» de los huecos: CRUD completo (GET lista · POST crea · PUT actualiza · DELETE elimina)
  r.get('/activities', asyncHandler(async (req, res) => { res.json(await c.listActivities.execute({ userId: req.auth!.sub })); }));
  r.post('/activities', asyncHandler(async (req, res) => {
    const b = activityBody.parse(req.body);
    res.status(201).json(await c.createActivity.execute({ userId: req.auth!.sub, gap: asKey(b), title: b.title }));
  }));
  r.put('/activities', asyncHandler(async (req, res) => {
    const b = activityBody.parse(req.body);
    res.json(await c.updateActivity.execute({ userId: req.auth!.sub, gap: asKey(b), title: b.title }));
  }));
  r.delete('/activities', asyncHandler(async (req, res) => {
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
