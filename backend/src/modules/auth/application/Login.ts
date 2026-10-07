import { unauthorized } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { Role } from '../../schedule/domain/types';
import { PasswordHasher, TokenService, UserRepository } from './ports';

export interface LoginInput { email: string; password: string }
export interface LoginResult { token: string; user: { id: string; name: string; email: string; role: Role } }

export class LoginUseCase implements UseCase<LoginInput, LoginResult> {
  constructor(private users: UserRepository, private hasher: PasswordHasher, private tokens: TokenService) {}

  async execute({ email, password }: LoginInput): Promise<LoginResult> {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    const ok = u && u.active && (await this.hasher.verify(u.passwordHash, password));
    if (!u || !ok) throw unauthorized('Credenciales inválidas');
    return { token: this.tokens.sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } };
  }
}
