#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/assets/logo.png"

sips -z 1024 1024 "$SRC" --out "$ROOT_DIR/assets/icon.png" >/dev/null
sips -z 1024 1024 "$SRC" --out "$ROOT_DIR/assets/adaptive-icon.png" >/dev/null
sips -z 1024 1024 "$SRC" --out "$ROOT_DIR/assets/splash-icon.png" >/dev/null

sips -z 512 512 "$SRC" --out "$ROOT_DIR/public/icon-512.png" >/dev/null
sips -z 192 192 "$SRC" --out "$ROOT_DIR/public/icon-192.png" >/dev/null
sips -z 48 48 "$SRC" --out "$ROOT_DIR/assets/favicon.png" >/dev/null
cp "$ROOT_DIR/assets/favicon.png" "$ROOT_DIR/public/favicon.png"

echo "Generated app and PWA logo assets from assets/logo.png"
