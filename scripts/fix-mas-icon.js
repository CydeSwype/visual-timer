#!/usr/bin/env node

/**
 * AfterSign hook for electron-builder to fix MAS icon
 * Replaces the ICNS file in the signed app bundle with our properly formatted one
 * that includes the 512pt @2x (1024x1024) image required by Apple.
 * 
 * This runs after the app is signed but before the installer package is created.
 * We replace the icon and re-sign to maintain a valid signature.
 * 
 * NOTE: Only runs for the final universal build to avoid breaking the universal build process.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
  // Only run for MAS builds
  if (context.targets && context.targets.some(t => t.name === 'mas')) {
    const appPath = context.appOutDir;
    const appBundlePath = path.join(appPath, 'Visual Timer.app');
    
    // Only process the final universal build (not intermediate arch-specific builds)
    // This prevents breaking the universal build process
    if (appPath.includes('mas-universal') && !appPath.includes('temp') && fs.existsSync(appBundlePath)) {
      const iconPath = path.join(appBundlePath, 'Contents', 'Resources', 'icon.icns');
      const sourceIconPath = path.join(__dirname, '..', 'desktop', 'assets', 'icon.icns');
      
      // Always re-sign with correct identifier to match provisioning profile
      // For MAS apps with provisioning profiles, the identifier must match the provisioning profile's application-identifier
      // which is TeamID.BundleID (e.g., 4MSL3T2696.com.iandmiller.visualtimer)
      const identity = '3rd Party Mac Developer Application: Ian Miller (4MSL3T2696)';
      const provisioningProfilePath = path.join(appBundlePath, 'Contents', 'embedded.provisionprofile');
      const entitlements = path.join(__dirname, '..', 'desktop', 'entitlements.mas.plist');
      
      // Check if provisioning profile exists and extract the application-identifier
      let appIdentifier = 'com.iandmiller.visualtimer'; // fallback to bundle ID
      if (fs.existsSync(provisioningProfilePath)) {
        try {
          const profileContent = execSync(`security cms -D -i "${provisioningProfilePath}"`, { encoding: 'utf8' });
          const match = profileContent.match(/<key>application-identifier<\/key>\s*<string>([^<]+)<\/string>/);
          if (match && match[1]) {
            appIdentifier = match[1];
            console.log(`Found application-identifier in provisioning profile: ${appIdentifier}`);
          }
        } catch (e) {
          console.warn('Could not read provisioning profile, using bundle ID');
        }
      }
      
      // Handle icon replacement if needed
      if (fs.existsSync(iconPath) && fs.existsSync(sourceIconPath)) {
        const currentStats = fs.statSync(iconPath);
        const sourceStats = fs.statSync(sourceIconPath);
        
        if (currentStats.size < sourceStats.size * 0.8) {
          console.log('Replacing ICNS file (electron-builder converted it to older format)...');
          fs.copyFileSync(sourceIconPath, iconPath);
          console.log('✅ ICNS file replaced successfully');
        } else {
          console.log('✅ ICNS file is already correct (not converted by electron-builder)');
        }
      } else {
        console.warn('⚠️  Could not find icon files:', { iconPath, sourceIconPath, appBundlePath });
      }
      
      // Always re-sign with the correct identifier (matches provisioning profile)
      try {
        console.log(`Re-signing app bundle with identifier: ${appIdentifier}...`);
        execSync(`codesign --force --deep --sign "${identity}" --identifier "${appIdentifier}" --entitlements "${entitlements}" --options runtime "${appBundlePath}"`, {
          stdio: 'inherit'
        });
        console.log('✅ App bundle re-signed successfully');
      } catch (error) {
        console.error('❌ Failed to re-sign app bundle:', error.message);
        throw error;
      }
    }
  }
};

