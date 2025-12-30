# How to Combine Developer ID and MAS Certificates into One P12

## Problem
Your current P12 only contains "Developer ID Application" certificates (for DMG/ZIP distribution).
MAS builds need "3rd Party Mac Developer Application" and "3rd Party Mac Developer Installer" certificates.

## Solution: Combine All Certificates into One P12

### Step 1: Export All Certificates from Keychain

1. Open **Keychain Access**
2. Search for certificates containing "Developer" or "Mac Developer"
3. You should see:
   - `Developer ID Application: Your Name (TeamID)`
   - `Developer ID Installer: Your Name (TeamID)` (if you have it)
   - `3rd Party Mac Developer Application: Your Name (TeamID)`
   - `3rd Party Mac Developer Installer: Your Name (TeamID)`

### Step 2: Export Each Certificate with Private Key

For EACH certificate:
1. Right-click the certificate
2. Select "Export [Certificate Name]"
3. Choose format: **Personal Information Exchange (.p12)**
4. Set a password (you'll need this)
5. Save to a temporary location

### Step 3: Combine into One P12

Run this command (adjust paths and passwords):

```bash
# Import all P12s into a temporary keychain
security create-keychain -p temp temp.keychain
security set-keychain-settings -u temp.keychain

# Import each P12 (replace paths and passwords)
security import ~/Downloads/developer-id-app.p12 -k temp.keychain -P "password1" -T /usr/bin/codesign
security import ~/Downloads/developer-id-installer.p12 -k temp.keychain -P "password2" -T /usr/bin/codesign
security import ~/Downloads/mas-app.p12 -k temp.keychain -P "password3" -T /usr/bin/codesign
security import ~/Downloads/mas-installer.p12 -k temp.keychain -P "password4" -T /usr/bin/codesign

# Export all certificates as one P12
security export -k temp.keychain -t identities -f pkcs12 -o combined.p12 -P "new-password"

# Clean up
security delete-keychain temp.keychain
```

### Step 4: Update GitHub Secret

```bash
base64 -i combined.p12 | pbcopy
```

Then update `MACOS_CERT_P12_BASE64` in GitHub Secrets with the new combined P12.

## Alternative: Use Separate P12 for MAS

If you prefer to keep them separate, you can:
1. Create a new secret `MAS_CERT_P12_BASE64` with just the MAS certificates
2. Update the workflow to use it for MAS builds

