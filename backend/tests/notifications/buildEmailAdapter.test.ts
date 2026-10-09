import { describe, it, expect } from 'vitest';
import { buildEmailAdapter } from '../../src/modules/notifications/infrastructure/buildEmailAdapter';
import { ConsoleEmailAdapter } from '../../src/modules/notifications/infrastructure/ConsoleEmailAdapter';
import { BrevoEmailAdapter } from '../../src/modules/notifications/infrastructure/BrevoEmailAdapter';

const base = { emailMode: 'console' as const, brevoApiKey: undefined, mailFromEmail: undefined, mailFromName: 'Horario UNI', emailRedirectTo: undefined };

describe('buildEmailAdapter', () => {
  it('console -> ConsoleEmailAdapter', () => {
    expect(buildEmailAdapter(base)).toBeInstanceOf(ConsoleEmailAdapter);
  });
  it('brevo con clave y remitente -> BrevoEmailAdapter', () => {
    const a = buildEmailAdapter({ ...base, emailMode: 'brevo', brevoApiKey: 'test-key-not-real', mailFromEmail: 'a@b.test' });
    expect(a).toBeInstanceOf(BrevoEmailAdapter);
  });
  it('brevo sin clave o sin remitente lanza error en español', () => {
    expect(() => buildEmailAdapter({ ...base, emailMode: 'brevo', mailFromEmail: 'a@b.test' })).toThrow(/BREVO_API_KEY/);
    expect(() => buildEmailAdapter({ ...base, emailMode: 'brevo', brevoApiKey: 'test-key-not-real' })).toThrow(/MAIL_FROM_EMAIL/);
  });
});
