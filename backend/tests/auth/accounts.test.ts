import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUseCase } from '../../src/modules/auth/application/Register';
import { ResendVerificationUseCase, VerifyAccountUseCase } from '../../src/modules/auth/application/VerifyAccount';
import { RequestPasswordResetUseCase, ResetPasswordUseCase } from '../../src/modules/auth/application/PasswordReset';
import { GetProfileUseCase, UpdatePreferencesUseCase, UpdateProfileUseCase } from '../../src/modules/auth/application/UpdateProfile';
import { ChangeUserRoleUseCase, ListUsersUseCase } from '../../src/modules/auth/application/ManageUsers';
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, OtpService } from '../../src/modules/auth/application/OtpService';
import { RefreshTokenService } from '../../src/modules/auth/application/RefreshTokenService';
import { LoginUseCase } from '../../src/modules/auth/application/Login';
import {
  FakeHasher, FakeTokens, FixedOtpCodec, InMemoryOtps, InMemoryRefreshTokens, InMemoryUsers, RecordingOtpMailer,
} from '../helpers/inMemory';

const input = { name: 'Ana Pérez', documentType: 'CC', documentNumber: '1234567', email: 'Ana@amigo.edu.co', password: 'Segura123' };
let users: InMemoryUsers, otps: InMemoryOtps, mailer: RecordingOtpMailer, clock: Date, otp: OtpService, hasher: FakeHasher;
let refreshRepo: InMemoryRefreshTokens, refresh: RefreshTokenService;

beforeEach(() => {
  users = new InMemoryUsers(); otps = new InMemoryOtps(); mailer = new RecordingOtpMailer(); hasher = new FakeHasher();
  clock = new Date('2026-09-01T12:00:00Z');
  otp = new OtpService(otps, new FixedOtpCodec(), mailer, () => clock);
  refreshRepo = new InMemoryRefreshTokens();
  refresh = new RefreshTokenService(refreshRepo, users, new FakeTokens(), () => clock);
});

describe('Registro (RF-AUTH-01/05, RRF-06)', () => {
  it('crea la cuenta INACTIVA, normaliza el correo y envía el OTP', async () => {
    const r = await new RegisterUseCase(users, hasher, otp).execute(input);
    expect(r).toEqual({ email: 'ana@amigo.edu.co', verificationRequired: true });
    const u = (await users.findByEmail('ana@amigo.edu.co'))!;
    expect(u.active).toBe(false);
    expect(u.passwordHash).toBe('hash:Segura123');
    expect(mailer.sent).toEqual([{ email: 'ana@amigo.edu.co', code: '123456', purpose: 'VERIFY' }]);
  });
  it('rechaza correos externos (RRF-06), contraseñas débiles y nombres incompletos', async () => {
    const uc = new RegisterUseCase(users, hasher, otp);
    await expect(uc.execute({ ...input, email: 'ana@gmail.com' })).rejects.toMatchObject({ status: 400, message: /institucional/ });
    await expect(uc.execute({ ...input, password: 'corta' })).rejects.toMatchObject({ status: 400 });
    await expect(uc.execute({ ...input, name: 'Ana' })).rejects.toMatchObject({ status: 400, message: /completo/ });
    await expect(uc.execute({ ...input, documentType: 'XX' })).rejects.toMatchObject({ status: 400 });
    expect(users.users).toHaveLength(0);
  });
  it('409 si el correo ya existe', async () => {
    const uc = new RegisterUseCase(users, hasher, otp);
    await uc.execute(input);
    await expect(uc.execute(input)).rejects.toMatchObject({ status: 409 });
  });
});

