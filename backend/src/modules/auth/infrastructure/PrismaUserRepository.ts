import { prisma } from '../../../shared/prisma';
import { UserRepository } from '../application/ports';

export class PrismaUserRepository implements UserRepository {
  findByEmail(email: string) { return prisma.user.findUnique({ where: { email } }); }
  findById(id: string) { return prisma.user.findUnique({ where: { id } }); }
}
