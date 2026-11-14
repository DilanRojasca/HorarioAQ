/**
 * Réplica en el cliente de la cadena de validación del backend
 * (`backend/src/modules/auth/domain/registrationRules.ts`). Se usa para validar en TIEMPO REAL y
 * habilitar el botón de envío solo con datos válidos (QA "Protección a errores"). El servidor
 * vuelve a validar siempre: esto es solo comodidad de usuario, nunca seguridad.
 */
export const INSTITUTIONAL_DOMAIN = '@amigo.edu.co';
export const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
] as const;

export interface RegistrationData { name: string; documentType: string; documentNumber: string; email: string; password: string }
export type FieldErrors = Partial<Record<keyof RegistrationData, string>>;

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Mínimo 8 caracteres';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Combina mayúsculas y minúsculas';
  if (!/\d/.test(password)) return 'Incluye al menos un número';
  return null;
}

/** @pattern Chain of Responsibility | Réplica en el cliente | Validación en tiempo real; el servidor valida siempre. */
export function validateRegistration(d: RegistrationData): FieldErrors {
  const e: FieldErrors = {};
  if (d.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = 'Ingresa nombre y apellido';
  if (!DOCUMENT_TYPES.some((t) => t.value === d.documentType)) e.documentType = 'Elige un tipo de documento';
  if (!/^[A-Za-z0-9]{5,20}$/.test(d.documentNumber.trim())) e.documentNumber = 'Entre 5 y 20 caracteres alfanuméricos';
  const mail = d.email.trim().toLowerCase();
  if (!mail.endsWith(INSTITUTIONAL_DOMAIN) || mail.length <= INSTITUTIONAL_DOMAIN.length) e.email = `Usa tu correo institucional (${INSTITUTIONAL_DOMAIN})`;
  const pw = passwordProblem(d.password);
  if (pw) e.password = pw;
  return e;
}
