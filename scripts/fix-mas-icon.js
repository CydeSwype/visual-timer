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
      
      // First, discover the signing identity BEFORE modifying anything
      // Get it from the already-signed app bundle (electron-builder signed it)
      let identity;
      try {
        const signInfo = execSync(`codesign -dv --verbose=4 "${appBundlePath}" 2>&1`, { encoding: 'utf8' });
        // Extract the Authority line which contains the certificate name
        const authorityMatch = signInfo.match(/Authority=([^\n]+)/);
        if (authorityMatch && authorityMatch[1].includes('3rd Party Mac Developer Application')) {
          identity = authorityMatch[1].trim();
          console.log(`Found signing identity from app bundle: ${identity}`);
        } else {
          // Fallback: try to find it in keychain
          console.log('Could not extract identity from app bundle, trying keychain...');
          const identities = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
          const masAppMatch = identities.match(/"3rd Party Mac Developer Application: ([^"]+)"/);
          if (masAppMatch) {
            identity = `3rd Party Mac Developer Application: ${masAppMatch[1]}`;
            console.log(`Found MAS certificate in keychain: ${identity}`);
          } else {
            throw new Error('Could not find MAS certificate');
          }
        }
      } catch (e) {
        console.error('Failed to discover signing identity:', e.message);
        console.warn('⚠️  Cannot re-sign app - skipping icon replacement to preserve signature');
        console.warn('⚠️  The icon may be in an older format, but the app signature is valid');
        return; // Exit early - don't modify the app if we can't re-sign
      }
      
      // Now check if icon needs replacing
      let iconReplaced = false;
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
      
      // Only re-sign if we actually replaced the icon
      if (iconReplaced) {
        const entitlements = path.join(__dirname, '..', 'desktop', 'entitlements.mas.plist');
        
        try {
          console.log('Re-signing app bundle after icon replacement...');
          execSync(`codesign --force --deep --sign "${identity}" --entitlements "${entitlements}" --options runtime "${appBundlePath}"`, {
            stdio: 'inherit'
          });
          console.log('✅ App bundle re-signed successfully');
        } catch (error) {
          console.error('❌ Failed to re-sign app bundle:', error.message);
          throw error; // This is critical - if we replaced the icon, we MUST re-sign
        }
      }
    }
  }
};

