import { badRequest } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { OtpService } from './OtpService';
import { UserRepository } from './ports';

export interface VerifyAccountInput { email: string; code: string }

/** RF-AUTH-05: la cuenta permanece inactiva hasta confirmar el OTP. Con `resend` reenvía el código. */
export class VerifyAccountUseCase implements UseCase<VerifyAccountInput, { verified: true }> {
  constructor(private users: UserRepository, private otp: OtpService, private now: () => Date = () => new Date()) {}

  async execute({ email, code }: VerifyAccountInput) {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (!u || u.verifiedAt) throw badRequest('Código inválido o vencido');
    await this.otp.verify(u.id, 'VERIFY', code);
    await this.users.activate(u.id, this.now());
    return { verified: true as const };
  }
}

/** Reenvío del OTP de verificación; responde igual exista o no la cuenta (no enumera usuarios). */
export class ResendVerificationUseCase implements UseCase<{ email: string }, { sent: true }> {
  constructor(private users: UserRepository, private otp: OtpService) {}

  async execute({ email }: { email: string }) {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (u && !u.verifiedAt) await this.otp.issue(u, 'VERIFY');
    return { sent: true as const };
  }
}
