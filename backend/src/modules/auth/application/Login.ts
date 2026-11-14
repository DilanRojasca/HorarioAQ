import { forbidden, unauthorized } from '../../../shared/errors';
import { UseCase } from '../../../shared/ports';
import { Role } from '../../schedule/domain/types';
import { RefreshTokenService } from './RefreshTokenService';
import { PasswordHasher, TokenService, UserRepository } from './ports';

export interface LoginInput { email: string; password: string }
export interface PublicUser { id: string; name: string; email: string; role: Role; avatarUrl?: string | null }
export interface LoginResult { token: string; refreshToken?: string; user: PublicUser }

export class LoginUseCase implements UseCase<LoginInput, LoginResult> {
  constructor(
    private users: UserRepository,
    private hasher: PasswordHasher,
    private tokens: TokenService,
    private refresh?: RefreshTokenService,
  ) {}

  async execute({ email, password }: LoginInput): Promise<LoginResult> {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    // Siempre se verifica la contraseña antes de revelar el estado de la cuenta (sin enumerar usuarios).
    const passwordOk = !!u && (await this.hasher.verify(u.passwordHash, password));
    if (!u || !passwordOk) throw unauthorized('Credenciales inválidas');
    if (!u.active) throw forbidden(u.verifiedAt ? 'Cuenta desactivada' : 'Debes verificar tu cuenta con el código enviado a tu correo');
    const user: PublicUser = { id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl ?? null };
    if (this.refresh) return { ...(await this.refresh.issue(u)), user };
    return { token: this.tokens.sign(u), user };
  }
}
