// Preload script runs in a context that has access to both DOM and Node.js APIs
// This file exposes safe APIs to the renderer process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  isElectron: true
});

