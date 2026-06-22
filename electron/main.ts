import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

// DIAGNOSTIC: log main process startup
console.log('[main] KerbOffice main process starting, electron version:', process.versions.electron);

// DIAGNOSTIC: write main process logs to a file we can read back
const logFile = path.join(app.getPath('userData'), 'main.log');
function mainLog(...args: any[]) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  console.log(...args);
}
mainLog('[main] log file at', logFile);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'KerbOffice',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    backgroundColor: '#1a1a2e',
    show: false,
  });

  // Dev: load from Vite dev server; Prod: load built files
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // DIAGNOSTIC: log page load events
  mainWindow.webContents.on('did-finish-load', () => {
    mainLog('[main] renderer finished loading');
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    mainLog('[main] renderer FAILED to load:', code, desc);
  });
  mainWindow.webContents.on('preload-error', (_e, preloadPath, error) => {
    mainLog('[main] PRELOAD ERROR in', preloadPath, ':', error.message);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    mainLog('[main] render process gone:', JSON.stringify(details));
  });
  // Capture renderer console messages into the main log too
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    mainLog(`[renderer console L${level}] ${source}:${line} ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers will be registered in ipc-handlers.ts
import './ipc-handlers';
