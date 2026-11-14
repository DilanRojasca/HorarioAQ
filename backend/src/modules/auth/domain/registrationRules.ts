/**
 * PATRÓN: Chain of Responsibility (variante "validar todo").
 * Cada regla es un eslabón independiente con una sola responsabilidad (SRP/OCP): para añadir una
 * validación nueva se agrega otro eslabón a la cadena sin tocar los existentes. La cadena recorre
 * todos los eslabones y junta los mensajes, así el formulario puede mostrar todos los errores a la vez
 * (usabilidad: "protección a errores", PDF sección QA).
 *
 * Capa: DOMINIO (puro, sin I/O). El frontend replica estas mismas reglas en
 * `frontend/src/features/auth/registrationRules.ts` para validar en tiempo real.
 * Requisitos: RF-AUTH-01, RRF-06 (solo correo @amigo.edu.co), RNF-04/07 (contraseña fuerte).
 */
export interface RegistrationData {
  name: string;
  documentType: string;
  documentNumber: string;
  email: string;
  password: string;
}

/** Eslabón de la cadena: devuelve un mensaje de error o `null` si el dato es válido. */
export interface RegistrationRule {
  readonly id: string;
  check(data: RegistrationData): string | null;
}

export const INSTITUTIONAL_DOMAIN = '@amigo.edu.co';
export const DOCUMENT_TYPES = ['CC', 'TI', 'CE', 'PASAPORTE'] as const;

export const institutionalEmailRule: RegistrationRule = {
  id: 'institutional-email',
  check: ({ email }) => (email.trim().toLowerCase().endsWith(INSTITUTIONAL_DOMAIN) && email.trim().length > INSTITUTIONAL_DOMAIN.length
    ? null : `Usa tu correo institucional (${INSTITUTIONAL_DOMAIN})`),
};

export const fullNameRule: RegistrationRule = {
  id: 'full-name',
  check: ({ name }) => (name.trim().split(/\s+/).filter(Boolean).length >= 2 && name.trim().length <= 120
    ? null : 'Ingresa tu nombre completo (nombre y apellido)'),
};

export const documentRule: RegistrationRule = {
  id: 'document',
  check: ({ documentType, documentNumber }) => {
    if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) return 'Tipo de documento inválido';
    return /^[A-Za-z0-9]{5,20}$/.test(documentNumber.trim()) ? null : 'El número de documento debe tener entre 5 y 20 caracteres alfanuméricos';
  },
};

export const passwordStrengthRule: RegistrationRule = {
  id: 'password-strength',
  check: ({ password }) => passwordProblem(password),
};

/** Política de contraseña (también la usan recuperación y cambio de contraseña). */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'La contraseña debe combinar mayúsculas y minúsculas';
  if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número';
  return null;
}

/** La cadena por defecto, en orden de presentación. */
export const DEFAULT_REGISTRATION_CHAIN: RegistrationRule[] = [
  fullNameRule, documentRule, institutionalEmailRule, passwordStrengthRule,
];

export function runRegistrationChain(data: RegistrationData, chain: RegistrationRule[] = DEFAULT_REGISTRATION_CHAIN): string[] {
  return chain.map((rule) => rule.check(data)).filter((m): m is string => m !== null);
}
