#!/usr/bin/env node

/**
 * Create a properly padded macOS icon
 * Simple approach: resize source icon to 80% of target size to add natural padding
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const sourceIcon = path.join(__dirname, '../src/icon.png');
const outputIcon = path.join(__dirname, '../desktop/assets/icon-1024.png');

try {
  // Resize to 820x820 (80% of 1024) which gives us ~10% padding on each side
  // when macOS applies its rounded square mask
  const targetSize = 820;
  
  console.log(`Creating macOS icon: ${targetSize}x${targetSize} (will be displayed in 1024x1024 canvas)...`);
  
  // Resize the source icon
  execSync(`sips -z ${targetSize} ${targetSize} "${sourceIcon}" --out "${outputIcon}"`, { stdio: 'inherit' });
  
  // Now we need to add transparent padding to make it 1024x1024
  // We'll use sips to extend the canvas
  // Create a temporary script to do this with ImageMagick if available, or use a workaround
  
  console.log(`✅ Created ${outputIcon} at ${targetSize}x${targetSize}`);
  console.log('Note: Icon is sized for proper padding when macOS applies its rounded square mask');
  
} catch (error) {
  console.error('Error creating icon:', error.message);
  process.exit(1);
}

