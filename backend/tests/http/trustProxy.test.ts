import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/shared/http/app';

const cfg = { port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16, syncCron: '', syncConcurrency: 2 };
const build = () => createApp({} as never, cfg);

describe('createApp: trust proxy', () => {
  const saved = process.env.TRUST_PROXY;
  afterEach(() => {
    if (saved === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = saved;
  });

  it('TRUST_PROXY=1 → trust proxy = 1', () => {
    process.env.TRUST_PROXY = '1';
    expect(build().get('trust proxy')).toBe(1);
  });

  it('por defecto es 0 (no se confía en X-Forwarded-For)', () => {
    delete process.env.TRUST_PROXY;
    expect(build().get('trust proxy')).toBe(0);
  });

  it('un valor no numérico cuenta como 0', () => {
    process.env.TRUST_PROXY = 'abc';
    expect(build().get('trust proxy')).toBe(0);
  });
});
