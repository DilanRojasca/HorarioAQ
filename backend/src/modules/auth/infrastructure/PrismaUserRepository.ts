import { prisma } from '../../../shared/prisma';
import { NotifyChannel, NewUser, User, UserRepository } from '../application/ports';
import { Role } from '../../schedule/domain/types';

type Row = Omit<User, 'notifyChannel'> & { notifyChannel: string };
const toUser = (r: Row): User => ({ ...r, notifyChannel: r.notifyChannel as NotifyChannel });
const maybe = (r: Row | null) => (r ? toUser(r) : null);

/**
 * PATRÓN Repository (adaptador de salida): implementa `UserRepository` con Prisma/PostgreSQL.
 *
 * @pattern Repository | Implementación con Prisma/PostgreSQL | Adaptador de salida del puerto; en las pruebas lo reemplaza una versión InMemory.
 */
export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string) { return maybe(await prisma.user.findUnique({ where: { email } })); }
  async findById(id: string) { return maybe(await prisma.user.findUnique({ where: { id } })); }
  async listStudents() {
    return (await prisma.user.findMany({ where: { role: 'STUDENT', active: true }, orderBy: { name: 'asc' } })).map(toUser);
  }
  async listAll() { return (await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] })).map(toUser); }
  async create(u: NewUser) { return toUser(await prisma.user.create({ data: { ...u, role: 'STUDENT', active: false } })); }
  async activate(id: string, at: Date) { await prisma.user.update({ where: { id }, data: { active: true, verifiedAt: at } }); }
  async updateProfile(id: string, data: { name?: string; avatarUrl?: string | null }) {
    return toUser(await prisma.user.update({ where: { id }, data }));
  }
  async updatePassword(id: string, passwordHash: string) { await prisma.user.update({ where: { id }, data: { passwordHash } }); }
  async setRole(id: string, role: Role) { return toUser(await prisma.user.update({ where: { id }, data: { role } })); }
  async updatePreferences(id: string, data: { notifyChannel?: NotifyChannel; reminderMinutes?: number }) {
    return toUser(await prisma.user.update({ where: { id }, data }));
  }
}
