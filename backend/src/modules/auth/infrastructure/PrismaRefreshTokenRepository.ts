import { prisma } from '../../../shared/prisma';
import { RefreshTokenRepository } from '../application/ports';

/** @pattern Repository | Implementación con Prisma/PostgreSQL | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory. */
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(r: { userId: string; tokenHash: string; expiresAt: Date }) { await prisma.refreshToken.create({ data: r }); }
  /** @pattern Consumidor idempotente | Uso único del refresh token | Solo la primera petición consume el token (rotación). */
  async consume(tokenHash: string, now: Date) {
    const t = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!t || t.revokedAt || t.expiresAt <= now) return null;
    // Atómico: solo gana quien logra pasar de revokedAt=null a now (evita doble uso concurrente).
    const r = await prisma.refreshToken.updateMany({ where: { id: t.id, revokedAt: null }, data: { revokedAt: now } });
    return r.count === 1 ? { userId: t.userId } : null;
  }
  async revokeByHash(tokenHash: string) {
    await prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  async revokeAllForUser(userId: string) {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
