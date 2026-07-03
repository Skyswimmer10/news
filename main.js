'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { Store } = require('./src/main/store');
const { Scheduler } = require('./src/main/scheduler');
const { fetchTopic } = require('./src/main/fetchers');

let win = null;
let store = null;
let scheduler = null;
let fetchInProgress = false;

function sendToWindow(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// Fetches all active topics sequentially (gentle on rate limits) and
// reports progress to the renderer.
async function runFetch(reason) {
  if (fetchInProgress) return { skipped: true };
  fetchInProgress = true;
  const summary = { reason, startedAt: Date.now(), topics: [], totalNew: 0 };
  try {
    const topics = store.activeTopics();
    sendToWindow('fetch:status', { state: 'running', total: topics.length, done: 0 });
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const { items, errors } = await fetchTopic(topic, store.settings);
      const added = store.addItems(topic.id, items);
      summary.topics.push({ id: topic.id, name: topic.name, added, errors });
      summary.totalNew += added;
      sendToWindow('fetch:status', { state: 'running', total: topics.length, done: i + 1 });
    }
    store.settings.lastFetch = Date.now();
    store.saveSettings();
    store.prune();
  } finally {
    fetchInProgress = false;
    sendToWindow('fetch:status', { state: 'idle', summary });
  }
  return summary;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'NewsGather',
    backgroundColor: '#14161b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Every link opens in the system browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function registerIpc() {
  ipcMain.handle('topics:list', () =>
    store.topics.map((t) => ({ ...t, active: store.isTopicActive(t) }))
  );
  ipcMain.handle('topics:save', (_e, topic) => store.upsertTopic(topic));
  ipcMain.handle('topics:delete', (_e, id) => store.deleteTopic(id));

  ipcMain.handle('items:list', () => store.listItems());
  ipcMain.handle('items:markSeen', (_e, ids) => store.markSeen(ids));
  ipcMain.handle('items:toggleSaved', (_e, id) => store.toggleSaved(id));

  ipcMain.handle('settings:get', () => store.settings);
  ipcMain.handle('settings:save', (_e, patch) => {
    Object.assign(store.settings, patch);
    store.saveSettings();
    return store.settings;
  });

  ipcMain.handle('fetch:now', () => runFetch('manual'));
  ipcMain.handle('openExternal', (_e, url) => {
    if (typeof url === 'string' && url.startsWith('http')) shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'data'));
  registerIpc();
  createWindow();
  scheduler = new Scheduler(store, runFetch);
  scheduler.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
