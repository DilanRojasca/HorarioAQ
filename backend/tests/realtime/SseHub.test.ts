import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SseHub, SseWritable } from '../../src/modules/realtime/SseHub';

class FakeRes implements SseWritable {
  chunks: string[] = [];
  ended = false;
  failWrites = false;
  private closeCb: (() => void) | undefined;
  write(chunk: string) {
    if (this.failWrites) throw new Error('EPIPE');
    this.chunks.push(chunk);
    return true;
  }
  end() { this.ended = true; }
  on(_e: 'close', cb: () => void) { this.closeCb = cb; return this; }
  close() { this.closeCb?.(); }
  get text() { return this.chunks.join(''); }
}

describe('SseHub', () => {
  let hub: SseHub;
  beforeEach(() => { vi.useFakeTimers(); hub = new SseHub({ heartbeatMs: 1000 }); });
  afterEach(() => { hub.closeAll(); vi.useRealTimers(); });

  it('connect escribe el preámbulo retry + ready', () => {
    const res = new FakeRes();
    hub.connect('u1', res);
    expect(res.text).toBe('retry: 3000\n\nevent: ready\ndata: {}\n\n');
    expect(hub.connectionCount('u1')).toBe(1);
  });

  it('sendToUser solo llega a las conexiones del usuario y devuelve el conteo', () => {
    const a1 = new FakeRes(), a2 = new FakeRes(), b = new FakeRes();
    hub.connect('a', a1); hub.connect('a', a2); hub.connect('b', b);
    expect(hub.sendToUser('a', 'notification', { x: 1 })).toBe(2);
    expect(a1.text).toContain('event: notification\ndata: {"x":1}\n\n');
    expect(a2.text).toContain('event: notification\ndata: {"x":1}\n\n');
    expect(b.text).not.toContain('notification');
    expect(hub.sendToUser('nadie', 'notification', {})).toBe(0);
  });

  it('el JSON con saltos de línea queda en una sola línea data', () => {
    const res = new FakeRes();
    hub.connect('u', res);
    hub.sendToUser('u', 'notification', { message: 'a\nb\r\nc' });
    const frame = res.chunks[res.chunks.length - 1];
    expect(frame).toBe('event: notification\ndata: {"message":"a\\nb\\r\\nc"}\n\n');
    expect(frame.split('\n').filter((l) => l.startsWith('data:'))).toHaveLength(1);
  });

  it('desconectar quita la conexión; el close de la respuesta también', () => {
    const r1 = new FakeRes(), r2 = new FakeRes();
    const off = hub.connect('u', r1);
    hub.connect('u', r2);
    expect(hub.connectionCount()).toBe(2);
    off();
    expect(hub.connectionCount('u')).toBe(1);
    off(); // idempotente
    r2.close();
    expect(hub.connectionCount()).toBe(0);
    expect(hub.sendToUser('u', 'e', {})).toBe(0);
  });

  it('latido cada heartbeatMs y se detiene sin conexiones', () => {
    const res = new FakeRes();
    const off = hub.connect('u', res);
    vi.advanceTimersByTime(2500);
    expect(res.text.match(/: ping\n\n/g)).toHaveLength(2);
    off();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(res.text.match(/: ping\n\n/g)).toHaveLength(2);
  });

  it('no reinicia el temporizador con más conexiones y lo arranca de nuevo tras vaciarse', () => {
    const off = hub.connect('u', new FakeRes());
    hub.connect('v', new FakeRes());
    expect(vi.getTimerCount()).toBe(1);
    off();
    expect(vi.getTimerCount()).toBe(1);
    hub.closeAll();
    expect(vi.getTimerCount()).toBe(0);
    hub.connect('u', new FakeRes());
    expect(vi.getTimerCount()).toBe(1);
  });

  it('una escritura fallida elimina la conexión sin afectar a las demás', () => {
    const bad = new FakeRes(), good = new FakeRes();
    hub.connect('u', bad); hub.connect('u', good);
    bad.failWrites = true;
    expect(hub.sendToUser('u', 'e', {})).toBe(1);
    expect(hub.connectionCount('u')).toBe(1);
    expect(bad.ended).toBe(true);
  });

  it('un fallo de escritura en el latido elimina la conexión', () => {
    const bad = new FakeRes();
    hub.connect('u', bad);
    bad.failWrites = true;
    vi.advanceTimersByTime(1000);
    expect(hub.connectionCount()).toBe(0);
  });

  it('un fallo al escribir el preámbulo no registra la conexión', () => {
    const bad = new FakeRes();
    bad.failWrites = true;
    hub.connect('u', bad);
    expect(hub.connectionCount()).toBe(0);
  });

  it('closeAll termina todas las conexiones', () => {
    const a = new FakeRes(), b = new FakeRes();
    hub.connect('a', a); hub.connect('b', b);
    hub.closeAll();
    expect(a.ended && b.ended).toBe(true);
    expect(hub.connectionCount()).toBe(0);
  });
});
