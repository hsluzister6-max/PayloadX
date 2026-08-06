#!/usr/bin/env bash
# Print private updater key for GitHub Actions secret TAURI_PRIVATE_KEY
set -euo pipefail
KEY_FILE="$(dirname "$0")/../.tauri/payloadx-updater.key"
if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing $KEY_FILE — run: npm run updater:generate-keys" >&2
  exit 1
fi
echo "Paste everything below into GitHub secret TAURI_PRIVATE_KEY:"
echo "---"
cat "$KEY_FILE"
echo "---"