describe('Verificación de cuenta y OTP', () => {
  beforeEach(async () => { await new RegisterUseCase(users, hasher, otp).execute(input); });

  it('con el código correcto activa la cuenta y el login funciona', async () => {
    await new VerifyAccountUseCase(users, otp, () => clock).execute({ email: 'ana@amigo.edu.co', code: '123456' });
    const u = (await users.findByEmail('ana@amigo.edu.co'))!;
    expect(u.active).toBe(true);
    expect(u.verifiedAt).toEqual(clock);
    const login = await new LoginUseCase(users, hasher, new FakeTokens(), refresh).execute({ email: 'ana@amigo.edu.co', password: 'Segura123' });
    expect(login.refreshToken).toBeTruthy();
  });
  it('sin verificar, el login responde 403 con mensaje claro', async () => {
    await expect(new LoginUseCase(users, hasher, new FakeTokens()).execute({ email: 'ana@amigo.edu.co', password: 'Segura123' }))
      .rejects.toMatchObject({ status: 403 });
  });
  it('código incorrecto → 400 y cuenta intacta; el código es de un solo uso', async () => {
    const v = new VerifyAccountUseCase(users, otp, () => clock);
    await expect(v.execute({ email: 'ana@amigo.edu.co', code: '000000' })).rejects.toMatchObject({ status: 400 });
    expect((await users.findByEmail('ana@amigo.edu.co'))!.active).toBe(false);
    await v.execute({ email: 'ana@amigo.edu.co', code: '123456' });
    await expect(v.execute({ email: 'ana@amigo.edu.co', code: '123456' })).rejects.toMatchObject({ status: 400 });
  });
  it('el OTP vence a los 10 minutos (RF-AUTH-04)', async () => {
    clock = new Date(clock.getTime() + OTP_TTL_MS + 1000);
    await expect(new VerifyAccountUseCase(users, otp, () => clock).execute({ email: 'ana@amigo.edu.co', code: '123456' })).rejects.toMatchObject({ status: 400 });
  });
  it(`tras ${OTP_MAX_ATTEMPTS} intentos fallidos el código se bloquea aunque luego sea el correcto`, async () => {
    const v = new VerifyAccountUseCase(users, otp, () => clock);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await v.execute({ email: 'ana@amigo.edu.co', code: '999999' }).catch(() => {});
    await expect(v.execute({ email: 'ana@amigo.edu.co', code: '123456' })).rejects.toMatchObject({ status: 400 });
  });
  it('reenviar emite un código nuevo y no revela si la cuenta existe', async () => {
    const r = new ResendVerificationUseCase(users, otp);
    expect(await r.execute({ email: 'nadie@amigo.edu.co' })).toEqual({ sent: true });
    await r.execute({ email: 'ana@amigo.edu.co' });
    expect(mailer.sent).toHaveLength(2);
  });
});

