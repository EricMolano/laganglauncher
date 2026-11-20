const { contextBridge, ipcRenderer } = require('electron')

const listen = (channel) => (cb) => {
  const handler = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

contextBridge.exposeInMainWorld('lagang', {
  init: () => ipcRenderer.invoke('app:init'),
  addOffline: (name) => ipcRenderer.invoke('accounts:addOffline', name),
  addMicrosoft: () => ipcRenderer.invoke('accounts:addMicrosoft'),
  selectAccount: (id) => ipcRenderer.invoke('accounts:select', id),
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  ping: (id) => ipcRenderer.invoke('server:ping', id),
  select: (id) => ipcRenderer.invoke('server:select', id),
  setMemory: (id, mb) => ipcRenderer.invoke('server:memory', id, mb),
  openFolder: (id) => ipcRenderer.invoke('server:folder', id),
  openLogs: () => ipcRenderer.invoke('app:logs'),
  play: (id, opts) => ipcRenderer.invoke('game:play', id, opts),
  onProgress: listen('game:progress'),
  onGameState: listen('game:state'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: listen('update:state'),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
})
