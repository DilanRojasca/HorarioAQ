import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate } from '../../../shared/http/auth';

const email = z.string().email('Correo inválido');
const loginSchema = z.object({ email, password: z.string().min(1, 'Contraseña requerida') });
const registerSchema = z.object({
  name: z.string().max(200), documentType: z.string().max(20), documentNumber: z.string().max(40), email, password: z.string().max(200),
}).strict();
const code = z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos');
// El correo y el documento NO están en el esquema: `.strict()` rechaza cualquier intento de cambiarlos (RF-AUTH-06).
const avatar = z.string().max(150_000).refine((v) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || /^https:\/\/\S+$/.test(v), 'Foto inválida').nullable();
const profileSchema = z.object({
  name: z.string().max(120).optional(), avatarUrl: avatar.optional(),
  currentPassword: z.string().max(200).optional(), newPassword: z.string().max(200).optional(),
}).strict();

/** Capa HTTP (adaptador de entrada): valida con zod, delega en casos de uso y traduce a JSON. Sin reglas de negocio. */
export function authRoutes(c: Container) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 30 });
  const otpLimiter = rateLimit({ windowMs: 60_000, limit: 10 });
  const auth = authenticate(c.tokens, c.revoked);

  r.post('/login', limiter, asyncHandler(async (req, res) => { res.json(await c.login.execute(loginSchema.parse(req.body))); }));
  r.post('/register', otpLimiter, asyncHandler(async (req, res) => { res.status(201).json(await c.register.execute(registerSchema.parse(req.body))); }));
  r.post('/verify', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.verifyAccount.execute(z.object({ email, code }).strict().parse(req.body)));
  }));
  r.post('/verify/resend', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.resendVerification.execute(z.object({ email }).strict().parse(req.body)));
  }));
  r.post('/password/forgot', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.requestPasswordReset.execute(z.object({ email }).strict().parse(req.body)));
  }));
  r.post('/password/reset', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.resetPassword.execute(z.object({ email, code, newPassword: z.string().max(200) }).strict().parse(req.body)));
  }));
  r.post('/refresh', limiter, asyncHandler(async (req, res) => {
    res.json(await c.refresh.rotate(z.object({ refreshToken: z.string().min(10).max(200) }).strict().parse(req.body).refreshToken));
  }));
  r.post('/logout', auth, asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().max(200).optional() }).parse(req.body ?? {});
    await c.logout.execute({ jti: req.auth!.jti, exp: req.auth!.exp, refreshToken });
    res.status(204).end();
  }));
  r.get('/me', auth, asyncHandler(async (req, res) => { res.json(await c.getProfile.execute({ userId: req.auth!.sub })); }));
  r.put('/me', express.json({ limit: '256kb' }), auth, asyncHandler(async (req, res) => {
    res.json(await c.updateProfile.execute({ userId: req.auth!.sub, ...profileSchema.parse(req.body) }));
  }));
  return r;
}