describe('Recuperar contraseña (RF-AUTH-04, RNF-07)', () => {
  beforeEach(async () => {
    users.users.push({ id: 'u1', name: 'Ana', email: 'ana@amigo.edu.co', passwordHash: 'hash:Vieja1234', role: 'STUDENT', active: true, verifiedAt: new Date() });
  });
  it('solicitar no enumera cuentas; con OTP válido cambia la contraseña y revoca los refresh tokens', async () => {
    expect(await new RequestPasswordResetUseCase(users, otp).execute({ email: 'x@amigo.edu.co' })).toEqual({ sent: true });
    expect(mailer.sent).toHaveLength(0);
    await new RequestPasswordResetUseCase(users, otp).execute({ email: 'ana@amigo.edu.co' });
    expect(mailer.sent[0]).toMatchObject({ purpose: 'RESET' });
    const session = await refresh.issue({ id: 'u1', role: 'STUDENT' });
    await new ResetPasswordUseCase(users, hasher, otp, refresh).execute({ email: 'ana@amigo.edu.co', code: '123456', newPassword: 'Nueva12345' });
    expect(users.users[0].passwordHash).toBe('hash:Nueva12345');
    await expect(refresh.rotate(session.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
  it('rechaza contraseña débil y código inválido', async () => {
    await new RequestPasswordResetUseCase(users, otp).execute({ email: 'ana@amigo.edu.co' });
    const r = new ResetPasswordUseCase(users, hasher, otp);
    await expect(r.execute({ email: 'ana@amigo.edu.co', code: '123456', newPassword: 'abc' })).rejects.toMatchObject({ status: 400 });
    await expect(r.execute({ email: 'ana@amigo.edu.co', code: '111111', newPassword: 'Nueva12345' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Refresh token rotativo (RNF-05)', () => {
  it('rota: el anterior deja de servir y se emite uno nuevo', async () => {
    users.users.push({ id: 'u1', name: 'Ana', email: 'a@amigo.edu.co', passwordHash: 'h', role: 'STUDENT', active: true });
    const first = await refresh.issue({ id: 'u1', role: 'STUDENT' });
    const second = await refresh.rotate(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(refresh.rotate(first.refreshToken)).rejects.toMatchObject({ status: 401 });
    expect((await refresh.rotate(second.refreshToken)).token).toMatch(/^tok:u1/);
  });
  it('vence a los 7 días', async () => {
    users.users.push({ id: 'u1', name: 'Ana', email: 'a@amigo.edu.co', passwordHash: 'h', role: 'STUDENT', active: true });
    const t = await refresh.issue({ id: 'u1', role: 'STUDENT' });
    clock = new Date(clock.getTime() + 8 * 24 * 3_600_000);
    await expect(refresh.rotate(t.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});

describe('Perfil y preferencias (RF-AUTH-06, RF-NOT-02/04)', () => {
  beforeEach(() => {
    users.users.push({ id: 'u1', name: 'Ana', email: 'ana@amigo.edu.co', passwordHash: 'hash:Vieja1234', role: 'STUDENT', active: true, documentType: 'CC', documentNumber: '99999' });
  });
  it('actualiza nombre y foto; el correo y el documento no cambian', async () => {
    const p = await new UpdateProfileUseCase(users, hasher).execute({ userId: 'u1', name: ' Ana María ', avatarUrl: 'https://x.co/a.png' });
    expect(p).toMatchObject({ name: 'Ana María', avatarUrl: 'https://x.co/a.png', email: 'ana@amigo.edu.co', documentNumber: '99999' });
  });
  it('cambiar contraseña exige la actual y cumplir la política', async () => {
    const uc = new UpdateProfileUseCase(users, hasher);
    await expect(uc.execute({ userId: 'u1', newPassword: 'Nueva12345' })).rejects.toMatchObject({ status: 401 });
    await expect(uc.execute({ userId: 'u1', currentPassword: 'mala', newPassword: 'Nueva12345' })).rejects.toMatchObject({ status: 401 });
    await expect(uc.execute({ userId: 'u1', currentPassword: 'Vieja1234', newPassword: 'debil' })).rejects.toMatchObject({ status: 400 });
    await uc.execute({ userId: 'u1', currentPassword: 'Vieja1234', newPassword: 'Nueva12345' });
    expect(users.users[0].passwordHash).toBe('hash:Nueva12345');
  });
  it('GetProfile entrega valores por defecto y UpdatePreferences valida canal y antelación', async () => {
    expect(await new GetProfileUseCase(users).execute({ userId: 'u1' })).toMatchObject({ notifyChannel: 'BOTH', reminderMinutes: 15 });
    const up = new UpdatePreferencesUseCase(users);
    expect(await up.execute({ userId: 'u1', notifyChannel: 'EMAIL', reminderMinutes: 30 })).toMatchObject({ notifyChannel: 'EMAIL', reminderMinutes: 30 });
    await expect(up.execute({ userId: 'u1', reminderMinutes: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(up.execute({ userId: 'u1', notifyChannel: 'SMS' as never })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Gestión de roles (RF-AUTH-07)', () => {
  beforeEach(() => {
    users.users.push(
      { id: 'a1', name: 'Admin', email: 'a@x', passwordHash: 'h', role: 'ADMIN', active: true },
      { id: 's1', name: 'Est', email: 's@x', passwordHash: 'h', role: 'STUDENT', active: true },
    );
  });
  it('lista y cambia el rol de otro usuario', async () => {
    expect(await new ListUsersUseCase(users).execute()).toHaveLength(2);
    expect(await new ChangeUserRoleUseCase(users).execute({ actorId: 'a1', userId: 's1', role: 'ADMIN' })).toMatchObject({ role: 'ADMIN' });
  });
  it('no permite cambiar el propio rol ni usuarios inexistentes', async () => {
    const uc = new ChangeUserRoleUseCase(users);
    await expect(uc.execute({ actorId: 'a1', userId: 'a1', role: 'STUDENT' })).rejects.toMatchObject({ status: 403 });
    await expect(uc.execute({ actorId: 'a1', userId: 'nadie', role: 'ADMIN' })).rejects.toMatchObject({ status: 404 });
  });
});
