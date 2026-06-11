#!/usr/bin/env bash
# Import Apple Developer ID Application .cer into login keychain (pairs with setup-local-signing.sh key).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="${ROOT}/certs"
KEY="${CERTS}/DeveloperID.key"

CER="${1:-}"
if [[ -z "$CER" || ! -f "$CER" ]]; then
  echo "Usage: bash scripts/import-developer-id-cert.sh /path/to/DeveloperIDApplication.cer"
  exit 1
fi

if [[ ! -f "$KEY" ]]; then
  echo "Missing private key. Run: bash scripts/setup-local-signing.sh"
  exit 1
fi

PEM="${CERTS}/DeveloperID.pem"
P12="${CERTS}/DeveloperID.p12"
P12_PASS="${DEVELOPER_ID_P12_PASSWORD:-payloadx-local}"

echo "Converting .cer to PEM..."
if openssl x509 -inform der -in "$CER" -out "$PEM" 2>/dev/null; then
  :
else
  openssl x509 -inform pem -in "$CER" -out "$PEM"
fi

echo "Creating .p12 bundle..."
openssl pkcs12 -export \
  -out "$P12" \
  -inkey "$KEY" \
  -in "$PEM" \
  -passout "pass:${P12_PASS}"

echo "Importing into login keychain..."
security import "$P12" \
  -k ~/Library/Keychains/login.keychain-db \
  -P "$P12_PASS" \
  -T /usr/bin/codesign \
  -T /usr/bin/security

echo ""
echo "Installed identities:"
security find-identity -v -p codesigning | grep 'Developer ID Application' || true
echo ""
echo "Done. Run: npm run tauri:build:mac-publish"
