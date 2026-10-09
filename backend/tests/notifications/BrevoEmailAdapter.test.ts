import { describe, it, expect, vi } from 'vitest';
import { BrevoEmailAdapter } from '../../src/modules/notifications/infrastructure/BrevoEmailAdapter';

const KEY = 'test-key-not-real';
const from = { email: 'no-reply@horariouni.test', name: 'Horario UNI' };
const msg = { to: 'ana@horariouni.test', subject: 'Clase cancelada', text: 'Algoritmos' };

const okResponse = () => new Response('{}', { status: 201 });
function adapter(fetchFn: typeof fetch, redirectTo?: string) {
  return new BrevoEmailAdapter({ apiKey: KEY, from, redirectTo, fetchFn });
}

describe('BrevoEmailAdapter', () => {
  it('hace POST a la API v3 con cabeceras y cuerpo exactos', async () => {
    const fetchFn = vi.fn(async () => okResponse());
    await adapter(fetchFn as unknown as typeof fetch).send({ ...msg, html: '<b>x</b>' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'api-key': KEY, 'content-type': 'application/json', accept: 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      sender: from, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, htmlContent: '<b>x</b>',
    });
  });

  it('sin html no envía htmlContent', async () => {
    const fetchFn = vi.fn(async () => okResponse());
    await adapter(fetchFn as unknown as typeof fetch).send(msg);
    const body = JSON.parse(((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string);
    expect(body).not.toHaveProperty('htmlContent');
  });

  it('con redirectTo cambia el destinatario y antepone el original al asunto', async () => {
    const fetchFn = vi.fn(async () => okResponse());
    await adapter(fetchFn as unknown as typeof fetch, 'dev@ejemplo.test').send(msg);
    const body = JSON.parse(((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string);
    expect(body.to).toEqual([{ email: 'dev@ejemplo.test' }]);
    expect(body.subject).toBe('[DEV → ana@horariouni.test] Clase cancelada');
  });

  it.each([400, 401, 500])('respuesta %i lanza sin filtrar la clave ni las cabeceras', async (status) => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ message: 'api-key inválida' }), { status }));
    const err = await adapter(fetchFn as unknown as typeof fetch).send(msg).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toContain(`Brevo respondió ${status}`);
    expect(String(err)).not.toContain(KEY);
    expect(String(err)).not.toContain('api-key:');
    expect(JSON.stringify(err)).not.toContain(KEY);
  });

  it('trunca el mensaje de Brevo a 200 caracteres', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ message: 'm'.repeat(500) }), { status: 400 }));
    const err = await adapter(fetchFn as unknown as typeof fetch).send(msg).catch((e) => e);
    expect(String(err)).not.toContain('m'.repeat(201));
  });

  it('un cuerpo de error no JSON no rompe el mensaje', async () => {
    const fetchFn = vi.fn(async () => new Response('<html>', { status: 502 }));
    await expect(adapter(fetchFn as unknown as typeof fetch).send(msg)).rejects.toThrow('Brevo respondió 502');
  });

  it('un fallo de red no incluye la clave en el error', async () => {
    const fetchFn = vi.fn(async () => { throw new Error(`conexión rechazada con ${KEY}`); });
    const err = await adapter(fetchFn as unknown as typeof fetch).send(msg).catch((e) => e);
    expect(String(err)).not.toContain(KEY);
  });
});
