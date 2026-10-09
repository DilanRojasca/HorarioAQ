import { EmailMessage, EmailPort } from '../application/ports';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export interface BrevoOptions {
  apiKey: string;
  from: { email: string; name: string };
  /** En desarrollo, todo correo se desvía a esta dirección. */
  redirectTo?: string;
  fetchFn?: typeof fetch;
  /** Tiempo máximo de la petición en ms (10 000 por defecto). */
  timeoutMs?: number;
}

/**
 * Envía correo transaccional por la API HTTP de Brevo. Los errores nunca incluyen la clave ni las cabeceras
 * (se redacta de cualquier mensaje devuelto por Brevo). La petición se aborta pasado `timeoutMs`.
 */
export class BrevoEmailAdapter implements EmailPort {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: BrevoOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async send(msg: EmailMessage): Promise<void> {
    const { apiKey, from, redirectTo } = this.opts;
    const body: Record<string, unknown> = {
      sender: from,
      to: [{ email: redirectTo ?? msg.to }],
      subject: redirectTo ? `[DEV → ${msg.to}] ${msg.subject}` : msg.subject,
      textContent: msg.text,
    };
    if (msg.html) body.htmlContent = msg.html;

    let res: Response;
    try {
      res = await this.fetchFn(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
      });
    } catch {
      throw new Error('No se pudo contactar con Brevo');
    }
    if (res.ok) return;
    throw new Error(`Brevo respondió ${res.status}${await this.detail(res)}`);
  }

  private async detail(res: Response): Promise<string> {
    try {
      const { message } = (await res.json()) as { message?: unknown };
      if (typeof message !== 'string' || !message) return '';
      return `: ${message.replaceAll(this.opts.apiKey, '***').slice(0, 200)}`;
    } catch {
      return '';
    }
  }
}
