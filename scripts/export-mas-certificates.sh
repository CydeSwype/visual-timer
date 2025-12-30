#!/bin/bash

# Script to export MAS certificates from keychain and combine into P12

set -e

echo "🔍 Finding MAS certificates..."
echo ""

# Find certificates (check both login and system keychains)
APP_CERT=$(security find-identity -v | grep "3rd Party Mac Developer Application" | head -1 | sed -n 's/.*"\(.*\)".*/\1/p')
INSTALLER_CERT=$(security find-identity -v | grep "3rd Party Mac Developer Installer" | head -1 | sed -n 's/.*"\(.*\)".*/\1/p')

if [ -z "$APP_CERT" ] || [ -z "$INSTALLER_CERT" ]; then
  echo "❌ Error: Could not find both certificates"
  echo ""
  echo "Application cert: ${APP_CERT:-NOT FOUND}"
  echo "Installer cert: ${INSTALLER_CERT:-NOT FOUND}"
  exit 1
fi

echo "✅ Found certificates:"
echo "   Application: $APP_CERT"
echo "   Installer: $INSTALLER_CERT"
echo ""

# Create temporary keychain for combining
TEMP_KEYCHAIN="temp-mas-export-$(date +%s).keychain"
TEMP_PASSWORD=$(openssl rand -base64 32)

echo "📦 Creating temporary keychain..."
security create-keychain -p "$TEMP_PASSWORD" "$TEMP_KEYCHAIN"
security set-keychain-settings -u "$TEMP_KEYCHAIN"
security unlock-keychain -p "$TEMP_PASSWORD" "$TEMP_KEYCHAIN"

# Export and import Application certificate
echo "Exporting Application certificate..."
APP_P12="/tmp/mas-app-$$.p12"
read -sp "Enter password for Application certificate export (or press Enter if no password): " APP_PASS
echo ""
security export -t identities -f pkcs12 -P "$APP_PASS" -o "$APP_P12" "$APP_CERT" 2>/dev/null || {
  # Try without password
  security export -t identities -f pkcs12 -P "" -o "$APP_P12" "$APP_CERT" 2>/dev/null || {
    echo "❌ Failed to export Application certificate"
    security delete-keychain "$TEMP_KEYCHAIN"
    exit 1
  }
}

security import "$APP_P12" -k "$TEMP_KEYCHAIN" -P "$APP_PASS" -T /usr/bin/codesign 2>/dev/null || \
security import "$APP_P12" -k "$TEMP_KEYCHAIN" -P "" -T /usr/bin/codesign 2>/dev/null

# Export and import Installer certificate
echo "Exporting Installer certificate..."
INSTALLER_P12="/tmp/mas-installer-$$.p12"
read -sp "Enter password for Installer certificate export (or press Enter if no password): " INSTALLER_PASS
echo ""
security export -t identities -f pkcs12 -P "$INSTALLER_PASS" -o "$INSTALLER_P12" "$INSTALLER_CERT" 2>/dev/null || {
  # Try without password
  security export -t identities -f pkcs12 -P "" -o "$INSTALLER_P12" "$INSTALLER_CERT" 2>/dev/null || {
    echo "❌ Failed to export Installer certificate"
    security delete-keychain "$TEMP_KEYCHAIN"
    rm -f "$APP_P12" "$INSTALLER_P12"
    exit 1
  }
}

security import "$INSTALLER_P12" -k "$TEMP_KEYCHAIN" -P "$INSTALLER_PASS" -T /usr/bin/codesign 2>/dev/null || \
security import "$INSTALLER_P12" -k "$TEMP_KEYCHAIN" -P "" -T /usr/bin/codesign 2>/dev/null

# Export combined P12
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

OUTPUT_FILE="mas-certificates.p12"
echo "Creating combined P12: $OUTPUT_FILE"
security export -k "$TEMP_KEYCHAIN" -t identities -f pkcs12 -P "$COMBINED_PASS" -o "$OUTPUT_FILE"

# Cleanup
security delete-keychain "$TEMP_KEYCHAIN"
rm -f "$APP_P12" "$INSTALLER_P12"

echo ""
echo "✅ Success! Created: $OUTPUT_FILE"
echo ""
echo "📋 Next steps:"
echo "1. Encode for GitHub Secrets:"
echo "   base64 -i $OUTPUT_FILE | pbcopy"
echo ""
echo "2. Add to GitHub Secrets:"
echo "   - MAS_CERT_P12_BASE64: (paste the base64)"
echo "   - MAS_CERT_P12_PASSWORD: $COMBINED_PASS"
echo ""
echo "3. The workflow will automatically use MAS_CERT_P12_BASE64 if it exists"

