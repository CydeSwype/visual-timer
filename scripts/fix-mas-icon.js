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
      
      // Discover the MAS certificate identity dynamically
      let identity;
      let iconReplaced = false;
      
      try {
        // Find the "3rd Party Mac Developer Application" certificate
        const identities = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
        // Match the full certificate name including team ID
        const masAppMatch = identities.match(/"3rd Party Mac Developer Application: ([^"]+)"/);
        if (masAppMatch) {
          identity = `3rd Party Mac Developer Application: ${masAppMatch[1]}`;
          console.log(`Found MAS certificate: ${identity}`);
        } else {
          throw new Error('Could not find MAS certificate in keychain');
        }
      } catch (e) {
        console.error('Failed to discover MAS certificate identity:', e.message);
        throw new Error('Could not find "3rd Party Mac Developer Application" certificate in keychain');
      }
      
      const entitlements = path.join(__dirname, '..', 'desktop', 'entitlements.mas.plist');
      
      // Handle icon replacement if needed
      if (fs.existsSync(iconPath) && fs.existsSync(sourceIconPath)) {
        const currentStats = fs.statSync(iconPath);
        const sourceStats = fs.statSync(sourceIconPath);
        
        if (currentStats.size < sourceStats.size * 0.8) {
          console.log('Replacing ICNS file (electron-builder converted it to older format)...');
          fs.copyFileSync(sourceIconPath, iconPath);
          console.log('✅ ICNS file replaced successfully');
          iconReplaced = true;
        } else {
          console.log('✅ ICNS file is already correct (not converted by electron-builder)');
        }
      } else {
        console.warn('⚠️  Could not find icon files:', { iconPath, sourceIconPath, appBundlePath });
      }
      
      // Only re-sign if we replaced the icon (to maintain valid signature)
      // Note: For MAS, codesign will use the bundle ID from Info.plist automatically
      if (iconReplaced) {
        try {
          console.log('Re-signing app bundle after icon replacement...');
          execSync(`codesign --force --deep --sign "${identity}" --entitlements "${entitlements}" --options runtime "${appBundlePath}"`, {
            stdio: 'inherit'
          });
          console.log('✅ App bundle re-signed successfully');
        } catch (error) {
          console.error('❌ Failed to re-sign app bundle:', error.message);
          throw error;
        }
      }
    }
  }
};

