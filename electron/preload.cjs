const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'boardDesktop',
  Object.freeze({
    platform: process.platform,
    version: process.versions.electron,
    quit: () => ipcRenderer.invoke('dyboard:quit'),
  }),
);
