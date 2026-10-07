import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtTokenService } from '../../src/modules/auth/infrastructure/JwtTokenService';

describe('JwtTokenService', () => {
  const svc = new JwtTokenService('secret');
  it('firma y verifica con expiración de 60 minutos', () => {
    const t = svc.sign({ id: 'u1', role: 'ADMIN' });
    const p = svc.verify(t);
    expect(p).toMatchObject({ sub: 'u1', role: 'ADMIN' });
    expect(p.jti).toBeTruthy();
    const raw = jwt.decode(t) as { iat: number; exp: number };
    expect(raw.exp - raw.iat).toBe(3600);
  });
  it('jti distinto por token', () => {
    expect(svc.verify(svc.sign({ id: 'u', role: 'STUDENT' })).jti).not.toBe(svc.verify(svc.sign({ id: 'u', role: 'STUDENT' })).jti);
  });
  it('401 con firma inválida', () => {
    const t = new JwtTokenService('otra').sign({ id: 'u1', role: 'STUDENT' });
    expect(() => svc.verify(t)).toThrow(/Token/);
  });
  it('401 con token expirado', () => {
    const t = jwt.sign({ role: 'STUDENT' }, 'secret', { subject: 'u1', expiresIn: -10, jwtid: 'j' });
    expect(() => svc.verify(t)).toThrow(/Token/);
  });
});
