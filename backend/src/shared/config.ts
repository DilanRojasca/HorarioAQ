const env = process.env;
function emailMode(v: string | undefined): 'console' | 'brevo' {
  const mode = v || 'console';
  if (mode !== 'console' && mode !== 'brevo') throw new Error(`EMAIL_MODE inválido: "${mode}" (use "console" o "brevo")`);
  return mode;
}

export const config = {
  port: Number(env.PORT ?? 4000),
  jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
  corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  semester: env.ACTIVE_SEMESTER ?? '2026-2',
  semesterStart: env.SEMESTER_START ?? '2026-08-03',
  semesterWeeks: Number(env.SEMESTER_WEEKS ?? 16),
  syncCron: env.SYNC_CRON ?? '0 3 * * *',
  syncConcurrency: Number(env.SYNC_CONCURRENCY ?? 5),
  notifyWindowStart: Number(env.NOTIFY_WINDOW_START ?? 6),
  notifyWindowEnd: Number(env.NOTIFY_WINDOW_END ?? 22),
  notifyTimezone: env.NOTIFY_WINDOW_TZ ?? 'America/Bogota',
  emailMode: emailMode(env.EMAIL_MODE),
  brevoApiKey: env.BREVO_API_KEY || undefined,
  mailFromEmail: env.MAIL_FROM_EMAIL || undefined,
  mailFromName: env.MAIL_FROM_NAME || 'Horario UNI',
  emailRedirectTo: env.EMAIL_REDIRECT_TO || undefined,
  sseHeartbeatMs: Number(env.SSE_HEARTBEAT_MS ?? 25000),
  notifyFlushCron: env.NOTIFY_FLUSH_CRON ?? '*/5 * * * *',
};
export type Config = typeof config;
