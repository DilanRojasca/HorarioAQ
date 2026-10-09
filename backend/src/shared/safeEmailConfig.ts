import { Config } from './config';

/** Falla al arrancar si el correo real (Brevo) está mal configurado o pondría en riesgo a usuarios de prueba. */
export function assertSafeEmailConfig(
  cfg: Pick<Config, 'emailMode'> & Partial<Pick<Config, 'brevoApiKey' | 'mailFromEmail' | 'emailRedirectTo'>>,
  env: string | undefined,
) {
  if (cfg.emailMode !== 'brevo') return;
  if (!cfg.brevoApiKey) throw new Error('EMAIL_MODE=brevo requiere BREVO_API_KEY');
  if (!cfg.mailFromEmail) throw new Error('EMAIL_MODE=brevo requiere MAIL_FROM_EMAIL');
  if (env !== 'production' && !cfg.emailRedirectTo) {
    throw new Error('Fuera de producción, EMAIL_MODE=brevo requiere EMAIL_REDIRECT_TO para no escribir a usuarios de prueba');
  }
}
