const env = process.env;
export const config = {
  port: Number(env.PORT ?? 4000),
  jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
  corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  semester: env.ACTIVE_SEMESTER ?? '2026-2',
  semesterStart: env.SEMESTER_START ?? '2026-08-03',
  semesterWeeks: Number(env.SEMESTER_WEEKS ?? 16),
  syncCron: env.SYNC_CRON ?? '0 3 * * *',
  syncConcurrency: Number(env.SYNC_CONCURRENCY ?? 5),
};
export type Config = typeof config;
