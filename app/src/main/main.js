const path = require('node:path')
const fs = require('node:fs')
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron')
const paths = require('./paths')
const settings = require('./settings')
const accounts = require('./accounts')
const { fetchCatalog, fetchManifest, pingServer } = require('./catalog')
const installer = require('./installer')
const game = require('./launch')

let win
let catalog
let busy = false

if (!app.requestSingleInstanceLock()) app.quit()

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 680,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    frame: false,
    backgroundColor: '#07060c',
    title: 'La Gang',
    icon: path.join(__dirname, '../../build/icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  Menu.setApplicationMenu(null)
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

const send = (channel, payload) => win?.webContents.send(channel, payload)
const findServer = (id) => {
  const server = catalog?.servers.find((s) => s.id === id)
  if (!server) throw new Error('Servidor desconocido')
  return server
}

function serverState(server) {
  const synced = settings.load().synced?.[server.id]
  if (!synced) return { state: 'new', size: server.size }
  return { state: synced === server.version ? 'ready' : 'update', size: server.size }
}

ipcMain.handle('app:init', async () => {
  catalog = await fetchCatalog()
  const s = settings.load()
  return {
    version: app.getVersion(),
    ...accounts.state(),
    lastServer: s.lastServer ?? null,
    offline: catalog.offline,
    servers: catalog.servers.map((server) => ({
      ...server,
      ...serverState(server),
      memory: settings.memoryFor(server),
    })),
  }
})

// Todas devuelven la lista de cuentas actualizada (sin tokens).
ipcMain.handle('accounts:addOffline', (_e, name) => accounts.addOffline(name))
ipcMain.handle('accounts:addMicrosoft', () => accounts.addMicrosoft(win))
ipcMain.handle('accounts:select', (_e, id) => accounts.select(id))
ipcMain.handle('accounts:remove', (_e, id) => accounts.remove(id))

ipcMain.handle('server:ping', (_e, id) => {
  const server = findServer(id)
  return pingServer(server.host, server.port)
})

ipcMain.handle('server:select', (_e, id) => {
  settings.save({ lastServer: findServer(id).id })
})

ipcMain.handle('server:memory', (_e, id, mb) => {
  const server = findServer(id)
  const limits = settings.memoryFor(server)
  const value = Math.max(limits.min, Math.min(limits.max, Math.round(mb / 512) * 512))
  settings.save({ memory: { ...settings.load().memory, [id]: value } })
  return settings.memoryFor(server)
})

ipcMain.handle('server:folder', (_e, id) => {
  const dir = paths.instance(findServer(id).id)
  fs.mkdirSync(dir, { recursive: true })
  return shell.openPath(dir)
})

ipcMain.handle('app:logs', () => {
  fs.mkdirSync(paths.logs, { recursive: true })
  return shell.openPath(paths.logs)
})

ipcMain.handle('game:play', async (_e, id, { repair = false } = {}) => {
  if (busy) throw new Error('Ya hay una partida en marcha')
  busy = true
  const server = findServer(id)
  try {
    send('game:progress', { stage: 'account', label: 'Comprobando la cuenta', ratio: 0 })
    const session = await accounts.session()
    const manifest = await fetchManifest(server)
    const prepared = await installer.prepare(server, manifest, (p) => send('game:progress', p), { repair })
    settings.save({ synced: { ...settings.load().synced, [server.id]: server.version } })
    send('game:progress', { stage: 'launch', label: 'Abriendo Minecraft', ratio: 1 })
    await game.start({
      server,
      ...session,
      memory: settings.memoryFor(server).value,
      prepared,
      on: (event, data) => {
        if (event === 'ready') {
          send('game:state', { state: 'running' })
          win?.hide()
        } else if (event === 'exit') {
          busy = false
          win?.show()
          send('game:state', { state: 'closed', ...data })
        }
      },
    })
    send('game:state', { state: 'starting' })
  } catch (err) {
    busy = false
    throw err
  }
})

ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:close', () => win?.close())

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
