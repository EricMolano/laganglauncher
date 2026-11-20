const { app } = require('electron')
const { autoUpdater } = require('electron-updater')

// Actualizaciones del propio launcher desde GitHub Releases (por HTTPS).
// Se descarga sola en segundo plano; se instala al reiniciar desde el aviso o al cerrar el launcher.
let state = { state: 'idle' }
let notify = () => {}

function set(next) {
  state = next
  notify(state)
}

function init(onChange) {
  notify = onChange
  // Sin empaquetar no hay app-update.yml: en desarrollo no se busca nada.
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => set({ ...state, state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
  // Un fallo al buscar actualizaciones no debe molestar al jugador: se reintenta en la próxima revisión.
  autoUpdater.on('error', () => set({ state: 'idle' }))
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  check()
  setInterval(check, 60 * 60 * 1000)
}

const current = () => state

function install() {
  if (state.state === 'ready') autoUpdater.quitAndInstall(true, true)
}

module.exports = { init, current, install }
