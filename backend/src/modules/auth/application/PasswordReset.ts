import { badRequest } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { passwordProblem } from '../domain/registrationRules';
import { OtpService } from './OtpService';
import { RefreshTokenService } from './RefreshTokenService';
import { PasswordHasher, UserRepository } from './ports';

/** RF-AUTH-04: paso 1. Responde igual exista o no el correo (no enumera cuentas). */
export class RequestPasswordResetUseCase implements UseCase<{ email: string }, { sent: true }> {
  constructor(private users: UserRepository, private otp: OtpService) {}

  async execute({ email }: { email: string }) {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (u && u.active) await this.otp.issue(u, 'RESET');
    return { sent: true as const };
  }
}

export interface ResetPasswordInput { email: string; code: string; newPassword: string }

/** RF-AUTH-04: paso 2. Valida OTP (un solo uso, 10 min), cambia la contraseña y cierra todas las sesiones. */
export class ResetPasswordUseCase implements UseCase<ResetPasswordInput, { reset: true }> {
  constructor(
    private users: UserRepository, private hasher: PasswordHasher, private otp: OtpService,
    private refresh?: RefreshTokenService,
  ) {}

  async execute({ email, code, newPassword }: ResetPasswordInput) {
    const problem = passwordProblem(newPassword);
    if (problem) throw badRequest(problem);
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (!u || !u.active) throw badRequest('Código inválido o vencido');
    await this.otp.verify(u.id, 'RESET', code);
    await this.users.updatePassword(u.id, await this.hasher.hash(newPassword));
    await this.refresh?.revokeAll(u.id);
    return { reset: true as const };
  }
}
