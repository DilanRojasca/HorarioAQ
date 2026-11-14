"""Une ARQUITECTURA.md y PATRONES.md en un solo Markdown listo para el PDF:
 - antepone la portada;
 - convierte los enlaces relativos a texto (en papel no se puede hacer clic) conservando el archivo y la línea;
 - marca los bloques mermaid para que mermaid.js los dibuje."""
import re, pathlib

docs = pathlib.Path(__file__).resolve().parent.parent

def clean_links(md: str) -> str:
    def repl(m):
        text, target = m.group(1), m.group(2)
        if target.startswith('http') or target.startswith('#'):
            return text if target.startswith('#') else f'{text} ({target})'
        path = target.split('#')[0]
        base = path.rstrip('/').split('/')[-1]
        plain = text.strip('`')
        # «:36», «(:19)» o «:19» sin archivo → anteponer el nombre del archivo del enlace
        if re.fullmatch(r':?\d+(-\d+)?', plain) or plain.startswith(':'):
            return f'`{base}{plain if plain.startswith(":") else ":" + plain}`'
        return text
    return re.sub(r'\[([^\]]+)\]\(([^)\s]+?)(?:\s+"[^"]*")?\)', repl, md)

def body(name, demote=False):
    md = (docs / name).read_text(encoding='utf-8')
    md = clean_links(md)
    md = md.replace('## Índice', '## Mapa de patrones')
    return md

cover = '''<div class="cover">
<div class="uni">Universidad Católica Luis Amigó · Arquitectura de Sistemas</div>
<h1 class="first">Horario UNI</h1>
<div class="sub">Documento de arquitectura y patrones de diseño</div>
<dl>
<dt>Integrantes</dt><dd>Dilan Alexander Rojas Carmona<br>Sebastian Velez Guarin</dd>
<dt>Docente</dt><dd>Javier Cardona</dd>
<dt>Contenido</dt><dd>Parte 1 — Arquitectura del sistema (estilo, capas, módulos, flujos, calidad, trazabilidad)<br>Parte 2 — Catálogo de patrones: dónde nace y dónde se usa cada uno, y por qué<br>Parte 3 — Índice generado desde el código: archivo y línea de cada marca @pattern</dd>
<dt>Stack</dt><dd>React 18 + Vite · Node 20 + Express + Prisma · PostgreSQL</dd>
</dl>
</div>

'''
print(cover)
print('# Parte 1 — Arquitectura\n')
print(re.sub(r'^# .*\n', '', body('ARQUITECTURA.md'), count=1))
print('\n# Parte 2 — Patrones de diseño: dónde y por qué\n')
print(re.sub(r'^# .*\n', '', body('PATRONES.md'), count=1))
print('\n# Parte 3 — Índice generado de marcas @pattern\n')
print(re.sub(r'^# .*\n', '', body('INDICE_PATRONES.md'), count=1))
