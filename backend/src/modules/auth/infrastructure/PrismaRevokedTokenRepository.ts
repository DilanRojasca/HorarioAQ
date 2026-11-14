import { prisma } from '../../../shared/prisma';
import { RevokedTokenRepository } from '../application/ports';

/** @pattern Repository | Implementación con Prisma/PostgreSQL | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. */
export class PrismaRevokedTokenRepository implements RevokedTokenRepository {
  async revoke(jti: string, expiresAt: Date) {
    await prisma.revokedToken.upsert({ where: { jti }, create: { jti, expiresAt }, update: {} });
  }
  async isRevoked(jti: string) {
    return (await prisma.revokedToken.count({ where: { jti } })) > 0;
  }
}
