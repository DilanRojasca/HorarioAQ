import { Config } from '../../../shared/config';
import { EmailPort } from '../application/ports';
import { BrevoEmailAdapter } from './BrevoEmailAdapter';
import { ConsoleEmailAdapter } from './ConsoleEmailAdapter';

type EmailConfig = Pick<Config, 'emailMode' | 'brevoApiKey' | 'mailFromEmail' | 'mailFromName' | 'emailRedirectTo'>;

/** Elige el adaptador de correo según `EMAIL_MODE`. */
export function buildEmailAdapter(cfg: EmailConfig): EmailPort {
  if (cfg.emailMode === 'console') return new ConsoleEmailAdapter();
  if (!cfg.brevoApiKey) throw new Error('EMAIL_MODE=brevo requiere BREVO_API_KEY');
  if (!cfg.mailFromEmail) throw new Error('EMAIL_MODE=brevo requiere MAIL_FROM_EMAIL');
  return new BrevoEmailAdapter({
    apiKey: cfg.brevoApiKey,
    from: { email: cfg.mailFromEmail, name: cfg.mailFromName },
    redirectTo: cfg.emailRedirectTo,
  });
}
