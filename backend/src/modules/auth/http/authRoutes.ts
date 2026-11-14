import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Container } from '../../../shared/container';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate } from '../../../shared/http/auth';
import { emailOnlyBody, loginBody, logoutBody, profileBody, refreshBody, registerBody, resetBody, verifyBody } from './schemas';


/** Capa HTTP (adaptador de entrada): valida con zod, delega en casos de uso y traduce a JSON. Sin reglas de negocio. */
export function authRoutes(c: Container) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 30 });
  const otpLimiter = rateLimit({ windowMs: 60_000, limit: 10 });
  const auth = authenticate(c.tokens, c.revoked);

  r.post('/login', limiter, asyncHandler(async (req, res) => { res.json(await c.login.execute(loginBody.parse(req.body))); }));
  r.post('/register', otpLimiter, asyncHandler(async (req, res) => { res.status(201).json(await c.register.execute(registerBody.parse(req.body))); }));
  r.post('/verify', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.verifyAccount.execute(verifyBody.parse(req.body)));
  }));
  r.post('/verify/resend', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.resendVerification.execute(emailOnlyBody.parse(req.body)));
  }));
  r.post('/password/forgot', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.requestPasswordReset.execute(emailOnlyBody.parse(req.body)));
  }));
  r.post('/password/reset', otpLimiter, asyncHandler(async (req, res) => {
    res.json(await c.resetPassword.execute(resetBody.parse(req.body)));
  }));
  r.post('/refresh', limiter, asyncHandler(async (req, res) => {
    res.json(await c.refresh.rotate(refreshBody.parse(req.body).refreshToken));
  }));
  r.post('/logout', auth, asyncHandler(async (req, res) => {
    const { refreshToken } = logoutBody.parse(req.body ?? {});
    await c.logout.execute({ jti: req.auth!.jti, exp: req.auth!.exp, refreshToken });
    res.status(204).end();
  }));
  r.get('/me', auth, asyncHandler(async (req, res) => { res.json(await c.getProfile.execute({ userId: req.auth!.sub })); }));
  r.put('/me', express.json({ limit: '256kb' }), auth, asyncHandler(async (req, res) => {
    res.json(await c.updateProfile.execute({ userId: req.auth!.sub, ...profileBody.parse(req.body) }));
  }));
  return r;
}
