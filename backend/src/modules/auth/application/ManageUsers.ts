import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { Role } from '../../schedule/domain/types';
import { UserRepository } from './ports';

export interface UserSummary { id: string; name: string; email: string; role: Role; active: boolean }

/** RF-AUTH-07 (lectura): el administrador ve a todos los usuarios. */
export class ListUsersUseCase implements UseCase<void, UserSummary[]> {
  constructor(private users: UserRepository) {}
  async execute() {
    return (await this.users.listAll()).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }));
  }
}

export interface ChangeRoleInput { actorId: string; userId: string; role: Role }

/**
 * RF-AUTH-07: asignar/modificar el rol (los permisos del rol los aplica RBAC en `requireRole`).
 * Un administrador no puede cambiarse su propio rol (evita quedarse sin administradores).
 * Se decora con `withAudit` en el contenedor ⇒ queda en el log con el ID del admin (no repudio).
 */
export class ChangeUserRoleUseCase implements UseCase<ChangeRoleInput, UserSummary> {
  constructor(private users: UserRepository) {}
  async execute({ actorId, userId, role }: ChangeRoleInput) {
    if (role !== 'ADMIN' && role !== 'STUDENT') throw badRequest('Rol inválido');
    if (actorId === userId) throw forbidden('No puedes cambiar tu propio rol');
    if (!(await this.users.findById(userId))) throw notFound('Usuario no encontrado');
    const u = await this.users.setRole(userId, role);
    return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active };
  }
}
