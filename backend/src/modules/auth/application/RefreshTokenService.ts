import { createHash, randomBytes } from 'node:crypto';
import { unauthorized } from '../../../shared/errors';
import { RefreshTokenRepository, TokenService, UserRepository } from './ports';

export const REFRESH_TTL_MS = 7 * 24 * 3_600_000;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export interface SessionTokens { token: string; refreshToken: string }

/**
 * RNF-05: refresh token ROTATIVO. Cada refresh consume el token anterior (uso único) y emite uno
 * nuevo; si alguien reutiliza uno ya consumido, falla. Se guarda solo el hash (sha256).
 */
export class RefreshTokenService {
  constructor(
    private repo: RefreshTokenRepository,
    private users: UserRepository,
    private tokens: TokenService,
    private now: () => Date = () => new Date(),
  ) {}

  async issue(user: { id: string; role: 'STUDENT' | 'ADMIN' }): Promise<SessionTokens> {
    const refreshToken = randomBytes(32).toString('hex');
    await this.repo.create({
      userId: user.id, tokenHash: sha256(refreshToken), expiresAt: new Date(this.now().getTime() + REFRESH_TTL_MS),
    });
    return { token: this.tokens.sign(user), refreshToken };
  }

  async rotate(refreshToken: string): Promise<SessionTokens> {
    const found = await this.repo.consume(sha256(refreshToken), this.now());
    if (!found) throw unauthorized('Sesión expirada, inicia sesión de nuevo');
    const user = await this.users.findById(found.userId);
    if (!user || !user.active) throw unauthorized('Sesión expirada, inicia sesión de nuevo');
    return this.issue(user);
  }

  revoke(refreshToken: string) { return this.repo.revokeByHash(sha256(refreshToken)); }
  revokeAll(userId: string) { return this.repo.revokeAllForUser(userId); }
}
