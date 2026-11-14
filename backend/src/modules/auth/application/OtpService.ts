import { badRequest } from '../../../shared/errors';
import { OtpCodec, OtpMailer, OtpPurpose, OtpRepository } from './ports';

/** RF-AUTH-04: vigencia de 10 minutos y uso único. */
export const OTP_TTL_MS = 10 * 60_000;
/** Tras 5 intentos fallidos el código deja de ser válido (fuerza bruta de 6 dígitos). */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Servicio de aplicación reutilizado por el registro (VERIFY) y la recuperación (RESET): centraliza
 * la política del OTP en un solo sitio (DRY). Depende solo de puertos (Repository, Codec, Mailer).
 * Requisitos: RF-AUTH-04/05, RNF-07, QA "Autenticidad".
 */
export class OtpService {
  constructor(
    private repo: OtpRepository,
    private codec: OtpCodec,
    private mailer: OtpMailer,
    private now: () => Date = () => new Date(),
  ) {}

  async issue(user: { id: string; email: string; name: string }, purpose: OtpPurpose): Promise<void> {
    const code = this.codec.generate();
    await this.repo.create({
      userId: user.id, purpose, codeHash: this.codec.hash(code, `${user.id}:${purpose}`),
      expiresAt: new Date(this.now().getTime() + OTP_TTL_MS),
    });
    await this.mailer.sendOtp({ email: user.email, name: user.name }, code, purpose);
  }

  /** Consume el OTP o lanza 400 con un mensaje genérico (no revela si venció o si era incorrecto). */
  async verify(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
    const at = this.now();
    const rec = await this.repo.findActive(userId, purpose, at);
    if (!rec || rec.attempts >= OTP_MAX_ATTEMPTS) throw badRequest('Código inválido o vencido');
    if (rec.codeHash !== this.codec.hash(code.trim(), `${userId}:${purpose}`)) {
      await this.repo.recordFailedAttempt(rec.id);
      throw badRequest('Código inválido o vencido');
    }
    if (!(await this.repo.markUsed(rec.id, at))) throw badRequest('Código inválido o vencido');
  }
}
