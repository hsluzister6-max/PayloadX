#!/usr/bin/env bash
# Create a plain UDZO .dmg from the signed PayloadX.app (avoids Tauri bundle_dmg.sh / Finder AppleScript).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/src-tauri/target/release/bundle/macos/PayloadX.app"
CONF="${ROOT}/src-tauri/tauri.conf.json"

if [[ ! -d "$APP" ]]; then
  echo "Missing app bundle: $APP"
  echo "Run: npm run tauri:build:app"
  exit 1
fi

VERSION="$(grep -m1 '"version"' "$CONF" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
  arm64) ARCH="aarch64" ;;
  x86_64) ARCH="x86_64" ;;
  *) ARCH="$ARCH_RAW" ;;
esac
OUTDIR="${ROOT}/src-tauri/target/release/bundle/dmg"
mkdir -p "$OUTDIR"
DMG="${OUTDIR}/PayloadX_${VERSION}_${ARCH}.dmg"

rm -f "$DMG"
echo "Creating $DMG from $APP ..."
hdiutil create -volname "PayloadX" -srcfolder "$APP" -ov -format UDZO -imagekey zlib-level=9 "$DMG"
echo "Done: $DMG"
