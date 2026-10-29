const { app, BrowserWindow, session, shell, ipcMain } = require('electron');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const isDev = !app.isPackaged;
const appEntryPath = path.resolve(__dirname, '..', 'dist', 'index.html');
app.setName('DY Board');
let mainWindow = null;

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    if (isDev) {
      return (
        !url.username &&
        !url.password &&
        (url.origin === 'http://localhost:3000' || url.origin === 'http://127.0.0.1:3000')
      );
    }
    return (
      url.protocol === 'file:' &&
      !url.search &&
      !url.hash &&
      path.resolve(fileURLToPath(url)) === appEntryPath
    );
  } catch {
    return false;
  }
}

ipcMain.handle('dyboard:quit', (event) => {
  const window = mainWindow;
  const frame = event.senderFrame;
  if (!window || event.sender !== window.webContents || frame !== window.webContents.mainFrame)
    return false;
  if (!isTrustedAppUrl(frame.url)) return false;
  app.quit();
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 920,
    minHeight: 640,
    show: false,
    backgroundColor: '#000000',
    fullscreen: true,
    autoHideMenuBar: true,
    title: 'DY Board',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
  if (isDev) void win.loadURL('http://localhost:3000');
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => permission === 'media',
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
