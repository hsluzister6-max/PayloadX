#!/usr/bin/env bash
# Generate minisign keypair for Tauri OTA updates.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .tauri
npx tauri signer generate -w ".tauri/payloadx-updater.key" "$@"

echo ""
echo "Next steps:"
echo "  1. Copy .tauri/payloadx-updater.key.pub into src-tauri/tauri.conf.json → tauri.updater.pubkey"
echo "  2. Add private key to GitHub secret TAURI_PRIVATE_KEY (run: npm run updater:print-private-key)"
echo "  3. Add key password to GitHub secret TAURI_KEY_PASSWORD"
echo "See UPDATER_SETUP.md for full instructions."
