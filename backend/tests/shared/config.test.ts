import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../src/shared/config';

describe('parseConfig', () => {
  it('sin variables usa los valores por defecto', () => {
    expect(parseConfig({})).toMatchObject({
      notifyWindowStart: 6, notifyWindowEnd: 22, notifyTimezone: 'America/Bogota', sseHeartbeatMs: 25000, emailMode: 'console',
    });
  });

  it('lee la ventana, la zona y el latido del entorno', () => {
    expect(parseConfig({ NOTIFY_WINDOW_START: '0', NOTIFY_WINDOW_END: '24', NOTIFY_WINDOW_TZ: 'Europe/Madrid', SSE_HEARTBEAT_MS: '5000' }))
      .toMatchObject({ notifyWindowStart: 0, notifyWindowEnd: 24, notifyTimezone: 'Europe/Madrid', sseHeartbeatMs: 5000 });
  });

  it.each([
    [{ NOTIFY_WINDOW_START: 'abc' }, /NOTIFY_WINDOW_START/],
    [{ NOTIFY_WINDOW_START: '6.5' }, /NOTIFY_WINDOW_START/],
    [{ NOTIFY_WINDOW_START: '-1' }, /NOTIFY_WINDOW_START/],
    [{ NOTIFY_WINDOW_END: '25' }, /NOTIFY_WINDOW_END/],
    [{ NOTIFY_WINDOW_START: '22', NOTIFY_WINDOW_END: '6' }, /debe ser menor/],
    [{ NOTIFY_WINDOW_START: '10', NOTIFY_WINDOW_END: '10' }, /debe ser menor/],
    [{ NOTIFY_WINDOW_TZ: 'Marte/Olympus' }, /NOTIFY_WINDOW_TZ inválida/],
    [{ EMAIL_MODE: 'smtp' }, /EMAIL_MODE inválido/],
  ])('valor inválido %j lanza un error en español', (env, msg) => {
    expect(() => parseConfig(env)).toThrow(msg);
  });

  it.each(['0', '-5', 'abc', 'Infinity', ''])('SSE_HEARTBEAT_MS=%j vuelve al valor por defecto', (v) => {
    expect(parseConfig({ SSE_HEARTBEAT_MS: v }).sseHeartbeatMs).toBe(25000);
  });
});
