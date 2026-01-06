#!/bin/bash

# Script to help upload MAS build to TestFlight
# This opens Transporter with your PKG file ready to upload

PKG_PATH="dist/mas-universal/Visual Timer-1.6.2-universal.pkg"

if [ ! -f "$PKG_PATH" ]; then
    echo "❌ Error: PKG file not found at $PKG_PATH"
    echo "Please build the MAS package first: npm run build:desktop:mas"
    exit 1
fi

echo "✅ Found PKG: $PKG_PATH"
echo ""
echo "📦 Package Details:"
pkgutil --check-signature "$PKG_PATH" | head -5
echo ""
echo "🚀 Opening Transporter..."
echo ""
echo "Instructions:"
echo "1. Sign in with your Apple ID (associated with developer account)"
echo "2. Click 'Deliver Your App' or drag the PKG into Transporter"
echo "3. Wait for upload to complete (10-30 minutes for ~199MB)"
echo "4. Check App Store Connect → TestFlight tab for processing status"
echo ""

# Open Transporter
open -a Transporter

# Also open the folder containing the PKG
open "dist/mas-universal"

echo "✅ Transporter opened. Drag the PKG file into it to start upload."
