const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('boardDesktop', Object.freeze({
  platform: process.platform,
  version: process.versions.electron
}));
