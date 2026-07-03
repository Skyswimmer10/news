'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listTopics: () => ipcRenderer.invoke('topics:list'),
  saveTopic: (topic) => ipcRenderer.invoke('topics:save', topic),
  deleteTopic: (id) => ipcRenderer.invoke('topics:delete', id),

  listItems: () => ipcRenderer.invoke('items:list'),
  markSeen: (ids) => ipcRenderer.invoke('items:markSeen', ids),
  toggleSaved: (id) => ipcRenderer.invoke('items:toggleSaved', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),

  fetchNow: () => ipcRenderer.invoke('fetch:now'),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),

  onFetchStatus: (cb) =>
    ipcRenderer.on('fetch:status', (_e, payload) => cb(payload))
});
