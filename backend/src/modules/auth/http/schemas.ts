import '../../../shared/openapi/extend';
import { z } from 'zod';

/** Esquemas de entrada del módulo auth: validan en las rutas y alimentan la documentación OpenAPI. */
export const emailSchema = z.string().email('Correo inválido').openapi({ example: 'ana.perez@amigo.edu.co' });
export const otpCode = z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos').openapi({ example: '123456', description: 'Código de un solo uso (10 min).' });

export const loginBody = z.object({ email: emailSchema, password: z.string().min(1, 'Contraseña requerida') }).openapi('LoginRequest');

export const registerBody = z.object({
  name: z.string().max(200).openapi({ example: 'Ana Pérez Gómez', description: 'Nombre completo (nombre y apellido).' }),
  documentType: z.string().max(20).openapi({ example: 'CC', description: 'CC, TI, CE o PASAPORTE.' }),
  documentNumber: z.string().max(40).openapi({ example: '1234567890' }),
  email: emailSchema.openapi({ description: 'Solo correo institucional @amigo.edu.co (RRF-06).' }),
  password: z.string().max(200).openapi({ example: 'Segura1234', description: 'Mínimo 8 caracteres, con mayúsculas, minúsculas y un número.' }),
}).strict().openapi('RegisterRequest');

export const verifyBody = z.object({ email: emailSchema, code: otpCode }).strict().openapi('VerifyRequest');
export const emailOnlyBody = z.object({ email: emailSchema }).strict().openapi('EmailRequest');
export const resetBody = z.object({ email: emailSchema, code: otpCode, newPassword: z.string().max(200).openapi({ example: 'NuevaSegura123' }) }).strict().openapi('ResetPasswordRequest');
export const refreshBody = z.object({ refreshToken: z.string().min(10).max(200) }).strict().openapi('RefreshRequest');
export const logoutBody = z.object({ refreshToken: z.string().max(200).optional() }).openapi('LogoutRequest');

// El correo y el documento NO están en el esquema: `.strict()` rechaza cualquier intento de cambiarlos (RF-AUTH-06).
const avatar = z.string().max(150_000)
  .refine((v) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || /^https:\/\/\S+$/.test(v), 'Foto inválida')
  .nullable();
export const profileBody = z.object({
  name: z.string().max(120).optional(),
  avatarUrl: avatar.optional().openapi({ description: 'URL https o data-URL (png/jpeg/webp). `null` la elimina.' }),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().max(200).optional(),
}).strict().openapi('UpdateProfileRequest');
