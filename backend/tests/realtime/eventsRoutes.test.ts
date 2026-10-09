import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildContainer } from '../../src/shared/container';
import { createApp } from '../../src/shared/http/app';
import { EventBus } from '../../src/shared/events/EventBus';
import { InMemoryEventLog } from '../../src/shared/events/InMemoryEventLog';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { SseHub } from '../../src/modules/realtime/SseHub';
import { registerRealtimeObserver } from '../../src/modules/realtime/RealtimeObserver';
import {
  FakeHasher, FakeInstitutional, FakeTokens, InMemoryEnrollmentRepo, InMemoryNotifications, InMemoryRevoked,
  InMemoryScheduleRepo, InMemorySyncRuns, InMemoryUsers, RecordingAudit,
} from '../helpers/inMemory';

const cfg = { port: 0, jwtSecret: 's', corsOrigin: '*', semester: '2026-2', semesterStart: '2026-08-03', semesterWeeks: 16, syncCron: '', syncConcurrency: 2 };
const INSIDE = new Date('2026-10-09T15:00:00Z');

interface Client { res: http.IncomingMessage; text: () => string; waitFor: (s: string) => Promise<void>; close: () => void }

describe('GET /api/events/stream', () => {
  let server: http.Server, base: string, hub: SseHub, bus: EventBus;
  const clients: Client[] = [];
  const tokens = new FakeTokens();

  beforeEach(async () => {
    const eventLog = new InMemoryEventLog();
    bus = new EventBus({ log: eventLog, sleep: async () => {} });
    hub = new SseHub();
    registerRealtimeObserver(bus, hub, { now: () => INSIDE });
    const app = createApp(buildContainer({
      schedules: new InMemoryScheduleRepo(), enrollments: new InMemoryEnrollmentRepo([]), institutional: new FakeInstitutional(),
      syncRuns: new InMemorySyncRuns(), users: new InMemoryUsers([]), revoked: new InMemoryRevoked(), hasher: new FakeHasher(),
      tokens, audit: new RecordingAudit(), bus, eventLog, notifications: new InMemoryNotifications(), hub,
      exporters: { ics: new IcsExporter({ semesterStart: cfg.semesterStart, weeks: 16 }), pdf: new PdfExporter({ semester: '2026-2' }) },
    }, cfg), cfg);
    await new Promise<void>((r) => { server = app.listen(0, '127.0.0.1', r); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });

  const connect = (token?: string) => new Promise<Client>((resolve, reject) => {
    const req = http.get(`${base}/api/events/stream`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
      let buf = '';
      const waiters: Array<{ s: string; ok: () => void }> = [];
      res.setEncoding('utf8');
      res.on('data', (d) => { buf += d; waiters.filter((w) => buf.includes(w.s)).forEach((w) => w.ok()); });
      const c: Client = {
        res, text: () => buf, close: () => req.destroy(),
        waitFor: (s) => new Promise((ok) => { if (buf.includes(s)) ok(); else waiters.push({ s, ok }); }),
      };
      clients.push(c);
      resolve(c);
    });
    req.on('error', (e) => { if ((e as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(e); });
  });
  const tokenOf = (id: string) => tokens.sign({ id, role: 'STUDENT' });
  const until = async (cond: () => boolean) => { for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 10)); };

  it('401 sin token', async () => {
    const c = await connect();
    expect(c.res.statusCode).toBe(401);
  });

  it('con token responde con cabeceras SSE y el mensaje ready', async () => {
    const c = await connect(tokenOf('u1'));
    expect(c.res.statusCode).toBe(200);
    expect(c.res.headers['content-type']).toBe('text/event-stream; charset=utf-8');
    expect(c.res.headers['cache-control']).toBe('no-cache, no-transform');
    expect(c.res.headers['connection']).toBe('keep-alive');
    expect(c.res.headers['x-accel-buffering']).toBe('no');
    expect(c.res.headers['content-encoding']).toBeUndefined();
    await c.waitFor('event: ready\ndata: {}\n\n');
    expect(c.text().startsWith('retry: 3000\n\n')).toBe(true);
  });

  it('entrega NotificationCreated al usuario y no al resto (RRF-04)', async () => {
    const a = await connect(tokenOf('uA'));
    const b = await connect(tokenOf('uB'));
    await a.waitFor('ready'); await b.waitFor('ready');
    await bus.publish('NotificationCreated', { notificationId: 'n1', userId: 'uA', title: 'Hola', message: 'Mundo', kind: 'SCHEDULE_ADDED' });
    await a.waitFor('event: notification');
    expect(a.text()).toContain('"title":"Hola"');
    await new Promise((r) => setTimeout(r, 50));
    expect(b.text()).not.toContain('notification');
  });

  it('al cerrar el cliente se elimina la conexión del hub', async () => {
    const c = await connect(tokenOf('u1'));
    await c.waitFor('ready');
    expect(hub.connectionCount('u1')).toBe(1);
    c.close();
    await until(() => hub.connectionCount('u1') === 0);
    expect(hub.connectionCount('u1')).toBe(0);
  });
});
