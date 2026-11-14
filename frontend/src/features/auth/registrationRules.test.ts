import { describe, it, expect } from 'vitest';
import { passwordProblem, validateRegistration } from './registrationRules';

const ok = { name: 'Ana Pérez', documentType: 'CC', documentNumber: '1234567', email: 'ana@amigo.edu.co', password: 'Segura123' };

describe('validateRegistration (réplica de la cadena del backend)', () => {
  it('datos válidos → sin errores', () => expect(validateRegistration(ok)).toEqual({}));
  it('marca cada campo inválido por separado', () => {
    const e = validateRegistration({ name: 'Ana', documentType: '', documentNumber: '1', email: 'a@gmail.com', password: 'x' });
    expect(Object.keys(e).sort()).toEqual(['documentNumber', 'documentType', 'email', 'name', 'password']);
  });
  it('solo el dominio institucional exacto', () => {
    expect(validateRegistration({ ...ok, email: 'a@amigo.edu.co.evil.com' }).email).toBeTruthy();
    expect(validateRegistration({ ...ok, email: 'A@AMIGO.EDU.CO' }).email).toBeUndefined();
  });
  it('política de contraseña', () => {
    expect(passwordProblem('Abcdef12')).toBeNull();
    for (const bad of ['Ab1', 'abcdefgh1', 'ABCDEFGH1', 'Abcdefgh']) expect(passwordProblem(bad)).not.toBeNull();
  });
});
