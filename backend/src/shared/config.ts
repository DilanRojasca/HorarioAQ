function emailMode(v: string | undefined): 'console' | 'brevo' {
  const mode = v || 'console';
  if (mode !== 'console' && mode !== 'brevo') throw new Error(`EMAIL_MODE inválido: "${mode}" (use "console" o "brevo")`);
  return mode;
}

type Env = Record<string, string | undefined>;

function windowHour(name: string, v: string | undefined, fallback: number): number {
  const n = v === undefined || v === '' ? fallback : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 24) throw new Error(`${name} inválido: "${v}" (use un entero entre 0 y 24)`);
  return n;
}

function timeZone(v: string | undefined): string {
  const tz = v || 'America/Bogota';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new Error(`NOTIFY_WINDOW_TZ inválida: "${tz}" (use una zona horaria IANA, p. ej. America/Bogota)`);
  }
  return tz;
}

function positiveOr(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Lee y valida la configuración del entorno; los valores inválidos lanzan un error en español al arrancar. */
export function parseConfig(env: Env) {
  const notifyWindowStart = windowHour('NOTIFY_WINDOW_START', env.NOTIFY_WINDOW_START, 6);
  const notifyWindowEnd = windowHour('NOTIFY_WINDOW_END', env.NOTIFY_WINDOW_END, 22);
  if (notifyWindowStart >= notifyWindowEnd) {
    throw new Error(`NOTIFY_WINDOW_START (${notifyWindowStart}) debe ser menor que NOTIFY_WINDOW_END (${notifyWindowEnd})`);
  }
  const notifyTimezone = timeZone(env.NOTIFY_WINDOW_TZ);
  const sseHeartbeatMs = positiveOr(env.SSE_HEARTBEAT_MS, 25000);
  return {
    port: Number(env.PORT ?? 4000),
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    semester: env.ACTIVE_SEMESTER ?? '2026-2',
    semesterStart: env.SEMESTER_START ?? '2026-08-03',
    semesterWeeks: Number(env.SEMESTER_WEEKS ?? 16),
    syncCron: env.SYNC_CRON ?? '0 3 * * *',
    syncConcurrency: Number(env.SYNC_CONCURRENCY ?? 5),
    notifyWindowStart,
    notifyWindowEnd,
    notifyTimezone,
    emailMode: emailMode(env.EMAIL_MODE),
    brevoApiKey: env.BREVO_API_KEY || undefined,
    mailFromEmail: env.MAIL_FROM_EMAIL || undefined,
    mailFromName: env.MAIL_FROM_NAME || 'Horario UNI',
    emailRedirectTo: env.EMAIL_REDIRECT_TO || undefined,
    sseHeartbeatMs,
    notifyFlushCron: env.NOTIFY_FLUSH_CRON ?? '*/5 * * * *',
  };
}

export const config = parseConfig(process.env);
export type Config = typeof config;
