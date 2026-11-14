import { describe, it, expect } from 'vitest';
// @ts-expect-error: script ESM sin tipos (vive fuera del paquete, en /scripts)
import { collectPatterns, renderIndex } from '../../../scripts/patterns-index.mjs';

interface Tag { pattern: string; role: string; why: string; symbol: string; kind: string; file: string; line: number }
const tags: Tag[] = collectPatterns();

/** Patrones que el proyecto declara usar: cada uno debe tener al menos una marca @pattern en el código. */
const REQUIRED = [
  'Observer', 'Facade', 'Decorator', 'Strategy', 'Specification', 'Chain of Responsibility', 'Template Method', 'Adapter', 'Factory',
  'Singleton', 'Repository', 'Dependency Injection', 'Command', 'Hexagonal (puerto)', 'Consumidor idempotente', 'Proxy', 'Provider', 'Custom Hook', 'Guard',
];

describe('Etiquetas @pattern (índice de patrones)', () => {
  it('cada patrón declarado está marcado en el código', () => {
    const present = new Set(tags.map((t) => t.pattern));
    expect(REQUIRED.filter((p) => !present.has(p))).toEqual([]);
  });
  it('toda etiqueta tiene patrón, rol y motivo, y apunta a un símbolo real', () => {
    for (const t of tags) {
      expect(t.pattern, `${t.file}:${t.line}`).toBeTruthy();
      expect(t.role, `${t.file}:${t.line}`).toBeTruthy();
      expect(t.why.length, `${t.file}:${t.line}`).toBeGreaterThan(10);
      expect(t.symbol, `${t.file}:${t.line} no resuelve su símbolo`).not.toBe('?');
    }
  });
  it('el Observer está marcado en el Subject (EventBus), en sus observadores y en el cliente', () => {
    const observers = tags.filter((t) => t.pattern === 'Observer').map((t) => t.symbol);
    expect(observers).toEqual(expect.arrayContaining(['EventBus', 'subscribe', 'publish', 'registerObservers', 'registerAuditObserver', 'registerEmailObserver', 'RealtimeClient']));
  });
  it('el índice generado lista todas las marcas con archivo y línea', () => {
    const md: string = renderIndex(tags);
    expect(md).toContain(`**${tags.length} marcas**`);
    expect(md).toMatch(/EventBus\.ts:\d+/);
  });
});
