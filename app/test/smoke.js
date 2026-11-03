// Prueba sin interfaz: electron test/smoke.js <id> [--launch]
const { app } = require('electron')
app.whenReady().then(async () => {
  const id = process.argv.find((a) => ['gang', 'lucky'].includes(a)) || 'lucky'
  const { fetchCatalog, fetchManifest, pingServer } = require('../src/main/catalog')
  const installer = require('../src/main/installer')
  const t0 = Date.now()
  try {
    const catalog = await fetchCatalog()
    const server = catalog.servers.find((s) => s.id === id)
    console.log('ping', await pingServer(server.host, server.port))
    const manifest = await fetchManifest(server)
    let last = ''
    const prepared = await installer.prepare(server, manifest, (p) => {
      const line = `${p.label} ${Math.round(p.ratio * 100)}%`
      if (line !== last && (p.ratio === 0 || p.ratio === 1 || Math.round(p.ratio * 100) % 10 === 0)) console.log(line)
      last = line
    })
    console.log('PREPARED', JSON.stringify(prepared), ((Date.now() - t0) / 1000).toFixed(0) + 's')
    if (process.argv.includes('--launch')) {
      const game = require('../src/main/launch')
      const { offlineProfile } = require('../src/main/account')
      await game.start({ server, profile: offlineProfile('LaGangTest'), memory: 3072, prepared, on: (e, d) => { console.log('EVENT', e, JSON.stringify(d || {})); if (e === 'exit') app.quit() } })
      return
    }
  } catch (err) {
    console.error('FAIL', err && err.stack || err); if (err && err.errors) { console.error('N', err.errors.length); for (const e of err.errors.slice(0, 5)) console.error(' -', e && (e.stack || e.message), e && e.cause && String(e.cause)) }
  }
  app.quit()
})
