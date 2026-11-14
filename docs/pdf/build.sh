#!/bin/sh
# Genera docs/Horario_UNI_Arquitectura_y_Patrones.pdf a partir de ARQUITECTURA.md y PATRONES.md.
# Requiere: pandoc, python3 y un navegador Chromium (Brave/Chrome) para imprimir a PDF.
# Los diagramas Mermaid se renderizan con mermaid.js desde jsdelivr (necesita red).
set -e
cd "$(dirname "$0")"
OUT="../Horario_UNI_Arquitectura_y_Patrones.pdf"
BROWSER="${BROWSER:-/Applications/Brave Browser.app/Contents/MacOS/Brave Browser}"
python3 prepare.py > combined.md
pandoc combined.md -f gfm -t html5 --standalone --toc --toc-depth=2 \
  --metadata title="Horario UNI — Arquitectura y patrones de diseño" \
  --css style.css --template template.html -o doc.html
"$BROWSER" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf="$OUT" "file://$(pwd)/doc.html" 2>/dev/null
rm -f combined.md doc.html
echo "PDF: $OUT"
