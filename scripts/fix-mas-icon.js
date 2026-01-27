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
      
      // Always re-sign to ensure entitlements are properly applied to all components
      // This is critical for MAS builds where helpers need inherit entitlements
      {
        const entitlements = path.join(__dirname, '..', 'desktop', 'entitlements.mas.plist');
        const entitlementsInherit = path.join(__dirname, '..', 'desktop', 'entitlements.mas.inherit.plist');
        const frameworksPath = path.join(appBundlePath, 'Contents', 'Frameworks');
        const helpersPath = path.join(appBundlePath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Helpers');
        
        try {
          console.log('Re-signing app bundle after icon replacement...');
          
          // Collect all helper apps first (we need to sign deepest first)
          const helperApps = [];
          const findHelpers = (dir, basePath = '') => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
              const itemPath = path.join(dir, item);
              try {
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory() && item.endsWith('.app') && item.includes('Helper')) {
                  helperApps.push(itemPath);
                } else if (stat.isDirectory() && !item.includes('.framework') && !item.endsWith('.app')) {
                  // Recursively search subdirectories (but skip .framework bundles and .app bundles)
                  findHelpers(itemPath);
                }
              } catch (e) {
                // Skip if we can't read the item
              }
            }
          };
          
          // Find all helper apps
          const contentsPath = path.join(appBundlePath, 'Contents');
          if (fs.existsSync(contentsPath)) {
            findHelpers(contentsPath);
          }
          
          // Sign helpers inside Electron Framework first (deepest level)
          if (fs.existsSync(helpersPath)) {
            const helpers = fs.readdirSync(helpersPath);
            for (const helper of helpers) {
              const helperPath = path.join(helpersPath, helper);
              if (fs.statSync(helperPath).isFile() && !helper.endsWith('.plist')) {
                try {
                  // Don't use --options runtime for MAS builds
                  execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsInherit}" "${helperPath}"`, {
                    stdio: 'inherit'
                  });
                  console.log(`✅ Re-signed helper: ${helper}`);
                } catch (e) {
                  console.warn(`⚠️  Could not re-sign helper ${helper}: ${e.message}`);
                }
              }
            }
          }
          
          // Sign all helper .app bundles (in reverse depth order - deepest first)
          helperApps.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
          for (const helperApp of helperApps) {
            try {
              // Sign the helper app (no --options runtime for MAS builds)
              execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsInherit}" "${helperApp}"`, {
                stdio: 'inherit'
              });
              
              // Verify the signature was applied
              try {
                execSync(`codesign -v "${helperApp}"`, { stdio: 'pipe' });
                console.log(`✅ Re-signed and verified helper app: ${helperApp.replace(appBundlePath, '')}`);
              } catch (verifyError) {
                console.warn(`⚠️  Helper app signed but verification failed: ${helperApp.replace(appBundlePath, '')}`);
              }
            } catch (e) {
              console.warn(`⚠️  Could not re-sign helper app ${helperApp}: ${e.message}`);
            }
          }
          
          // Sign Electron Framework - must sign the executable inside the framework
          const electronFrameworkPath = path.join(frameworksPath, 'Electron Framework.framework');
          const electronFrameworkExecutable = path.join(electronFrameworkPath, 'Versions', 'A', 'Electron Framework');
          if (fs.existsSync(electronFrameworkExecutable)) {
            // Sign the executable inside the framework first (no --options runtime for MAS)
            execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsInherit}" "${electronFrameworkExecutable}"`, {
              stdio: 'inherit'
            });
            // Then sign the framework bundle
            execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsInherit}" "${electronFrameworkPath}"`, {
              stdio: 'inherit'
            });
            console.log('✅ Re-signed Electron Framework (executable and bundle)');
          } else if (fs.existsSync(electronFrameworkPath)) {
            // Fallback: sign the framework bundle if executable path doesn't exist
            execSync(`codesign --force --sign "${identity}" --entitlements "${entitlementsInherit}" "${electronFrameworkPath}"`, {
              stdio: 'inherit'
            });
            console.log('✅ Re-signed Electron Framework (bundle only)');
          }
          
          // Check for provisioning profile to determine main app signing strategy
          const hasProvisioningProfile = fs.existsSync(path.join(appBundlePath, 'Contents', 'embedded.provisionprofile'));
          
          // Sign main app bundle last (no --options runtime for MAS builds)
          if (hasProvisioningProfile) {
            console.log('Provisioning profile found. Signing WITHOUT --entitlements flag to avoid team-identifier error...');
            execSync(`codesign --force --sign "${identity}" "${appBundlePath}"`, {
              stdio: 'inherit'
            });
          } else {
            execSync(`codesign --force --sign "${identity}" --entitlements "${entitlements}" "${appBundlePath}"`, {
              stdio: 'inherit'
            });
          }
          console.log('✅ App bundle re-signed successfully');
        } catch (error) {
          console.error('❌ Failed to re-sign app bundle:', error.message);
          if (iconReplaced) {
            throw error; // This is critical - if we replaced the icon, we MUST re-sign
          } else {
            console.warn('⚠️  Re-signing failed but icon was not replaced, continuing...');
          }
        }
      }
    }
  }
};

