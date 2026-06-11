#!/usr/bin/env bash
# Generate a local CSR for Apple "Developer ID Application" (no fastlane).
# Upload the .csr at: https://developer.apple.com/account/resources/certificates/add
# Choose: Developer ID Application → upload CSR → download .cer
# Then run: bash scripts/import-developer-id-cert.sh path/to/DeveloperIDApplication.cer
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="${ROOT}/certs"
mkdir -p "$CERTS"

KEY="${CERTS}/DeveloperID.key"
CSR="${CERTS}/DeveloperID.csr"

if [[ -f "$KEY" ]]; then
  echo "Private key already exists: $KEY"
else
  echo "Generating 2048-bit RSA key..."
  openssl genrsa -out "$KEY" 2048
  chmod 600 "$KEY"
fi

if [[ -f "$CSR" ]]; then
  echo "CSR already exists: $CSR"
else
  echo "Generating certificate signing request..."
  openssl req -new -key "$KEY" -out "$CSR" \
    -subj "/emailAddress=${APPLE_ID:-prabh@psquarecompany.com}/CN=PSQUARE COMPANY/O=PSQUARE COMPANY/C=US"
fi

echo ""
echo "Local signing files:"
echo "  Key: $KEY"
echo "  CSR: $CSR"
echo ""
echo "Next steps:"
echo "  1. Open https://developer.apple.com/account/resources/certificates/add"
echo "  2. Select: Developer ID Application"
echo "  3. Upload: $CSR"
echo "  4. Download the .cer file"
echo "  5. Run: bash scripts/import-developer-id-cert.sh ~/Downloads/DeveloperIDApplication.cer"
