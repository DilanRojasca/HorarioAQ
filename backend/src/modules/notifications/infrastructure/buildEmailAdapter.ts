import { Config } from '../../../shared/config';
import { EmailPort } from '../application/ports';
import { assertSafeEmailConfig } from '../../../shared/safeEmailConfig';
import { BrevoEmailAdapter } from './BrevoEmailAdapter';
import { ConsoleEmailAdapter } from './ConsoleEmailAdapter';

type EmailConfig = Pick<Config, 'emailMode' | 'brevoApiKey' | 'mailFromEmail' | 'mailFromName' | 'emailRedirectTo'>;

/**
 * Elige el adaptador de correo según `EMAIL_MODE`. Valida la configuración con `assertSafeEmailConfig`
 * (`env` = NODE_ENV), de modo que TODO camino que construya el cableado (servidor, seed, scripts)
 * quede cubierto: fuera de producción, Brevo sin EMAIL_REDIRECT_TO no arranca.
 */
export function buildEmailAdapter(cfg: EmailConfig, env: string | undefined): EmailPort {
  assertSafeEmailConfig(cfg, env);
  if (cfg.emailMode === 'console') return new ConsoleEmailAdapter();
  return new BrevoEmailAdapter({
    apiKey: cfg.brevoApiKey!,
    from: { email: cfg.mailFromEmail!, name: cfg.mailFromName },
    redirectTo: cfg.emailRedirectTo,
  });
}
