const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('finAPI', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (db) => ipcRenderer.invoke('data:save', db),
  saveFile: (name, bytes) => ipcRenderer.invoke('file:save', name, bytes),
  openFile: (exts) => ipcRenderer.invoke('file:open', exts),
  saveTemplate: () => ipcRenderer.invoke('template:save'),
  savePDF: (name, html, opt) => ipcRenderer.invoke('pdf:save', name, html, opt),
  httpBin: (url) => ipcRenderer.invoke('http:bin', url),
  rollMembers: () => ipcRenderer.invoke('roll:members'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  onUpdate: (fn) => ipcRenderer.on('update', (e, s) => fn(s))
});
