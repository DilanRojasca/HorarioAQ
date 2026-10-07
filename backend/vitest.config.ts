import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Excluidos: arranque, jobs y adaptadores que requieren Postgres real.
      exclude: ['src/main.ts', 'src/jobs/**', 'src/**/Prisma*.ts', 'src/**/Argon2Hasher.ts'],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 },
    },
  },
});
