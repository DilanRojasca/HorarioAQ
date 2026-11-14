"""Arma el Markdown del PDF en el orden del documento de arquitectura:
   Portada · Índice · Parte I (documento principal) · Anexos A–D.
 - convierte los enlaces relativos a texto (en papel no se puede hacer clic) conservando archivo y línea;
 - los bloques mermaid se dibujan con mermaid.js al imprimir."""
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
        if re.fullmatch(r':?\d+(-\d+)?', plain) or plain.startswith(':'):
            return f'`{base}{plain if plain.startswith(":") else ":" + plain}`'
        return text
    return re.sub(r'\[([^\]]+)\]\(([^)\s]+?)(?:\s+"[^"]*")?\)', repl, md)

def body(name):
    md = (docs / name).read_text(encoding='utf-8')
    md = clean_links(md)
    md = md.replace('## Índice', '## Mapa de patrones')
    return md

def strip_title(md):  # quita el primer encabezado de nivel 1
    return re.sub(r'^# .*\n', '', md, count=1)

cover = '''<div class="cover">
<div class="uni">Universidad Católica Luis Amigó · Arquitectura de Sistemas</div>
<h1 class="first">Horario UNI</h1>
<div class="sub">Documento de arquitectura, principios de diseño y API</div>
<dl>
<dt>Integrantes</dt><dd>Dilan Alexander Rojas Carmona<br>Sebastian Velez Guarin<br>Stefany Useche</dd>
<dt>Docente</dt><dd>Javier Cardona</dd>
<dt>Repositorio</dt><dd>https://github.com/DilanRojasca/HorarioAQ</dd>
<dt>Contenido</dt><dd>Parte I — Documento de arquitectura: alcance, justificación del patrón (Hexagonal), diagramas de puertos y adaptadores por módulo, estructura de carpetas, evidencia SOLID / DRY / KISS, patrones de diseño, requisitos no funcionales, API y persistencia<br>Anexo A — Visión general, flujos y trazabilidad de requisitos<br>Anexo B — Fichas de patrones de diseño<br>Anexo C — Índice de ubicaciones de patrones (generado)<br>Anexo D — Guía de ejecución y consulta de la documentación</dd>
<dt>Versión</dt><dd>1.0 · Noviembre de 2026</dd>
<dt>Stack</dt><dd>React 18 + Vite · Node 20 + Express + Prisma · PostgreSQL</dd>
</dl>
</div>

'''
print(cover)
print('# Parte I — Documento de arquitectura\n')
print(strip_title(body('DOCUMENTO_ARQUITECTURA.md')))
print('\n# Anexo A — Visión general, flujos y trazabilidad\n')
print(strip_title(body('ARQUITECTURA.md')))
print('\n# Anexo B — Fichas de patrones de diseño\n')
print(strip_title(body('PATRONES.md')))
print('\n# Anexo C — Índice de ubicaciones de patrones\n')
print(strip_title(body('INDICE_PATRONES.md')).replace('\n## ', '\n### '))
print('\n# Anexo D — Guía de ejecución y consulta de la documentación\n')
print(strip_title(body('GUIA_EJECUCION.md')))
