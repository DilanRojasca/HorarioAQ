import { describe, it, expect } from 'vitest';
import { LogoutUseCase } from '../../src/modules/auth/application/Logout';
import { InMemoryRevoked } from '../helpers/inMemory';

describe('LogoutUseCase', () => {
  it('revoca el jti del token', async () => {
    const revoked = new InMemoryRevoked();
    await new LogoutUseCase(revoked).execute({ jti: 'j1', exp: 1_900_000_000 });
    expect(await revoked.isRevoked('j1')).toBe(true);
  });
});
