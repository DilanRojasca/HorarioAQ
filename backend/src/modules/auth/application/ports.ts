import { Role } from '../../schedule/domain/types';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  /** RF-AUTH-05: instante en que se confirmó el OTP de verificación (null = cuenta sin verificar). */
  verifiedAt?: Date | null;
  documentType?: string | null;
  documentNumber?: string | null;
  avatarUrl?: string | null;
  /** RF-NOT-04 */
  notifyChannel?: NotifyChannel;
  /** RF-NOT-02 */
  reminderMinutes?: number;
}

export type NotifyChannel = 'IN_APP' | 'EMAIL' | 'BOTH';
export const NOTIFY_CHANNELS: readonly NotifyChannel[] = ['IN_APP', 'EMAIL', 'BOTH'];

export interface NewUser {
  name: string; email: string; passwordHash: string; documentType: string; documentNumber: string;
}

/**
 * PATRÓN Repository: el dominio/casos de uso no saben si hay Prisma, memoria u otra cosa detrás.
 *
 * @pattern Repository | Puerto de usuarios | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Estudiantes activos, ordenados por nombre. */
  listStudents(): Promise<User[]>;
  /** Todos los usuarios (administración de roles). */
  listAll(): Promise<User[]>;
  /** Crea un estudiante INACTIVO y sin verificar (RF-AUTH-05). */
  create(u: NewUser): Promise<User>;
  /** Activa la cuenta y fija `verifiedAt`. */
  activate(id: string, at: Date): Promise<void>;
  updateProfile(id: string, data: { name?: string; avatarUrl?: string | null }): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  setRole(id: string, role: Role): Promise<User>;
  updatePreferences(id: string, data: { notifyChannel?: NotifyChannel; reminderMinutes?: number }): Promise<User>;
}

export type OtpPurpose = 'VERIFY' | 'RESET';
export interface OtpRecord { id: string; userId: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date; attempts: number }

/**
 * Puerto de persistencia de OTP (RF-AUTH-04/05).
 *
 * @pattern Repository | Puerto de códigos OTP | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás.
 */
export interface OtpRepository {
  /** Guarda un OTP nuevo e invalida los anteriores sin usar del mismo propósito. */
  create(o: { userId: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }): Promise<void>;
  /** Último OTP sin usar y vigente. */
  findActive(userId: string, purpose: OtpPurpose, now: Date): Promise<OtpRecord | null>;
  recordFailedAttempt(id: string): Promise<void>;
  /** Uso único y atómico: `true` solo para quien lo consume primero. */
  markUsed(id: string, at: Date): Promise<boolean>;
}

/**
 * Puerto del generador/codificador de OTP (permite códigos fijos en pruebas).
 *
 * @pattern Hexagonal (puerto) | Puerto: generación/hash de OTP | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador.
 */
export interface OtpCodec {
  generate(): string;
  hash(code: string, salt: string): string;
}

/**
 * Puerto de salida: entrega del OTP al correo institucional.
 *
 * @pattern Hexagonal (puerto) | Puerto: entrega del OTP | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador.
 */
export interface OtpMailer {
  sendOtp(to: { email: string; name: string }, code: string, purpose: OtpPurpose): Promise<void>;
}

/** @pattern Repository | Puerto de refresh tokens | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. */
export interface RefreshTokenRepository {
  create(r: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Revoca y devuelve el dueño si el token existe, no está revocado ni vencido (uso único: rotación). */
  consume(tokenHash: string, now: Date): Promise<{ userId: string } | null>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
/** @pattern Hexagonal (puerto) | Puerto: hash de contraseñas | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. */
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
/** @pattern Hexagonal (puerto) | Puerto: tokens de sesión | El núcleo define qué necesita; un adaptador lo implementa. El núcleo nunca importa el adaptador. */
export interface TokenService {
  sign(user: { id: string; role: Role }): string;
  verify(token: string): TokenPayload; // lanza unauthorized si es inválido/expirado
}
/** @pattern Repository | Puerto de tokens revocados | El caso de uso pide guardar/leer con vocabulario del negocio sin saber si hay SQL detrás. */
export interface RevokedTokenRepository {
  revoke(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
