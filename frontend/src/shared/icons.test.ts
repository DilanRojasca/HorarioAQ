import { describe, it, expect } from 'vitest';
import iconsTxt from '../assets/fonts/icons.txt?raw';

const allowed = new Set(iconsTxt.split('\n').map((l) => l.trim()).filter(Boolean));
const sources = import.meta.glob<string>(['/src/**/*.tsx', '!/src/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true });

function iconNames(src: string): string[] {
  const names: string[] = [];
  const span = /<span[^>]*material-symbols-outlined[^>]*>([\s\S]*?)<\/span>/g;
  for (const m of src.matchAll(span)) {
    const body = m[1];
    const literals = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
    if (literals.length) names.push(...literals);
    else if (/^[a-z0-9_]+$/.test(body.trim())) names.push(body.trim());
  }
  return names;
}

describe('iconos', () => {
  it('todo icono usado en src está en icons.txt (si no, se vería como texto)', () => {
    const used = Object.entries(sources).flatMap(([f, src]) => iconNames(src).map((n) => `${n} (${f})`));
    expect(used.length).toBeGreaterThan(0);
    const missing = used.filter((u) => !allowed.has(u.split(' ')[0]));
    expect(missing).toEqual([]);
  });
});
