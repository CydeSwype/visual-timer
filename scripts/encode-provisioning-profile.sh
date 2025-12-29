#!/bin/bash

# Helper script to encode a provisioning profile for GitHub Secrets

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-provisioning-profile>"
  echo ""
  echo "Example:"
  echo "  $0 ~/Downloads/Visual_Timer_Mac_App_Store.provisionprofile"
  echo ""
  echo "This will output the base64-encoded profile that you can paste into GitHub Secrets."
  exit 1
fi

PROFILE_PATH="$1"

if [ ! -f "$PROFILE_PATH" ]; then
  echo "Error: File not found: $PROFILE_PATH"
  exit 1
fi

echo "Encoding provisioning profile: $PROFILE_PATH"
echo ""
echo "Base64 encoded value (copy this to GitHub Secrets as MAS_PROVISIONING_PROFILE_BASE64):"
echo "---"
base64 -i "$PROFILE_PATH"
echo ""
echo "---"
echo ""
echo "✅ Done! Copy the base64 string above and paste it into GitHub Secrets."
echo ""
echo "To copy to clipboard automatically, run:"
echo "  base64 -i \"$PROFILE_PATH\" | pbcopy"

