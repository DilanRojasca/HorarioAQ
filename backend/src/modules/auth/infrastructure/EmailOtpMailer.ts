import { EmailPort } from '../../notifications/application/ports';
import { OtpMailer, OtpPurpose } from '../application/ports';

const COPY: Record<OtpPurpose, { subject: string; lead: string }> = {
  VERIFY: { subject: 'Verifica tu cuenta de Horario UNI', lead: 'Tu código para verificar la cuenta es' },
  RESET: { subject: 'Recupera tu contraseña de Horario UNI', lead: 'Tu código para restablecer la contraseña es' },
};

/**
 * PATRÓN Adapter: adapta el puerto de correo del módulo `notifications` (EmailPort) al puerto de
 * auth (OtpMailer). Así `auth` no depende de cómo se envía el correo (consola en desarrollo, Brevo
 * en producción) y el OTP NO pasa por el bus de eventos (que persiste los payloads).
 */
export class EmailOtpMailer implements OtpMailer {
  constructor(private email: EmailPort) {}
  async sendOtp(to: { email: string; name: string }, code: string, purpose: OtpPurpose) {
    const c = COPY[purpose];
    await this.email.send({
      to: to.email, subject: c.subject,
      text: `Hola ${to.name}.\n\n${c.lead}: ${code}\nEs de un solo uso y vence en 10 minutos.\nSi no fuiste tú, ignora este mensaje.`,
    });
  }
}
