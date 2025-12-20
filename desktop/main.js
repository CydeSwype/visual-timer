const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Window state management
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  const statePath = getWindowStatePath();
  try {
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      const state = JSON.parse(data);
      
      // Validate that the saved position is still on a valid display
      if (state.x !== undefined && state.y !== undefined) {
        const displays = screen.getAllDisplays();
        const isPositionValid = displays.some(display => {
          return state.x >= display.bounds.x &&
                 state.x < display.bounds.x + display.bounds.width &&
                 state.y >= display.bounds.y &&
                 state.y < display.bounds.y + display.bounds.height;
        });
        
        if (isPositionValid) {
          return state;
        }
      }
    }
  } catch (error) {
    console.error('Error loading window state:', error);
  }
  
  // Return defaults if no valid state found
  return {
    width: 300,
    height: 100,
    x: undefined,
    y: undefined
  };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  const bounds = mainWindow.getBounds();
  const state = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
  
  try {
    const statePath = getWindowStatePath();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving window state:', error);
  }
}

function createWindow() {
  // Determine icon path based on platform
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets/icon.ico');
  } else if (process.platform === 'darwin') {
    // Use high-res icon for macOS
    const highResIcon = path.join(__dirname, 'assets/icon-1024.png');
    iconPath = fs.existsSync(highResIcon) ? highResIcon : path.join(__dirname, 'assets/icon.png');
  } else {
    iconPath = path.join(__dirname, 'assets/icon.png');
  }

  // Load saved window state
  const windowState = loadWindowState();

  // Create the browser window with saved state
  mainWindow = new BrowserWindow({
    width: windowState.width || 300,
    height: windowState.height || 100,
    x: windowState.x,
    y: windowState.y,
    minWidth: 200,
    minHeight: 100,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath,
    show: false // Don't show until ready to prevent flash
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  // Open DevTools in development (optional)
  // mainWindow.webContents.openDevTools();

  // Show window when ready to prevent positioning issues
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save window state on move
  mainWindow.on('moved', () => {
    saveWindowState();
  });

  // Save window state on resize (with debounce to avoid too many writes)
  let resizeTimeout;
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize();
    if (width < 200) mainWindow.setSize(200, height);
    if (height < 100) mainWindow.setSize(width, 100);
    
    // Debounce save to avoid excessive file writes
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      saveWindowState();
    }, 500);
  });

  // Save window state when window is closed
  mainWindow.on('closed', () => {
    saveWindowState();
    mainWindow = null;
  });
}

// Set app name for proper display in task switcher/dock
app.setName('Visual Timer');

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set app icon for macOS dock (needed for development mode)
  if (process.platform === 'darwin') {
    // Use high-res icon for better quality in dock
    const iconPath = path.join(__dirname, 'assets/icon-1024.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    } else {
      // Fallback to regular icon if high-res doesn't exist
      app.dock.setIcon(path.join(__dirname, 'assets/icon.png'));
    }
  }

  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Save window state before app quits
app.on('before-quit', () => {
  saveWindowState();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

