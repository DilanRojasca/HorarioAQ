import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REGISTRATION_CHAIN, institutionalEmailRule, passwordProblem, runRegistrationChain,
} from '../../src/modules/auth/domain/registrationRules';

const ok = { name: 'Ana Pérez', documentType: 'CC', documentNumber: '1234567', email: 'ana@amigo.edu.co', password: 'Segura123' };

describe('Cadena de responsabilidad del registro', () => {
  it('datos válidos → sin errores', () => expect(runRegistrationChain(ok)).toEqual([]));
  it('junta TODOS los errores a la vez (no se detiene en el primero)', () => {
    expect(runRegistrationChain({ name: 'A', documentType: 'XX', documentNumber: '1', email: 'a@gmail.com', password: 'x' })).toHaveLength(4);
  });
  it('el dominio institucional es exacto: @amigo.edu.co.evil.com y subdominios no pasan', () => {
    expect(institutionalEmailRule.check({ ...ok, email: 'a@amigo.edu.co.evil.com' })).not.toBeNull();
    expect(institutionalEmailRule.check({ ...ok, email: '@amigo.edu.co' })).not.toBeNull();
    expect(institutionalEmailRule.check({ ...ok, email: ' ANA@AMIGO.EDU.CO ' })).toBeNull();
  });
  it('es extensible: se puede pasar otra cadena', () => {
    const extra = { id: 'x', check: () => 'siempre falla' };
    expect(runRegistrationChain(ok, [...DEFAULT_REGISTRATION_CHAIN, extra])).toEqual(['siempre falla']);
  });
  it('política de contraseña', () => {
    expect(passwordProblem('Abcdef12')).toBeNull();
    for (const bad of ['Ab1', 'abcdefgh1', 'ABCDEFGH1', 'Abcdefgh']) expect(passwordProblem(bad)).not.toBeNull();
  });
});
