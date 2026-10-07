import { Role } from '../../schedule/domain/types';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
}
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
export interface TokenPayload {
  sub: string;
  role: Role;
  jti: string;
  exp: number;
}
export interface TokenService {
  sign(user: { id: string; role: Role }): string;
  verify(token: string): TokenPayload; // lanza unauthorized si es inválido/expirado
}
export interface RevokedTokenRepository {
  revoke(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
