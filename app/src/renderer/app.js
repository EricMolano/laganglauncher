const api = window.lagang
const $ = (id) => document.getElementById(id)
const VALID_NAME = /^[a-zA-Z0-9_]{3,16}$/

const state = {
  servers: [],
  current: null,
  accounts: [],
  activeAccount: null,
  playing: false,
  offline: false,
}

const sceneOf = (server) => window.SCENES[server?.scene] ?? window.SCENES.gang
const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`
const memoryLabel = (value) => `${(value / 1024).toFixed(value % 1024 ? 1 : 0)} GB`
const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function applyTheme(scene) {
  const root = document.documentElement.style
  for (const [name, value] of Object.entries(scene.theme)) root.setProperty(`--${name}`, value)
  $('app').style.background = scene.theme.bg
}

function renderScene(server) {
  const scene = sceneOf(server)
  applyTheme(scene)
  $('scene').innerHTML = scene.background()
}

const LOADERS = { fabric: 'Fabric', forge: 'Forge' }
function chipsOf(server) {
  const chips = []
  if (server.minecraft) chips.push(`${LOADERS[server.loader?.type] ?? 'Minecraft'} ${server.minecraft}`)
  if (server.java) chips.push(`Java ${server.java}`)
  if (server.mods) chips.push(`${server.mods} ${server.mods === 1 ? 'mod' : 'mods'}`)
  if (server.size) chips.push(mb(server.size))
  return chips
}

function setStatus(text, { error = false } = {}) {
  const el = $('status')
  el.textContent = text
  el.classList.toggle('error', error)
}

function setProgress(ratio) {
  $('progress').hidden = ratio == null
  $('progress-fill').style.width = `${Math.round((ratio ?? 0) * 100)}%`
  // La escena reacciona al avance (la grieta se ensancha, el bloque brilla más).
  $('app').style.setProperty('--p', ratio ?? 0)
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
  $('chips').innerHTML = chipsOf(server).map((c) => `<span class="chip">${escape(c)}</span>`).join('')
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
    .map((s) => `<button class="tab" data-id="${escape(s.id)}" aria-pressed="false">${escape(s.name)}</button>`)
    .join('')
  for (const btn of $('servers').children) {
    btn.addEventListener('click', () => {
      if (state.playing || btn.dataset.id === state.current?.id) return
      selectServer(state.servers.find((s) => s.id === btn.dataset.id))
    })
  }
}

const ACCOUNT_TYPES = { offline: 'Sin premium', microsoft: 'Microsoft' }
const activeAccount = () => state.accounts.find((a) => a.id === state.activeAccount)

function renderAccount() {
  const account = activeAccount()
  $('username').textContent = account.name
  $('account-sub').textContent = ACCOUNT_TYPES[account.type]
  $('avatar').textContent = account.name.slice(0, 1).toUpperCase()
}

// Aplica la lista de cuentas que devuelve el proceso principal y muestra la pantalla que toca.
function applyAccounts(data) {
  state.accounts = data.accounts
  state.activeAccount = data.activeAccount
  if (activeAccount()) showHome()
  else {
    closeAccounts()
    showLogin()
  }
  renderAccountList()
}

function renderAccountList() {
  $('account-list').innerHTML = state.accounts.map((a) => `<li>
    <button class="account-row" data-id="${escape(a.id)}" aria-pressed="${a.id === state.activeAccount}">
      <span class="avatar" aria-hidden="true">${escape(a.name.slice(0, 1).toUpperCase())}</span>
      <span class="account-text"><span class="account-name">${escape(a.name)}</span><span class="account-sub">${ACCOUNT_TYPES[a.type]}</span></span>
    </button>
    <button class="icon-btn" data-remove="${escape(a.id)}" aria-label="Quitar la cuenta ${escape(a.name)}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.4"/></svg></button>
  </li>`).join('')
}

function openAccounts() {
  $('accounts-error').textContent = ''
  $('new-name').value = ''
  renderAccountList()
  $('accounts').hidden = false
  $('btn-accounts-close').focus()
}

function closeAccounts() {
  if ($('accounts').hidden) return
  $('accounts').hidden = true
  $('account').focus()
}

// Corre un cambio de cuentas y muestra el error donde corresponda.
async function accountAction(action, errorEl) {
  errorEl.textContent = ''
  try {
    applyAccounts(await action())
    return true
  } catch (err) {
    errorEl.textContent = cleanError(err)
    return false
  }
}

async function microsoftLogin(button, errorEl) {
  button.disabled = true
  await accountAction(() => api.addMicrosoft(), errorEl)
  button.disabled = false
}

function showLogin() {
  $('home').hidden = true
  $('login').hidden = false
  $('disclaimer').hidden = false
  $('name').value = ''
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
  $('app').classList.add('open')
}

function clearEnter() {
  $('enter').innerHTML = ''
  $('app').classList.remove('open')
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

// "Reducir animaciones" se recuerda en este equipo.
function setCalm(on) {
  document.documentElement.classList.toggle('calm', on)
  $('calm').checked = on
  localStorage.setItem('calm', on ? '1' : '')
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
    await accountAction(() => api.addOffline(name), $('login-error'))
  })
  $('btn-ms-login').addEventListener('click', (e) => microsoftLogin(e.currentTarget, $('login-error')))

  $('account').addEventListener('click', () => {
    if (!state.playing) openAccounts()
  })
  $('btn-accounts-close').addEventListener('click', closeAccounts)
  $('accounts').addEventListener('click', (e) => {
    if (e.target === $('accounts')) closeAccounts()
  })
  $('account-list').addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove]')
    const row = e.target.closest('[data-id]')
    if (remove) accountAction(() => api.removeAccount(remove.dataset.remove), $('accounts-error'))
    else if (row) accountAction(() => api.selectAccount(row.dataset.id), $('accounts-error'))
  })
  $('account-add').addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = $('new-name').value.trim()
    if (!VALID_NAME.test(name)) {
      $('accounts-error').textContent = 'De 3 a 16 letras, números o guion bajo, sin espacios.'
      return
    }
    if (await accountAction(() => api.addOffline(name), $('accounts-error'))) $('new-name').value = ''
  })
  $('btn-microsoft').addEventListener('click', (e) => microsoftLogin(e.currentTarget, $('accounts-error')))
  $('btn-play').addEventListener('click', () => play())
  $('btn-settings').addEventListener('click', openSettings)
  $('btn-settings-close').addEventListener('click', closeSettings)
  $('settings').addEventListener('click', (e) => {
    if (e.target === $('settings')) closeSettings()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (!$('settings').hidden) closeSettings()
    else closeAccounts()
  })

  $('memory').addEventListener('input', (e) => {
    $('memory-value').textContent = memoryLabel(Number(e.target.value))
  })
  $('memory').addEventListener('change', async (e) => {
    state.current.memory = await api.setMemory(state.current.id, Number(e.target.value))
  })
  $('calm').addEventListener('change', (e) => setCalm(e.target.checked))
  $('btn-folder').addEventListener('click', () => api.openFolder(state.current.id))
  $('btn-logs').addEventListener('click', () => api.openLogs())
  $('btn-repair').addEventListener('click', () => {
    closeSettings()
    play({ repair: true })
  })
}

async function start() {
  bindEvents()
  setCalm(localStorage.getItem('calm') === '1')
  renderScene(null)
  try {
    const data = await api.init()
    state.servers = data.servers
    state.offline = data.offline
    $('app-version').textContent = `Launcher ${data.version}`
    renderServers()
    const initial = state.servers.find((s) => s.id === data.lastServer) ?? state.servers[0]
    selectServer(initial, { animate: false })
    applyAccounts(data)
  } catch (err) {
    $('home').hidden = false
    setStatus(cleanError(err), { error: true })
    $('btn-play').disabled = true
  }
}

start()
