import { describe, it, expect } from 'vitest';
import { assertSafeConfig, assertSafeSeed } from '../../src/shared/safeConfig';

describe('assertSafeConfig', () => {
  it('rechaza el secreto de desarrollo en producción', () => {
    expect(() => assertSafeConfig('production', 'dev-secret-change-me')).toThrow(/JWT_SECRET/);
  });
  it('rechaza secretos cortos', () => {
    expect(() => assertSafeConfig('production', 'corto')).toThrow(/JWT_SECRET/);
  });
  it('rechaza el antiguo valor por defecto del compose', () => {
    expect(() => assertSafeConfig('production', 'cambia-esto-en-produccion-minimo-32-caracteres')).toThrow(/JWT_SECRET/);
    expect(() => assertSafeConfig('production', 'x'.repeat(40) + 'cambia-esto')).toThrow(/JWT_SECRET/);
  });
  it('acepta un secreto aleatorio de 40 caracteres', () => {
    expect(() => assertSafeConfig('production', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')).not.toThrow();
  });
  it('no hace nada fuera de producción', () => {
    expect(() => assertSafeConfig(undefined, 'dev-secret-change-me')).not.toThrow();
    expect(() => assertSafeConfig('development', 'x')).not.toThrow();
  });
});

describe('assertSafeSeed', () => {
  it('en producción exige SEED_PASSWORD explícito y no público', () => {
    expect(() => assertSafeSeed('production', undefined)).toThrow(/SEED_PASSWORD/);
    expect(() => assertSafeSeed('production', '')).toThrow(/SEED_PASSWORD/);
    expect(() => assertSafeSeed('production', 'Cambiar123!')).toThrow(/SEED_PASSWORD/);
    expect(() => assertSafeSeed('production', 'Una-clave-propia-9')).not.toThrow();
  });
  it('fuera de producción permite el valor por defecto', () => {
    expect(() => assertSafeSeed(undefined, undefined)).not.toThrow();
  });
});
