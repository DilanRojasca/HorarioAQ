#!/usr/bin/env node
/**
 * Índice automático de patrones de diseño.
 *
 * Busca en el código la etiqueta estándar
 *     @pattern <Patrón> | <Rol> | <Por qué>
 * que acompaña (en su JSDoc) a CADA clase/función/interfaz que implementa un patrón, y genera
 * docs/INDICE_PATRONES.md con el archivo y la línea ACTUALES de cada una.
 *
 * Uso:  node scripts/patterns-index.mjs          → escribe docs/INDICE_PATRONES.md
 *       node scripts/patterns-index.mjs --stdout → imprime en consola
 *       grep -rn "@pattern Observer" backend/src frontend/src   → buscar a mano
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['backend/src', 'frontend/src'];
const SKIP = /(^|\/)(node_modules|dist)(\/|$)|\.test\.tsx?$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(relative(ROOT, p))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const DECL = /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(class|function|interface|const|type)\s+(\w+)/;
const METHOD = /^\s+(?:private\s+|public\s+|protected\s+)?(?:async\s+)?(\w+)\s*[<(]/;

/** Devuelve todas las etiquetas `@pattern` con su símbolo y la línea de su declaración. */
export function collectPatterns(root = ROOT) {
  const out = [];
  for (const base of SOURCES) {
    for (const file of walk(join(root, base))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const m = /@pattern\s+([^|]+)\|([^|]+)\|(.+?)\s*(\*\/)?\s*$/.exec(line);
        if (!m) return;
        // la declaración es la primera línea de código tras el bloque de comentario
        let j = i;
        while (j < lines.length && !/^\s*(export|class|function|const|async|private|public|abstract|interface|type|\w+[<(])/.test(lines[j].replace(/^\s*\*\/\s*/, '')) || /^\s*(\/?\*|\/\/)/.test(lines[j])) j++;
        const decl = lines[j] ?? '';
        const d = DECL.exec(decl);
        const symbol = d ? d[2] : (METHOD.exec(decl)?.[1] ?? '?');
        const kind = d ? d[1] : 'método';
        out.push({
          pattern: m[1].trim(), role: m[2].trim(), why: m[3].trim().replace(/\s*\*\/$/, ''),
          symbol, kind, file: relative(root, file), line: j + 1,
        });
      });
    }
  }
  return out;
}

export function renderIndex(items) {
  const byPattern = new Map();
  for (const it of items) byPattern.set(it.pattern, [...(byPattern.get(it.pattern) ?? []), it]);
  const names = [...byPattern.keys()].sort((a, b) => a.localeCompare(b, 'es'));
  const link = (it) => `[\`${it.file}:${it.line}\`](../${it.file}#L${it.line})`;
  let md = `# Índice de patrones de diseño (generado)

> **Archivo generado automáticamente** con \`node scripts/patterns-index.mjs\` (no editar a mano). Cada fila sale de una etiqueta
> \`@pattern <Patrón> | <Rol> | <Por qué>\` escrita en el JSDoc de la clase, función o interfaz que **implementa** el patrón;
> por eso el archivo y la línea siempre coinciden con el código actual. Para buscar a mano: \`grep -rn "@pattern Observer" backend/src frontend/src\`.
>
> Explicación de cada patrón y por qué se usa: [PATRONES.md](PATRONES.md) · [ARQUITECTURA.md](ARQUITECTURA.md).

**${items.length} marcas** en **${names.length} patrones** (${new Set(items.map((i) => i.file)).size} archivos).

| Patrón | Marcas |
|---|---|
${names.map((n) => `| [${n}](#${n.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '')}) | ${byPattern.get(n).length} |`).join('\n')}
`;
  for (const n of names) {
    md += `\n## ${n}\n\n| Rol | Símbolo | Ubicación | Por qué aquí |\n|---|---|---|---|\n`;
    for (const it of byPattern.get(n).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      md += `| ${it.role} | \`${it.symbol}\` (${it.kind}) | ${link(it)} | ${it.why} |\n`;
    }
  }
  return md;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = renderIndex(collectPatterns());
  if (process.argv.includes('--stdout')) console.log(md);
  else { writeFileSync(join(ROOT, 'docs/INDICE_PATRONES.md'), md); console.log('docs/INDICE_PATRONES.md generado'); }
}
