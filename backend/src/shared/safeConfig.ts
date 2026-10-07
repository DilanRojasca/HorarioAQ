export const DEV_JWT_SECRET = 'dev-secret-change-me';
export const PUBLIC_SEED_PASSWORD = 'Cambiar123!';
const OLD_COMPOSE_SECRET = 'cambia-esto-en-produccion-minimo-32-caracteres';

/** En producción se exige un secreto JWT propio, largo y que no sea ningún valor público del repositorio. */
export function assertSafeConfig(env: string | undefined, secret: string) {
  if (env !== 'production') return;
  if (secret === DEV_JWT_SECRET || secret === OLD_COMPOSE_SECRET || secret.includes('cambia-esto') || secret.length < 32) {
    throw new Error('JWT_SECRET inseguro: en producción debe definirse con un valor propio de al menos 32 caracteres');
  }
}

/** En producción el seed solo corre con una contraseña explícita que no sea la pública por defecto. */
export function assertSafeSeed(env: string | undefined, password: string | undefined) {
  if (env !== 'production') return;
  if (!password || password === PUBLIC_SEED_PASSWORD) {
    throw new Error('SEED_PASSWORD obligatorio en producción y distinto de la contraseña pública por defecto');
  }
}
