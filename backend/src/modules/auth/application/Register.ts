import { badRequest, conflict } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { runRegistrationChain } from '../domain/registrationRules';
import { OtpService } from './OtpService';
import { PasswordHasher, UserRepository } from './ports';

export interface RegisterInput { name: string; documentType: string; documentNumber: string; email: string; password: string }
export interface RegisterResult { email: string; verificationRequired: true }

/**
 * RF-AUTH-01 + RF-AUTH-05. Orquesta: cadena de validación → unicidad → hash (argon2) → cuenta INACTIVA
 * → OTP de verificación por correo. (PATRÓN Facade: el controlador llama a un único método.)
 */
export class RegisterUseCase implements UseCase<RegisterInput, RegisterResult> {
  constructor(private users: UserRepository, private hasher: PasswordHasher, private otp: OtpService) {}

  async execute(i: RegisterInput): Promise<RegisterResult> {
    const errors = runRegistrationChain(i);
    if (errors.length) throw badRequest(errors[0]);
    const email = i.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw conflict('Ya existe una cuenta con ese correo');
    const user = await this.users.create({
      name: i.name.trim(), email, passwordHash: await this.hasher.hash(i.password),
      documentType: i.documentType, documentNumber: i.documentNumber.trim(),
    });
    await this.otp.issue(user, 'VERIFY');
    return { email, verificationRequired: true };
  }
}
