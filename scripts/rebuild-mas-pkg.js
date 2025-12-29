#!/usr/bin/env node

/**
 * Rebuilds the MAS installer package using productbuild to ensure
 * it's created as a proper distribution package for App Store submission.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appPath = path.join(__dirname, '..', 'dist', 'mas-universal', 'Visual Timer.app');
const pkgPath = path.join(__dirname, '..', 'dist', 'mas-universal', 'Visual Timer-1.5.0-universal.pkg');
const tempPkgPath = pkgPath + '.new';

if (!fs.existsSync(appPath)) {
  console.error('❌ App bundle not found:', appPath);
  process.exit(1);
}

console.log('🔨 Re-signing app bundle with correct identifier...');

try {
  const appIdentity = '3rd Party Mac Developer Application: Ian Miller (4MSL3T2696)';
  const entitlements = path.join(__dirname, '..', 'desktop', 'entitlements.mas.plist');
  const provisioningProfile = path.join(appPath, 'Contents', 'embedded.provisionprofile');
  
  // Re-sign the app bundle - identifier must match Bundle Identifier (not team-prefixed)
  // For MAS, the code signature identifier should be just the bundle ID
  const bundleIdentifier = 'com.iandmiller.visualtimer';
  
  if (fs.existsSync(provisioningProfile)) {
    console.log('Re-signing app with provisioning profile...');
    // Don't use --identifier flag - let codesign use the bundle ID from Info.plist
    // The provisioning profile will be embedded and codesign will handle it correctly
    execSync(
      `codesign --force --deep --sign "${appIdentity}" --entitlements "${entitlements}" --options runtime "${appPath}"`,
      { stdio: 'inherit' }
    );
    console.log('✅ App bundle re-signed with identifier:', bundleIdentifier);
  } else {
    console.warn('⚠️  Provisioning profile not found, signing without it...');
    execSync(
      `codesign --force --deep --sign "${appIdentity}" --entitlements "${entitlements}" --options runtime "${appPath}"`,
      { stdio: 'inherit' }
    );
  }
  
  // Verify the app signature
  console.log('\n📋 App bundle signature:');
  const appSig = execSync(`codesign -dv --verbose=4 "${appPath}" 2>&1 | grep -E "Identifier|Authority|TeamIdentifier"`, { encoding: 'utf8' });
  console.log(appSig);
  
  console.log('\n🔨 Rebuilding package using productbuild for distribution...');
  
  const installerIdentity = '3rd Party Mac Developer Installer: Ian Miller (4MSL3T2696)';
  
  // Use productbuild to create a proper distribution package
  // --component places the app in /Applications
  // --sign signs it with the installer certificate
  execSync(
    `productbuild --component "${appPath}" /Applications --sign "${installerIdentity}" "${tempPkgPath}"`,
    { stdio: 'inherit' }
  );
  
  // Replace the old package
  if (fs.existsSync(pkgPath)) {
    fs.unlinkSync(pkgPath);
  }
  fs.renameSync(tempPkgPath, pkgPath);
  
  console.log('✅ Package rebuilt successfully');
  
  // Verify signature
  const sig = execSync(`pkgutil --check-signature "${pkgPath}"`, { encoding: 'utf8' });
  console.log('\n📋 Package signature:');
  console.log(sig);
  
} catch (error) {
  console.error('❌ Failed to rebuild package:', error.message);
  if (fs.existsSync(tempPkgPath)) {
    fs.unlinkSync(tempPkgPath);
  }
  process.exit(1);
}

