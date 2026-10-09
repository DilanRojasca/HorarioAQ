#!/bin/sh
# Regenera la fuente de iconos reducida. Requiere python3 (crea un venv temporal con fonttools+brotli).
# Uso: npm run icons   (desde frontend/)
set -e
cd "$(dirname "$0")/.."
VENV="${TMPDIR:-/tmp}/horario-icons-venv"
[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" -q install fonttools brotli
"$VENV/bin/python" scripts/subset_icons.py node_modules/material-symbols/material-symbols-outlined.woff2 \
  src/assets/fonts/icons.txt src/assets/fonts/material-symbols-subset.woff2
