import { prisma } from '../../../shared/prisma';
import { OtpPurpose, OtpRecord, OtpRepository } from '../application/ports';

export class PrismaOtpRepository implements OtpRepository {
  async create(o: { userId: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }) {
    await prisma.$transaction([
      prisma.otp.updateMany({ where: { userId: o.userId, purpose: o.purpose, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.otp.create({ data: o }),
    ]);
  }
  async findActive(userId: string, purpose: OtpPurpose, now: Date) {
    const r = await prisma.otp.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' },
    });
    return r ? ({ ...r, purpose: r.purpose as OtpPurpose } satisfies OtpRecord) : null;
  }
  async recordFailedAttempt(id: string) { await prisma.otp.update({ where: { id }, data: { attempts: { increment: 1 } } }); }
  async markUsed(id: string, at: Date) {
    return (await prisma.otp.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } })).count === 1;
  }
}
