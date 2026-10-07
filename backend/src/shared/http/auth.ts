import { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../errors';
import { RevokedTokenRepository, TokenPayload, TokenService } from '../../modules/auth/application/ports';
import { Role } from '../../modules/schedule/domain/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { auth?: TokenPayload } }
}

export const authenticate =
  (tokens: TokenService, revoked: RevokedTokenRepository): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header('authorization') ?? '';
      if (!header.startsWith('Bearer ')) throw unauthorized();
      const payload = tokens.verify(header.slice(7));
      if (await revoked.isRevoked(payload.jti)) throw unauthorized('Sesión cerrada');
      req.auth = payload;
      next();
    } catch (e) { next(e); }
  };

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(forbidden('No tienes permisos para esta acción'));
    next();
  };
