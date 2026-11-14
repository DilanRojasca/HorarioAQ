import { badRequest, notFound, unauthorized } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { passwordProblem } from '../domain/registrationRules';
import { RefreshTokenService } from './RefreshTokenService';
import { NOTIFY_CHANNELS, NotifyChannel, PasswordHasher, User, UserRepository } from './ports';

export interface ProfileView {
  id: string; name: string; email: string; role: User['role']; documentType: string | null; documentNumber: string | null;
  avatarUrl: string | null; notifyChannel: NotifyChannel; reminderMinutes: number;
}
export const toProfile = (u: User): ProfileView => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  documentType: u.documentType ?? null, documentNumber: u.documentNumber ?? null, avatarUrl: u.avatarUrl ?? null,
  notifyChannel: u.notifyChannel ?? 'BOTH', reminderMinutes: u.reminderMinutes ?? 15,
});

export class GetProfileUseCase implements UseCase<{ userId: string }, ProfileView> {
  constructor(private users: UserRepository) {}
  async execute({ userId }: { userId: string }) {
    const u = await this.users.findById(userId);
    if (!u) throw notFound('Usuario no encontrado');
    return toProfile(u);
  }
}

export interface UpdateProfileInput {
  userId: string; name?: string; avatarUrl?: string | null; currentPassword?: string; newPassword?: string;
}

/**
 * RF-AUTH-06: se puede cambiar nombre, foto y contraseña. NO el correo ni el documento: esos campos
 * ni existen en la entrada (la ruta además rechaza cualquier otro campo con zod `.strict()`).
 */
export class UpdateProfileUseCase implements UseCase<UpdateProfileInput, ProfileView> {
  constructor(private users: UserRepository, private hasher: PasswordHasher, private refresh?: RefreshTokenService) {}

  async execute(i: UpdateProfileInput): Promise<ProfileView> {
    const u = await this.users.findById(i.userId);
    if (!u) throw notFound('Usuario no encontrado');
    if (i.newPassword !== undefined) {
      const problem = passwordProblem(i.newPassword);
      if (problem) throw badRequest(problem);
      if (!i.currentPassword || !(await this.hasher.verify(u.passwordHash, i.currentPassword))) {
        throw unauthorized('La contraseña actual es incorrecta');
      }
      await this.users.updatePassword(u.id, await this.hasher.hash(i.newPassword));
      await this.refresh?.revokeAll(u.id);
    }
    const data: { name?: string; avatarUrl?: string | null } = {};
    if (i.name !== undefined) data.name = i.name.trim();
    if (i.avatarUrl !== undefined) data.avatarUrl = i.avatarUrl;
    return toProfile(Object.keys(data).length ? await this.users.updateProfile(u.id, data) : u);
  }
}

export interface UpdatePreferencesInput { userId: string; notifyChannel?: NotifyChannel; reminderMinutes?: number }

/** RF-NOT-04 (canal) y RF-NOT-02 (antelación del recordatorio). */
export class UpdatePreferencesUseCase implements UseCase<UpdatePreferencesInput, ProfileView> {
  constructor(private users: UserRepository) {}
  async execute(i: UpdatePreferencesInput) {
    if (i.notifyChannel !== undefined && !NOTIFY_CHANNELS.includes(i.notifyChannel)) throw badRequest('Canal inválido');
    if (i.reminderMinutes !== undefined && (!Number.isInteger(i.reminderMinutes) || i.reminderMinutes < 5 || i.reminderMinutes > 120)) {
      throw badRequest('La antelación debe estar entre 5 y 120 minutos');
    }
    return toProfile(await this.users.updatePreferences(i.userId, { notifyChannel: i.notifyChannel, reminderMinutes: i.reminderMinutes }));
  }
}
