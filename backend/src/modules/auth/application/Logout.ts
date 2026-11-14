import { UseCase } from '../../../shared/ports';
import { RefreshTokenService } from './RefreshTokenService';
import { RevokedTokenRepository } from './ports';

/** RF-AUTH-03: invalida el access token (lista de revocados por jti) y, si viene, el refresh token. */
export class LogoutUseCase implements UseCase<{ jti: string; exp: number; refreshToken?: string }, void> {
  constructor(private revoked: RevokedTokenRepository, private refresh?: RefreshTokenService) {}
  async execute({ jti, exp, refreshToken }: { jti: string; exp: number; refreshToken?: string }): Promise<void> {
    await this.revoked.revoke(jti, new Date(exp * 1000));
    if (refreshToken) await this.refresh?.revoke(refreshToken);
  }
}
