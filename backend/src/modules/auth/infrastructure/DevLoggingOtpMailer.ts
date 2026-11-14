import { OtpMailer, OtpPurpose } from '../application/ports';

/**
 * PATRÓN Decorator: envuelve a cualquier `OtpMailer` y además imprime el código en el log.
 * SOLO se cablea en desarrollo con EMAIL_MODE=console (ver `main.ts`), porque ese adaptador no
 * imprime el cuerpo del correo y, sin esto, no habría forma de leer el OTP al probar el registro.
 * Nunca se usa en producción: un OTP en logs sería una fuga.
 *
 * @pattern Decorator | Decorador de mailer | Envuelve otro OtpMailer y además imprime el código (solo desarrollo).
 */
export class DevLoggingOtpMailer implements OtpMailer {
  constructor(private inner: OtpMailer, private log: (line: string) => void = console.log) {}
  async sendOtp(to: { email: string; name: string }, code: string, purpose: OtpPurpose) {
    this.log(`[otp:dev] ${purpose} para=${to.email} código=${code}`);
    await this.inner.sendOtp(to, code, purpose);
  }
}
