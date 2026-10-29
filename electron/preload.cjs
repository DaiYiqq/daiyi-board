const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, listener) => {
  if (typeof listener !== 'function') return () => undefined;
  const handler = (_event, snapshot) => listener(snapshot);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld(
  'boardDesktop',
  Object.freeze({
    platform: process.platform,
    version: process.versions.electron,
    quit: () => ipcRenderer.invoke('dyboard:quit'),
    getUpdateState: () => ipcRenderer.invoke('dyboard:update:get-state'),
    checkForUpdates: () => ipcRenderer.invoke('dyboard:update:check'),
    downloadUpdate: () => ipcRenderer.invoke('dyboard:update:download'),
    installUpdate: () => ipcRenderer.invoke('dyboard:update:install'),
    openReleasePage: () => ipcRenderer.invoke('dyboard:update:release-page'),
    subscribeUpdateState: (listener) => subscribe('dyboard:update-state', listener),
  }),
);
