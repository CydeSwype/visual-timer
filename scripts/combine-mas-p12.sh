#!/bin/bash

# Combine the two MAS P12 files into one

set -e

TEMP_KEYCHAIN="temp-mas-$(date +%s).keychain"
TEMP_PASS=$(openssl rand -base64 32)

echo "🔐 Creating temporary keychain..."
security create-keychain -p "$TEMP_PASS" "$TEMP_KEYCHAIN"
security set-keychain-settings -u "$TEMP_KEYCHAIN"
security unlock-keychain -p "$TEMP_PASS" "$TEMP_KEYCHAIN"

# Import Application certificate
echo ""
echo "📦 Importing Application certificate (Certificates3rdparty.p12)..."
read -sp "Enter password for Certificates3rdparty.p12: " APP_PASS
echo ""
security import ~/Documents/Certificates3rdparty.p12 -k "$TEMP_KEYCHAIN" -P "$APP_PASS" -T /usr/bin/codesign

# Import Installer certificate  
echo ""
echo "📦 Importing Installer certificate (Certificatesinstaller.p12)..."
read -sp "Enter password for Certificatesinstaller.p12: " INSTALLER_PASS
echo ""
security import ~/Documents/Certificatesinstaller.p12 -k "$TEMP_KEYCHAIN" -P "$INSTALLER_PASS" -T /usr/bin/codesign

# Export combined
echo ""
read -sp "Enter password for combined P12 file: " COMBINED_PASS
echo ""
read -sp "Confirm password: " COMBINED_PASS_CONFIRM
echo ""

if [ "$COMBINED_PASS" != "$COMBINED_PASS_CONFIRM" ]; then
  echo "❌ Passwords don't match!"
  security delete-keychain "$TEMP_KEYCHAIN"
  exit 1
fi

OUTPUT_FILE="mas-certificates-combined.p12"
echo ""
echo "📤 Exporting combined P12..."
security export -k "$TEMP_KEYCHAIN" -t identities -f pkcs12 -P "$COMBINED_PASS" -o "$OUTPUT_FILE"

# Cleanup
security delete-keychain "$TEMP_KEYCHAIN"

echo ""
echo "✅ Success! Created: $OUTPUT_FILE"
echo ""
echo "📋 Next steps:"
echo "1. Encode for GitHub:"
echo "   base64 -i $OUTPUT_FILE | pbcopy"
echo ""
echo "2. Add to GitHub Secrets:"
echo "   - MAS_CERT_P12_BASE64: (paste the base64)"
echo "   - MAS_CERT_P12_PASSWORD: $COMBINED_PASS"

