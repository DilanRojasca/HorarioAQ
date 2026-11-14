import { Router } from 'express';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireRole } from '../../../shared/http/auth';
import { facultyBody, programBody, programUpdateBody, uuid } from './schemas';


/** Catálogo de programas y facultades: lectura para cualquier sesión, escritura solo ADMIN (RF-ADM-01). */
export function catalogRoutes(c: Container) {
  const r = Router();
  r.use(authenticate(c.tokens, c.revoked));
  r.get('/', asyncHandler(async (_req, res) => { res.json(await c.listCatalog.execute()); }));
  r.post('/faculties', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    res.status(201).json(await c.createFaculty.execute({ ...facultyBody.parse(req.body), actorId: req.auth!.sub }));
  }));
  r.post('/programs', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    const b = programBody.parse(req.body);
    res.status(201).json(await c.createProgram.execute({ ...b, actorId: req.auth!.sub }));
  }));
  r.put('/programs/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    const b = programUpdateBody.parse(req.body);
    res.json(await c.updateProgram.execute({ id: uuid.parse(req.params.id), ...b, actorId: req.auth!.sub }));
  }));
  r.delete('/programs/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
    await c.deleteProgram.execute({ id: uuid.parse(req.params.id), actorId: req.auth!.sub });
    res.status(204).end();
  }));
  return r;
}
