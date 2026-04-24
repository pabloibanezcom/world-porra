#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/assets/logo.svg"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

qlmanage -t -s 1024 -o "$TMP_DIR" "$SRC" >/dev/null
RENDERED="$TMP_DIR/logo.svg.png"

cp "$RENDERED" "$ROOT_DIR/assets/icon.png"
cp "$RENDERED" "$ROOT_DIR/assets/adaptive-icon.png"
cp "$RENDERED" "$ROOT_DIR/assets/splash-icon.png"

sips -z 512 512 "$RENDERED" --out "$ROOT_DIR/public/icon-512.png" >/dev/null
sips -z 192 192 "$RENDERED" --out "$ROOT_DIR/public/icon-192.png" >/dev/null
sips -z 48 48 "$RENDERED" --out "$ROOT_DIR/assets/favicon.png" >/dev/null
cp "$ROOT_DIR/assets/favicon.png" "$ROOT_DIR/public/favicon.png"

echo "Generated app and PWA logo assets from assets/logo.svg"
