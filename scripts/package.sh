#!/usr/bin/env bash
# Crée le zip à envoyer sur le Chrome Web Store (le contenu du dossier extension/, sans dossier parent).
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])" 2>/dev/null || node -p "require('./extension/manifest.json').version")
mkdir -p dist
OUT="dist/wikimasters-plus-${VERSION}.zip"
rm -f "$OUT"
(cd extension && zip -rq "../$OUT" . -x '*.DS_Store' -x '*/.git/*')
echo "Créé : $OUT"
