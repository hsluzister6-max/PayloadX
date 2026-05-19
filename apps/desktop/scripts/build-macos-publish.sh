#!/usr/bin/env bash
# Build a Gatekeeper-friendly, notarized PayloadX .dmg for distribution.
#
# Prerequisites:
#   - Xcode CLI tools (xcrun notarytool, stapler, codesign)
#   - Apple Developer "Developer ID Application" cert in Keychain (matches tauri.conf.json)
#   - Env vars (do NOT commit; use export or a local file sourced by you):
#       APPLE_ID         — Apple ID email
#       APPLE_PASSWORD   — App-specific password (appleid.apple.com), NOT your Apple ID login password
#       APPLE_TEAM_ID    — 10-character team ID (e.g. from developer.apple.com)
#
# Usage (from repo root or apps/desktop):
#   export APPLE_ID="you@example.com"
#   export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
#   export APPLE_TEAM_ID="XXXXXXXXXX"
#   bash apps/desktop/scripts/build-macos-publish.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${APPLE_ID:?Set APPLE_ID (Apple ID email)}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD (app-specific password from appleid.apple.com)}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID}"

command -v xcrun >/dev/null || { echo "Install Xcode CLI tools: xcode-select --install"; exit 1; }

if ! security find-identity -v -p codesigning 2>/dev/null | grep -q 'Developer ID Application'; then
  echo "No Developer ID Application certificate found in your login keychain."
  echo "Apple Development certs cannot produce a Gatekeeper-ready publishable build."
  echo "Create & install one: https://developer.apple.com/account/resources/certificates/list"
  echo "(Certificate type: Developer ID Application → export .p12 into Keychain on this Mac)"
  exit 1
fi

echo "==> vite build"
npm run build

echo "==> tauri: release .app (signed, hardened runtime)"
npm run tauri -- build -b app --ci

APP="${ROOT}/src-tauri/target/release/bundle/macos/PayloadX.app"
if [[ ! -d "$APP" ]]; then
  echo "Missing bundle: $APP"
  exit 1
fi

echo "==> create .dmg (UDZO)"
bash "${ROOT}/scripts/make-dmg.sh"

CONF="${ROOT}/src-tauri/tauri.conf.json"
VERSION="$(grep -m1 '"version"' "$CONF" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
  arm64) ARCH="aarch64" ;;
  x86_64) ARCH="x86_64" ;;
  *) ARCH="$ARCH_RAW" ;;
esac
DMG="${ROOT}/src-tauri/target/release/bundle/dmg/PayloadX_${VERSION}_${ARCH}.dmg"

if [[ ! -f "$DMG" ]]; then
  echo "Missing DMG: $DMG"
  exit 1
fi

echo "==> notarize DMG (notarytool --wait)"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "==> staple ticket to DMG"
xcrun stapler staple "$DMG"

echo "==> verify staple"
xcrun stapler validate "$DMG" || true

echo "Done. Publishable artifact:"
echo "  $DMG"
