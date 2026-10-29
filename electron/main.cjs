const { app, BrowserWindow, session, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const isDev = !app.isPackaged;
const appEntryPath = path.resolve(__dirname, '..', 'dist', 'index.html');
const releaseUrl = 'https://github.com/DaiYiqq/daiyi-board/releases/latest';
app.setName('DY Board');
let mainWindow = null;
let autoUpdater = null;
let updateSnapshot = { source: 'desktop', status: 'idle' };

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

function isTrustedIpcEvent(event) {
  const window = mainWindow;
  const frame = event.senderFrame;
  return Boolean(
    window &&
      !window.isDestroyed() &&
      event.sender === window.webContents &&
      frame === window.webContents.mainFrame &&
      isTrustedAppUrl(frame.url),
  );
}

function publishUpdateState(status, details = {}) {
  const retained =
    status === 'downloading' || status === 'downloaded'
      ? { version: updateSnapshot.version, action: updateSnapshot.action }
      : {};
  updateSnapshot = { source: 'desktop', status, ...retained, ...details };
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send('dyboard:update-state', updateSnapshot);
}

async function checkForUpdates() {
  if (!autoUpdater) {
    if (!app.isPackaged)
      publishUpdateState('unsupported', { message: '开发版本暂不支持在线更新检查。' });
    return false;
  }
  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch {
    publishUpdateState('error', { message: '暂时无法连接 GitHub Releases，请检查网络后重试。' });
    return false;
  }
}

function isPackagedLinuxDeb() {
  if (process.platform !== 'linux' || process.env.APPIMAGE) return false;
  try {
    return fs.readFileSync(path.join(process.resourcesPath, 'package-type'), 'utf8').trim() === 'deb';
  } catch {
    return false;
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  if (process.platform === 'linux' && !process.env.APPIMAGE && !isPackagedLinuxDeb()) {
    updateSnapshot = {
      source: 'desktop',
      status: 'unsupported',
      action: 'release',
      message: '此 Linux 安装包无法检查更新，请从 GitHub Release 手动检查。',
    };
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    updateSnapshot = {
      source: 'desktop',
      status: 'unsupported',
      message: '更新组件不可用，请从 GitHub Release 手动检查。',
    };
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('checking-for-update', () => publishUpdateState('checking'));
  autoUpdater.on('update-available', (info) => {
    const isDebianInstall = process.platform === 'linux' && !process.env.APPIMAGE;
    const manualOnly = process.platform === 'darwin' || isDebianInstall;
    publishUpdateState('available', {
      version: info?.version,
      action: manualOnly ? 'release' : 'download',
      message:
        process.platform === 'darwin'
          ? '当前 macOS 安装包未配置 Apple Developer ID 签名，请从 Release 手动下载并安装。'
          : isDebianInstall
            ? '已发现新版。为避免未经系统包管理器验证的系统级安装，请从 GitHub Release 手动下载并安装。'
            : undefined,
    });
  });
  autoUpdater.on('update-not-available', () => publishUpdateState('not-available'));
  autoUpdater.on('download-progress', (progress) => {
    publishUpdateState('downloading', {
      version: updateSnapshot.version,
      action: updateSnapshot.action,
      percent: Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0))),
    });
  });
  autoUpdater.on('update-downloaded', (info) =>
    publishUpdateState('downloaded', { version: info?.version, percent: 100 }),
  );
  autoUpdater.on('error', () =>
    publishUpdateState('error', { message: '更新失败，请检查网络后从菜单重试。' }),
  );

  setTimeout(() => void checkForUpdates(), 12_000);
  setInterval(() => void checkForUpdates(), 6 * 60 * 60 * 1000);
}

ipcMain.handle('dyboard:quit', (event) => {
  if (!isTrustedIpcEvent(event)) return false;
  app.quit();
  return true;
});

ipcMain.handle('dyboard:update:get-state', (event) =>
  isTrustedIpcEvent(event) ? updateSnapshot : null,
);
ipcMain.handle('dyboard:update:check', (event) =>
  isTrustedIpcEvent(event) ? checkForUpdates() : false,
);
ipcMain.handle('dyboard:update:download', (event) => {
  if (
    !isTrustedIpcEvent(event) ||
    !autoUpdater ||
    updateSnapshot.status !== 'available' ||
    updateSnapshot.action !== 'download'
  )
    return false;
  void autoUpdater.downloadUpdate().catch(() => {
    publishUpdateState('error', { message: '更新下载失败，请检查网络后重试。' });
  });
  return true;
});
ipcMain.handle('dyboard:update:install', (event) => {
  if (!isTrustedIpcEvent(event) || !autoUpdater || updateSnapshot.status !== 'downloaded')
    return false;
  autoUpdater.quitAndInstall(false, true);
  return true;
});
ipcMain.handle('dyboard:update:release-page', (event) => {
  if (!isTrustedIpcEvent(event)) return false;
  void shell.openExternal(releaseUrl);
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
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
