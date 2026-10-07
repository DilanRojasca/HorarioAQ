import { UseCase } from '../../../shared/ports';
import { RevokedTokenRepository } from './ports';

export class LogoutUseCase implements UseCase<{ jti: string; exp: number }, void> {
  constructor(private revoked: RevokedTokenRepository) {}
  async execute({ jti, exp }: { jti: string; exp: number }): Promise<void> {
    await this.revoked.revoke(jti, new Date(exp * 1000));
  }
}
