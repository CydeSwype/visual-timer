#!/usr/bin/env node

/**
 * Post-build script to ensure MAS installer package is properly signed
 * as a distribution package with the installer certificate.
 * 
 * This runs after electron-builder creates the package to ensure it's
 * signed correctly for App Store submission.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.join(__dirname, '..', 'dist', 'mas-universal', 'Visual Timer-1.5.0-universal.pkg');

if (!fs.existsSync(pkgPath)) {
  console.error('❌ Package not found:', pkgPath);
  process.exit(1);
}

console.log('🔍 Checking package signature...');

try {
  // Check current signature
  const currentSig = execSync(`pkgutil --check-signature "${pkgPath}"`, { encoding: 'utf8' });
  console.log('Current signature:', currentSig.split('\n')[0]);
  
  // Re-sign with installer certificate as distribution
  const installerIdentity = '3rd Party Mac Developer Installer: Ian Miller (4MSL3T2696)';
  console.log(`\n🔐 Re-signing package with installer certificate: ${installerIdentity}`);
  
  // Use productsign to re-sign the package
  const tempPkg = pkgPath + '.tmp';
  execSync(`productsign --sign "${installerIdentity}" "${pkgPath}" "${tempPkg}"`, {
    stdio: 'inherit'
  });
  
  // Replace original with re-signed version
  fs.renameSync(tempPkg, pkgPath);
  
  console.log('✅ Package re-signed successfully');
  
  // Verify the new signature
  const newSig = execSync(`pkgutil --check-signature "${pkgPath}"`, { encoding: 'utf8' });
  console.log('\n📋 New signature:');
  console.log(newSig);
  
} catch (error) {
  console.error('❌ Failed to re-sign package:', error.message);
  process.exit(1);
}

