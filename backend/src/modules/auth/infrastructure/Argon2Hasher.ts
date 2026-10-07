import argon2 from 'argon2';
import { PasswordHasher } from '../application/ports';

export class Argon2Hasher implements PasswordHasher {
  hash(plain: string) { return argon2.hash(plain, { type: argon2.argon2id }); }
  verify(hash: string, plain: string) { return argon2.verify(hash, plain).catch(() => false); }
}
