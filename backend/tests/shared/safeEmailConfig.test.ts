import { describe, it, expect } from 'vitest';
import { assertSafeEmailConfig } from '../../src/shared/safeEmailConfig';

const brevo = { emailMode: 'brevo' as const, brevoApiKey: 'test-key-not-real', mailFromEmail: 'a@b.test', emailRedirectTo: 'dev@b.test' };

describe('assertSafeEmailConfig', () => {
  it('modo console no hace nada', () => {
    expect(() => assertSafeEmailConfig({ emailMode: 'console' }, 'production')).not.toThrow();
    expect(() => assertSafeEmailConfig({ emailMode: 'console' }, 'development')).not.toThrow();
  });
  it('brevo sin BREVO_API_KEY lanza', () => {
    expect(() => assertSafeEmailConfig({ ...brevo, brevoApiKey: undefined }, 'production')).toThrow(/BREVO_API_KEY/);
    expect(() => assertSafeEmailConfig({ ...brevo, brevoApiKey: '' }, 'production')).toThrow(/BREVO_API_KEY/);
  });
  it('brevo sin MAIL_FROM_EMAIL lanza', () => {
    expect(() => assertSafeEmailConfig({ ...brevo, mailFromEmail: undefined }, 'production')).toThrow(/MAIL_FROM_EMAIL/);
  });
  it('brevo fuera de producción sin EMAIL_REDIRECT_TO lanza', () => {
    expect(() => assertSafeEmailConfig({ ...brevo, emailRedirectTo: undefined }, 'development')).toThrow(/EMAIL_REDIRECT_TO/);
    expect(() => assertSafeEmailConfig({ ...brevo, emailRedirectTo: undefined }, undefined as unknown as string)).toThrow(/EMAIL_REDIRECT_TO/);
  });
  it('brevo fuera de producción con redirección es válido', () => {
    expect(() => assertSafeEmailConfig(brevo, 'development')).not.toThrow();
  });
  it('brevo en producción no exige redirección', () => {
    expect(() => assertSafeEmailConfig({ ...brevo, emailRedirectTo: undefined }, 'production')).not.toThrow();
  });
  it('el mensaje de error no contiene la clave', () => {
    try { assertSafeEmailConfig({ ...brevo, emailRedirectTo: undefined }, 'development'); } catch (e) {
      expect(String(e)).not.toContain('test-key-not-real');
    }
  });
});
