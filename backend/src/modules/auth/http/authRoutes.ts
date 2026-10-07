import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate } from '../../../shared/http/auth';

const loginSchema = z.object({ email: z.string().email('Correo inválido'), password: z.string().min(1, 'Contraseña requerida') });

export function authRoutes(c: Container) {
  const r = Router();
  r.post('/login', rateLimit({ windowMs: 60_000, limit: 30 }), asyncHandler(async (req, res) => {
    res.json(await c.login.execute(loginSchema.parse(req.body)));
  }));
  r.post('/logout', authenticate(c.tokens, c.revoked), asyncHandler(async (req, res) => {
    await c.logout.execute({ jti: req.auth!.jti, exp: req.auth!.exp });
    res.status(204).end();
  }));
  return r;
}
