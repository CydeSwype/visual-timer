# Build Guide

Quick reference for building and running both versions of the timer app.

## Quick Start

### Install Dependencies
```bash
npm install
```

### Run Desktop App (Development)
```bash
npm start
```

### Package Browser Extension
```bash
npm run package:extension
```
Then load `dist/extension` in Chrome as an unpacked extension.

### Build Desktop App (Production)
```bash
npm run build:desktop
```

## Project Structure

- **`src/`** - Shared code used by both platforms
- **`extension/`** - Browser extension specific files (manifest, background script)
- **`desktop/`** - Electron desktop app files (main process, preload)
- **`dist/`** - Build output directory (created by build scripts)

## Development Workflow

1. Edit shared code in `src/` for changes that affect both platforms
2. Edit `extension/background.js` for extension-specific behavior
3. Edit `desktop/main.js` for desktop-specific behavior (window management, etc.)

## Notes

- Both platforms share the same core logic (`src/main.js`)
- localStorage works in both contexts
- Audio files and assets are shared
- Keyboard shortcuts work identically in both versions

