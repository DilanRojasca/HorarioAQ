import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { unauthorized } from '../../../shared/errors';
import { Role } from '../../schedule/domain/types';
import { TokenPayload, TokenService } from '../application/ports';

export class JwtTokenService implements TokenService {
  constructor(private secret: string) {}

  sign(user: { id: string; role: Role }): string {
    return jwt.sign({ role: user.role }, this.secret, { subject: user.id, expiresIn: '60m', jwtid: randomUUID() });
  }

  verify(token: string): TokenPayload {
    try {
      const p = jwt.verify(token, this.secret) as jwt.JwtPayload;
      return { sub: p.sub as string, role: p.role as Role, jti: p.jti as string, exp: p.exp as number };
    } catch {
      throw unauthorized('Token inválido o expirado');
    }
  }
}
