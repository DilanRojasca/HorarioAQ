import { prisma } from '../../../shared/prisma';
import { RevokedTokenRepository } from '../application/ports';

export class PrismaRevokedTokenRepository implements RevokedTokenRepository {
  async revoke(jti: string, expiresAt: Date) {
    await prisma.revokedToken.upsert({ where: { jti }, create: { jti, expiresAt }, update: {} });
  }
  async isRevoked(jti: string) {
    return (await prisma.revokedToken.count({ where: { jti } })) > 0;
  }
}
