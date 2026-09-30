#!/usr/bin/env bash
# Crée la version Firefox : le code de extension/ avec le manifest de firefox/manifest.json.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('firefox/manifest.json'))['version'])" 2>/dev/null || node -p "require('./firefox/manifest.json').version")
rm -rf dist/firefox && mkdir -p dist/firefox
cp -r extension/. dist/firefox/
cp firefox/manifest.json dist/firefox/manifest.json
OUT="dist/wikimasters-plus-firefox-${VERSION}.zip"
rm -f "$OUT"
(cd dist/firefox && zip -rq "../../$OUT" . -x '*.DS_Store')
echo "Créé : $OUT (dossier de test : dist/firefox)"
