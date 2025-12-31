#!/bin/bash

# Export MAS certificates directly from keychain and combine into one P12
# This is more reliable than using exported P12 files

set -e

echo "🔍 Finding MAS certificates in keychain..."
echo ""

# Find certificates
APP_CERT=$(security find-identity -v | grep "3rd Party Mac Developer Application" | head -1 | sed -n 's/.*"\(.*\)".*/\1/p')
INSTALLER_CERT=$(security find-identity -v | grep "3rd Party Mac Developer Installer" | head -1 | sed -n 's/.*"\(.*\)".*/\1/p')

if [ -z "$APP_CERT" ] || [ -z "$INSTALLER_CERT" ]; then
  echo "❌ Error: Could not find both certificates"
  echo "   Application: ${APP_CERT:-NOT FOUND}"
  echo "   Installer: ${INSTALLER_CERT:-NOT FOUND}"
  exit 1
fi

echo "✅ Found certificates:"
echo "   Application: $APP_CERT"
echo "   Installer: $INSTALLER_CERT"
echo ""

# Create temporary keychain
TEMP_KEYCHAIN="temp-mas-export-$(date +%s).keychain"
TEMP_PASS=$(openssl rand -base64 32)

echo "📦 Creating temporary keychain..."
security create-keychain -p "$TEMP_PASS" "$TEMP_KEYCHAIN"
security set-keychain-settings -u "$TEMP_KEYCHAIN"
security unlock-keychain -p "$TEMP_PASS" "$TEMP_KEYCHAIN"

# Export Application certificate
echo "Exporting Application certificate..."
APP_P12="/tmp/mas-app-$$.p12"
read -sp "Enter password for Application certificate export: " APP_PASS
echo ""
security export -t identities -f pkcs12 -P "$APP_PASS" -o "$APP_P12" "$APP_CERT" 2>&1 || {
  echo "❌ Failed to export Application certificate"
  security delete-keychain "$TEMP_KEYCHAIN"
  exit 1
}

security import "$APP_P12" -k "$TEMP_KEYCHAIN" -P "$APP_PASS" -T /usr/bin/codesign 2>&1

# Export Installer certificate
echo "Exporting Installer certificate..."
INSTALLER_P12="/tmp/mas-installer-$$.p12"
read -sp "Enter password for Installer certificate export: " INSTALLER_PASS
echo ""
security export -t identities -f pkcs12 -P "$INSTALLER_PASS" -o "$INSTALLER_P12" "$INSTALLER_CERT" 2>&1 || {
  echo "❌ Failed to export Installer certificate"
  security delete-keychain "$TEMP_KEYCHAIN"
  rm -f "$APP_P12"
  exit 1
}

security import "$INSTALLER_P12" -k "$TEMP_KEYCHAIN" -P "$INSTALLER_PASS" -T /usr/bin/codesign 2>&1

# Verify both are in the keychain
echo ""
echo "Verifying certificates in keychain..."
CERT_COUNT=$(security find-identity -v "$TEMP_KEYCHAIN" 2>&1 | grep -c "3rd Party Mac Developer" || echo "0")
if [ "$CERT_COUNT" -lt 2 ]; then
  echo "❌ Warning: Only found $CERT_COUNT MAS certificate(s) in keychain"
  security find-identity -v "$TEMP_KEYCHAIN" 2>&1
fi

# Export combined
echo ""
read -sp "Enter password for combined P12 file: " COMBINED_PASS
echo ""
read -sp "Confirm password: " COMBINED_PASS_CONFIRM
echo ""

if [ "$COMBINED_PASS" != "$COMBINED_PASS_CONFIRM" ]; then
  echo "❌ Passwords don't match!"
  security delete-keychain "$TEMP_KEYCHAIN"
  rm -f "$APP_P12" "$INSTALLER_P12"
  exit 1
fi

OUTPUT_FILE="mas-certificates-combined.p12"
echo ""
echo "📤 Exporting combined P12..."
security export -k "$TEMP_KEYCHAIN" -t identities -f pkcs12 -P "$COMBINED_PASS" -o "$OUTPUT_FILE" 2>&1

# Verify the output
echo ""
echo "Verifying combined P12..."
VERIFY_KEYCHAIN="verify-combined-$(date +%s).keychain"
security create-keychain -p "verify123" "$VERIFY_KEYCHAIN" 2>&1
security set-keychain-settings -u "$VERIFY_KEYCHAIN"
security unlock-keychain -p "verify123" "$VERIFY_KEYCHAIN"
security import "$OUTPUT_FILE" -k "$VERIFY_KEYCHAIN" -P "$COMBINED_PASS" -T /usr/bin/codesign 2>&1
FINAL_COUNT=$(security find-identity -v "$VERIFY_KEYCHAIN" 2>&1 | grep -c "3rd Party Mac Developer" || echo "0")
security delete-keychain "$VERIFY_KEYCHAIN" 2>/dev/null

if [ "$FINAL_COUNT" -lt 2 ]; then
  echo "❌ ERROR: Combined P12 only contains $FINAL_COUNT certificate(s), expected 2"
  security delete-keychain "$TEMP_KEYCHAIN"
  rm -f "$APP_P12" "$INSTALLER_P12" "$OUTPUT_FILE"
  exit 1
fi

# Cleanup
security delete-keychain "$TEMP_KEYCHAIN"
rm -f "$APP_P12" "$INSTALLER_P12"

echo ""
echo "✅ Success! Created: $OUTPUT_FILE with $FINAL_COUNT certificates"
echo ""
echo "📋 Next steps:"
echo "1. Encode for GitHub:"
echo "   base64 -i $OUTPUT_FILE | pbcopy"
echo ""
echo "2. Add to GitHub Secrets:"
echo "   - MAS_CERT_P12_BASE64: (paste the base64)"
echo "   - MAS_CERT_P12_PASSWORD: $COMBINED_PASS"

