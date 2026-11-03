const api = window.lagang
const $ = (id) => document.getElementById(id)
const VALID_NAME = /^[a-zA-Z0-9_]{3,16}$/

const state = {
  servers: [],
  current: null,
  username: null,
  playing: false,
  offline: false,
}

const sceneOf = (server) => window.SCENES[server?.scene] ?? window.SCENES.gang
const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`
const memoryLabel = (value) => `${(value / 1024).toFixed(value % 1024 ? 1 : 0)} GB`
const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function applyTheme(scene) {
  const root = document.documentElement.style
  const t = scene.theme
  root.setProperty('--bg', t.bg)
  root.setProperty('--accent', t.accent)
  root.setProperty('--accent-border', t.accentBorder)
  root.setProperty('--accent-glow', t.glow)
  root.setProperty('--pill', t.pill)
  root.setProperty('--kicker', t.kicker)
  root.setProperty('--quote', t.quote)
  $('app').style.background = t.bg
}

function renderScene(server) {
  const scene = sceneOf(server)
  applyTheme(scene)
  $('scene').innerHTML = scene.background()
}

function setStatus(text, { error = false } = {}) {
  const el = $('status')
  el.textContent = text
  el.classList.toggle('error', error)
}

function setProgress(ratio) {
  $('progress').hidden = ratio == null
  $('progress-fill').style.width = `${Math.round((ratio ?? 0) * 100)}%`
}

function idleStatus(server) {
  if (state.offline && server.state === 'ready') return setStatus('Sin conexión · se abrirá lo ya instalado')
  if (server.state === 'ready') return setStatus(`Todo listo · ${server.mods} ${server.mods === 1 ? 'mod' : 'mods'} al día`)
  if (server.state === 'update') return setStatus('Hay una actualización: se descargará al entrar')
  setStatus(`Primera vez: se descargarán unos ${mb(server.size)} y Minecraft`)
}

let pingTimer
async function refreshOnline() {
  const server = state.current
  if (!server) return
  const el = $('online')
  const status = await api.ping(server.id).catch(() => ({ online: false }))
  if (server !== state.current) return
  el.hidden = false
  el.classList.toggle('down', !status.online)
  el.textContent = status.online
    ? `${status.players}/${status.max} ${status.players === 1 ? 'jugador' : 'jugadores'} en línea`
    : 'Servidor apagado'
}

function selectServer(server, { animate = true } = {}) {
  state.current = server
  for (const btn of $('servers').children) btn.setAttribute('aria-pressed', String(btn.dataset.id === server.id))
  renderScene(server)
  $('kicker').textContent = server.kicker ?? server.tagline ?? ''
  $('headline').textContent = server.headline ?? server.name
  $('quote').textContent = server.quote ?? server.description ?? ''
  const hero = $('hero')
  hero.classList.remove('swap')
  if (animate) {
    void hero.offsetWidth
    hero.classList.add('swap')
  }
  idleStatus(server)
  setProgress(null)
  $('online').hidden = true
  refreshOnline()
  clearInterval(pingTimer)
  pingTimer = setInterval(refreshOnline, 30000)
  api.select(server.id)
}

function renderServers() {
  $('servers').innerHTML = state.servers
    .map((s) => `<button class="pill" data-id="${escape(s.id)}" aria-pressed="false">${escape(s.name)}</button>`)
    .join('')
  for (const btn of $('servers').children) {
    btn.addEventListener('click', () => {
      if (state.playing || btn.dataset.id === state.current?.id) return
      selectServer(state.servers.find((s) => s.id === btn.dataset.id))
    })
  }
}

function renderAccount() {
  $('username').textContent = state.username
  $('avatar').textContent = state.username.slice(0, 1).toUpperCase()
}

function showLogin() {
  $('home').hidden = true
  $('login').hidden = false
  $('disclaimer').hidden = false
  $('name').value = state.username ?? ''
  $('name').focus()
}

function showHome() {
  $('login').hidden = true
  $('disclaimer').hidden = true
  $('home').hidden = false
  renderAccount()
}

function setPlaying(playing) {
  state.playing = playing
  $('btn-play').disabled = playing
  $('btn-settings').disabled = playing
  $('account').disabled = playing
  for (const btn of $('servers').children) btn.disabled = playing
}

function playEnter(server) {
  const scene = sceneOf(server)
  $('enter').innerHTML = scene.enter(scene.enterMessage)
}

function clearEnter() {
  $('enter').innerHTML = ''
}

async function play({ repair = false } = {}) {
  const server = state.current
  if (!server || state.playing) return
  setPlaying(true)
  setStatus('Revisando archivos…')
  setProgress(0)
  try {
    await api.play(server.id, { repair })
    server.state = 'ready'
  } catch (err) {
    setPlaying(false)
    clearEnter()
    setProgress(null)
    setStatus(cleanError(err), { error: true })
  }
}

// Electron antepone "Error invoking remote method ..." a los errores del proceso principal.
const cleanError = (err) => String(err?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

api.onProgress((p) => {
  if (p.stage === 'launch') {
    setStatus(p.label)
    setProgress(null)
    playEnter(state.current)
    return
  }
  setStatus(`${p.label} · ${Math.round(p.ratio * 100)}%`)
  setProgress(p.ratio)
})

api.onGameState((s) => {
  if (s.state !== 'closed') return
  setPlaying(false)
  clearEnter()
  if (s.code === 0 || s.code == null && !s.error) {
    idleStatus(state.current)
  } else {
    setStatus(s.error ?? `Minecraft se cerró con un error (código ${s.code}). Revisa “Ver registros” en Ajustes.`, { error: true })
  }
  refreshOnline()
})

function openSettings() {
  const server = state.current
  const m = server.memory
  $('settings-server').textContent = server.name
  const range = $('memory')
  range.min = m.min
  range.max = m.max
  range.value = m.value
  $('memory-value').textContent = memoryLabel(m.value)
  $('memory-hint').textContent = `Recomendado: ${memoryLabel(m.recommended)}. Más memoria no siempre es mejor.`
  $('settings').hidden = false
  $('btn-settings-close').focus()
}

function closeSettings() {
  $('settings').hidden = true
  $('btn-settings').focus()
}

function bindEvents() {
  $('btn-min').addEventListener('click', () => api.minimize())
  $('btn-close').addEventListener('click', () => api.close())

  $('login').addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = $('name').value.trim()
    if (!VALID_NAME.test(name)) {
      $('login-error').textContent = 'De 3 a 16 letras, números o guion bajo, sin espacios.'
      return
    }
    $('login-error').textContent = ''
    state.username = await api.setAccount(name)
    showHome()
  })

  $('account').addEventListener('click', () => {
    if (!state.playing) showLogin()
  })
  $('btn-play').addEventListener('click', () => play())
  $('btn-settings').addEventListener('click', openSettings)
  $('btn-settings-close').addEventListener('click', closeSettings)
  $('settings').addEventListener('click', (e) => {
    if (e.target === $('settings')) closeSettings()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('settings').hidden) closeSettings()
  })

  $('memory').addEventListener('input', (e) => {
    $('memory-value').textContent = memoryLabel(Number(e.target.value))
  })
  $('memory').addEventListener('change', async (e) => {
    state.current.memory = await api.setMemory(state.current.id, Number(e.target.value))
  })
  $('btn-folder').addEventListener('click', () => api.openFolder(state.current.id))
  $('btn-logs').addEventListener('click', () => api.openLogs())
  $('btn-repair').addEventListener('click', () => {
    closeSettings()
    play({ repair: true })
  })
}

async function start() {
  bindEvents()
  renderScene(null)
  try {
    const data = await api.init()
    state.servers = data.servers
    state.username = data.username
    state.offline = data.offline
    $('app-version').textContent = `Launcher ${data.version}`
    renderServers()
    const initial = state.servers.find((s) => s.id === data.lastServer) ?? state.servers[0]
    selectServer(initial, { animate: false })
    if (state.username) showHome()
    else showLogin()
  } catch (err) {
    $('home').hidden = false
    setStatus(cleanError(err), { error: true })
    $('btn-play').disabled = true
  }
}

start()
