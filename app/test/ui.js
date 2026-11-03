// Captura la interfaz real: electron test/ui.js <salida-dir> "<js a ejecutar>;..." (pasos separados por |||)
const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')
require('../src/main/main.js')
const out = process.argv[2]
const steps = (process.argv[3] || '').split('|||').filter(Boolean)
app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 2500))
  const win = BrowserWindow.getAllWindows()[0]
  win.setAlwaysOnTop(true); win.focus(); win.webContents.setBackgroundThrottling(false)
  const shot = async (name) => fs.writeFileSync(path.join(out, name + '.png'), (await win.webContents.capturePage()).toPNG())
  await shot('00')
  let i = 1
  for (const step of steps) {
    const [js, wait] = step.split('@@')
    const res = await win.webContents.executeJavaScript(js).catch((e) => 'ERR ' + e.message)
    console.log('step', i, JSON.stringify(res))
    await new Promise((r) => setTimeout(r, Number(wait || 1500)))
    await shot(String(i++).padStart(2, '0'))
  }
  app.quit()
})
