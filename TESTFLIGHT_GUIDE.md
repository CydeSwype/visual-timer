# TestFlight Submission Guide

This guide walks you through submitting your MAS build to TestFlight for testing.

## Prerequisites

1. **Apple Developer Account** with Mac App Store access
2. **App Store Connect** access (https://appstoreconnect.apple.com)
3. **Transporter app** (download from Mac App Store: https://apps.apple.com/app/transporter/id1450874784)

## Step 1: Create App Record in App Store Connect (if needed)

1. Go to https://appstoreconnect.apple.com
2. Click **"My Apps"**
3. Click the **"+"** button to create a new app
4. Fill in:
   - **Platform**: macOS
   - **Name**: Visual Timer
   - **Primary Language**: English
   - **Bundle ID**: `com.iandmiller.visualtimer` (must match your app)
   - **SKU**: Any unique identifier (e.g., `visual-timer-001`)
5. Click **"Create"**

## Step 2: Prepare Your PKG File

Your PKG is already built and ready:
- **Location**: `dist/mas-universal/Visual Timer-1.6.2-universal.pkg`
- **Size**: ~199 MB
- **Version**: 1.6.2

## Step 3: Upload Using Transporter

### Option A: Using Transporter App (Recommended)

1. **Open Transporter** (download from Mac App Store if needed)
2. Click **"Deliver Your App"** or drag your PKG file into Transporter
3. Select: `dist/mas-universal/Visual Timer-1.6.2-universal.pkg`
4. Click **"Deliver"**
5. Sign in with your Apple ID (the one associated with your developer account)
6. Wait for upload to complete (may take 10-30 minutes for 199MB)

### Option B: Using Command Line (xcrun altool - deprecated but may work)

```bash
xcrun altool --upload-app \
  --type macos \
  --file "dist/mas-universal/Visual Timer-1.6.2-universal.pkg" \
  --username "your-apple-id@example.com" \
  --password "@keychain:Application Loader" \
  --asc-provider "4MSL3T2696"
```

Note: `altool` is deprecated. Use Transporter app instead.

## Step 4: Process in App Store Connect

After upload completes:

1. Go to **App Store Connect** → **My Apps** → **Visual Timer**
2. Go to **TestFlight** tab
3. Wait for processing (usually 10-30 minutes)
4. You'll see the build appear under **"macOS Builds"**

## Step 5: Set Up TestFlight Testing

1. In the **TestFlight** tab, click **"Internal Testing"** or **"External Testing"**
2. For **Internal Testing**:
   - Add yourself as an internal tester
   - Click **"Start Testing"**
3. For **External Testing**:
   - Create a test group
   - Add testers (up to 10,000)
   - Submit for Beta App Review (required for external testing)

## Step 6: Install and Test

1. Testers will receive an email invitation
2. They can install **TestFlight** from the Mac App Store
3. Open TestFlight and accept the invitation
4. Install and test your app

## Troubleshooting

### Upload Fails
- Check your Apple ID has App Store Connect access
- Verify your developer account is active
- Ensure PKG is properly signed (it is - we verified this)

### Build Processing Fails
- Check email notifications from App Store Connect
- Review build details for specific errors
- Common issues: missing entitlements, code signing problems

### App Won't Launch in TestFlight
- This is normal - MAS apps only run after App Store download
- TestFlight builds should work once downloaded through TestFlight

## Next Steps After Testing

Once TestFlight testing is successful:
1. Go to **App Store** tab in App Store Connect
2. Fill in app metadata, screenshots, description
3. Submit for App Review
4. Wait for approval (typically 1-3 days)

## Quick Command Reference

```bash
# Open the PKG location
open dist/mas-universal/

# Verify PKG signature
pkgutil --check-signature "dist/mas-universal/Visual Timer-1.6.2-universal.pkg"

# Check app bundle inside (if you extract it)
codesign -dv --verbose=4 "dist/mas-universal/Visual Timer.app"
```
