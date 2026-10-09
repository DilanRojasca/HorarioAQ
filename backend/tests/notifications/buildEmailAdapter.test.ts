import { describe, it, expect } from 'vitest';
import { buildEmailAdapter } from '../../src/modules/notifications/infrastructure/buildEmailAdapter';
import { ConsoleEmailAdapter } from '../../src/modules/notifications/infrastructure/ConsoleEmailAdapter';
import { BrevoEmailAdapter } from '../../src/modules/notifications/infrastructure/BrevoEmailAdapter';

const base = { emailMode: 'console' as const, brevoApiKey: undefined, mailFromEmail: undefined, mailFromName: 'Horario UNI', emailRedirectTo: undefined };

describe('buildEmailAdapter', () => {
  it('console -> ConsoleEmailAdapter', () => {
    expect(buildEmailAdapter(base, 'development')).toBeInstanceOf(ConsoleEmailAdapter);
  });
  it('brevo con clave y remitente -> BrevoEmailAdapter', () => {
    const a = buildEmailAdapter({ ...base, emailMode: 'brevo', brevoApiKey: 'test-key-not-real', mailFromEmail: 'a@b.test', emailRedirectTo: 'dev@ejemplo.test' }, 'development');
    expect(a).toBeInstanceOf(BrevoEmailAdapter);
  });
  it('brevo sin clave o sin remitente lanza error en español', () => {
    expect(() => buildEmailAdapter({ ...base, emailMode: 'brevo', mailFromEmail: 'a@b.test' }, 'production')).toThrow(/BREVO_API_KEY/);
    expect(() => buildEmailAdapter({ ...base, emailMode: 'brevo', brevoApiKey: 'test-key-not-real' }, 'production')).toThrow(/MAIL_FROM_EMAIL/);
  });
  it('brevo fuera de producción sin EMAIL_REDIRECT_TO lanza (cubre servidor, seed y scripts)', () => {
    const brevo = { ...base, emailMode: 'brevo' as const, brevoApiKey: 'test-key-not-real', mailFromEmail: 'a@b.test' };
    expect(() => buildEmailAdapter(brevo, 'development')).toThrow(/EMAIL_REDIRECT_TO/);
    expect(() => buildEmailAdapter(brevo, undefined)).toThrow(/EMAIL_REDIRECT_TO/);
    expect(buildEmailAdapter(brevo, 'production')).toBeInstanceOf(BrevoEmailAdapter);
  });
});
