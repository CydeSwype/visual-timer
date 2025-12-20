#!/usr/bin/env node

/**
 * Package script for browser extension
 * Copies necessary files to a dist/extension directory for packaging
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist/extension');
const srcDir = path.join(__dirname, '../src');
const extensionDir = path.join(__dirname, '../extension');

// Create dist directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy extension-specific files
const extensionFiles = ['manifest.json', 'background.js', 'popup.html', 'content.js'];
extensionFiles.forEach(file => {
  const src = path.join(extensionDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  }
});

// Copy shared source files
const sharedFiles = ['index.html', 'main.js', 'styles.css', 'ding.mp3'];
sharedFiles.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  }
});

// Copy assets directory
const assetsSrc = path.join(srcDir, 'assets');
const assetsDest = path.join(distDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  copyRecursiveSync(assetsSrc, assetsDest);
  console.log('Copied assets directory');
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('\n✅ Extension packaged successfully!');
console.log(`📦 Output directory: ${distDir}`);
console.log('\nTo load in Chrome:');
console.log('1. Open chrome://extensions/');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked"');
console.log(`4. Select: ${distDir}`);

