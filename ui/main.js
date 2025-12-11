const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

function createDeckWindow(payload, sender) {
  const rect = payload?.rect;
  if (!rect) {
    return;
  }

  const width = Math.max(200, Math.round(rect.width || 0));
  const height = Math.max(120, Math.round(rect.height || 0));
  const deckId = payload?.id !== undefined ? String(payload.id) : undefined;
  const cursor = payload?.cursor;

  const parent = sender ? BrowserWindow.fromWebContents(sender) : undefined;

  const deckWindow = new BrowserWindow({
    width,
    height,
    minWidth: 240,
    minHeight: 120,
    useContentSize: true,
    parent,
    autoHideMenuBar: true,
    title: deckId ? `Deck ${deckId}` : 'Deck',
    x: cursor ? Math.round(cursor.x) : undefined,
    y: cursor ? Math.round(cursor.y) : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const params = new URLSearchParams({ view: 'deck' });
  if (deckId) {
    params.set('deckId', deckId);
  }

  deckWindow.loadFile(path.join(__dirname, 'dist', 'index.html'), {
    search: `?${params.toString()}`,
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

require("./endpoints")();

ipcMain.on('ui:expand-window', (event, payload) => {
  try {
    createDeckWindow(payload, event.sender);
  } catch (error) {
    console.error('Failed to open deck window', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
