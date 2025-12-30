#!/bin/bash

# Helper script to create a P12 file containing MAS certificates
# This exports "3rd Party Mac Developer Application" and "3rd Party Mac Developer Installer" certificates

echo "🔍 Finding MAS certificates in your keychain..."
echo ""

# Find MAS certificates
mas_app=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application" | head -1)
mas_installer=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Installer" | head -1)

if [ -z "$mas_app" ] || [ -z "$mas_installer" ]; then
  echo "❌ Error: Could not find both MAS certificates in keychain"
  echo ""
  echo "Found certificates:"
  security find-identity -v -p codesigning | grep -i "developer"
  echo ""
  echo "Please ensure you have:"
  echo "  - 3rd Party Mac Developer Application: [Your Name] (TeamID)"
  echo "  - 3rd Party Mac Developer Installer: [Your Name] (TeamID)"
  exit 1
fi

echo "✅ Found MAS certificates:"
echo "   $mas_app"
echo "   $mas_installer"
echo ""

# Extract certificate names
app_name=$(echo "$mas_app" | sed -n 's/.*"\(.*\)".*/\1/p')
installer_name=$(echo "$mas_installer" | sed -n 's/.*"\(.*\)".*/\1/p')

echo "📦 Creating combined P12 file..."
echo ""

# Create temporary keychain
temp_keychain="temp-mas-$(date +%s).keychain"
temp_password=$(openssl rand -base64 32)

security create-keychain -p "$temp_password" "$temp_keychain"
security set-keychain-settings -u "$temp_keychain"
security unlock-keychain -p "$temp_password" "$temp_keychain"

# Export certificates to temp keychain
echo "Exporting certificates..."
security export -k login.keychain -t identities -f pkcs12 -P "" -o /tmp/mas-app.p12 "$app_name" 2>/dev/null
security export -k login.keychain -t identities -f pkcs12 -P "" -o /tmp/mas-installer.p12 "$installer_name" 2>/dev/null

# Import into temp keychain
security import /tmp/mas-app.p12 -k "$temp_keychain" -P "" -T /usr/bin/codesign 2>/dev/null
security import /tmp/mas-installer.p12 -k "$temp_keychain" -P "" -T /usr/bin/codesign 2>/dev/null

# Export combined
read -sp "Enter password for new P12 file: " p12_password
echo ""
read -sp "Confirm password: " p12_password_confirm
echo ""

if [ "$p12_password" != "$p12_password_confirm" ]; then
  echo "❌ Passwords don't match!"
  security delete-keychain "$temp_keychain"
  rm -f /tmp/mas-*.p12
  exit 1
fi

output_file="mas-certificates.p12"
security export -k "$temp_keychain" -t identities -f pkcs12 -P "$p12_password" -o "$output_file"

# Cleanup
security delete-keychain "$temp_keychain"
rm -f /tmp/mas-*.p12

echo ""
echo "✅ Created: $output_file"
echo ""
echo "To encode for GitHub Secrets:"
echo "  base64 -i $output_file | pbcopy"
echo ""
echo "Then add it as: MAS_CERT_P12_BASE64"
echo "And the password as: MAS_CERT_P12_PASSWORD"

