import { describe, it, expect } from 'vitest';
import { LoginUseCase } from '../../src/modules/auth/application/Login';
import { FakeHasher, FakeTokens, InMemoryUsers } from '../helpers/inMemory';

const users = new InMemoryUsers([
  { id: 'u1', name: 'Ana', email: 'ana@x.co', passwordHash: 'hash:Secreta123!', role: 'STUDENT', active: true },
  { id: 'u2', name: 'Off', email: 'off@x.co', passwordHash: 'hash:Secreta123!', role: 'STUDENT', active: false },
]);
const uc = new LoginUseCase(users, new FakeHasher(), new FakeTokens());

describe('LoginUseCase', () => {
  it('devuelve token y usuario sin passwordHash', async () => {
    const r = await uc.execute({ email: 'ANA@x.co', password: 'Secreta123!' });
    expect(r.token).toMatch(/^tok:u1:STUDENT:/);
    expect(r.user).toEqual({ id: 'u1', name: 'Ana', email: 'ana@x.co', role: 'STUDENT' });
  });
  it('401 con contraseña incorrecta', async () => {
    await expect(uc.execute({ email: 'ana@x.co', password: 'mala' })).rejects.toMatchObject({ status: 401 });
  });
  it('401 con usuario inexistente o inactivo', async () => {
    await expect(uc.execute({ email: 'no@x.co', password: 'x' })).rejects.toMatchObject({ status: 401 });
    await expect(uc.execute({ email: 'off@x.co', password: 'Secreta123!' })).rejects.toMatchObject({ status: 401 });
  });
});
