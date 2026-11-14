/**
 * Genera docs/API_ENDPOINTS.md a partir del contrato OpenAPI (el mismo que sirve Swagger UI): la tabla de endpoints del
 * documento de arquitectura se produce desde el código, así que no puede desactualizarse.
 *   npm run docs:api
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApiDocument } from '../src/shared/openapi/spec';

type Op = { tags: string[]; operationId: string; summary: string; description: string; security?: unknown[]; responses: Record<string, unknown> };
const doc = buildOpenApiDocument() as unknown as { paths: Record<string, Record<string, Op>>; tags: { name: string; description: string }[] };

const ACCESS: [RegExp, string][] = [[/\*\*Público\*\*/, 'Público'], [/Solo administradores/, 'ADMIN'], [/Solo estudiantes/, 'STUDENT'], [/Requiere sesión/, 'Sesión (cualquier rol)']];
const accessOf = (o: Op) => ACCESS.find(([rx]) => rx.test(o.description))?.[1] ?? '—';
const reqOf = (o: Op) => /Requisito: ([^.]+)\./.exec(o.description)?.[1] ?? '';

const rows = Object.entries(doc.paths).flatMap(([path, ops]) => Object.entries(ops).map(([method, o]) => ({ method: method.toUpperCase(), path, o })));
let md = `# Endpoints de la API v1 (generado)\n\nGenerado desde el contrato OpenAPI (\`GET /api/v1/openapi.json\`). **${rows.length} endpoints** en ${doc.tags.length} grupos. Base: \`/api/v1\`.\n`;
for (const tag of doc.tags) {
  const list = rows.filter((r) => r.o.tags.includes(tag.name)).sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  if (!list.length) continue;
  md += `\n### ${tag.name}\n\n${tag.description}\n\n| Método | Ruta | Acceso | Éxito | Errores documentados | Descripción | Requisito |\n|---|---|---|---|---|---|---|\n`;
  for (const { method, path, o } of list) {
    const codes = Object.keys(o.responses);
    const ok = codes.find((c) => c.startsWith('2')) ?? '';
    md += `| ${method} | \`${path}\` | ${accessOf(o)} | ${ok} | ${codes.filter((c) => !c.startsWith('2')).join(', ') || '—'} | ${o.summary} | ${reqOf(o)} |\n`;
  }
}
writeFileSync(join(__dirname, '../../docs/API_ENDPOINTS.md'), md);
console.log(`docs/API_ENDPOINTS.md generado (${rows.length} endpoints)`);
