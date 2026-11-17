const crypto = require('node:crypto')
const { BrowserWindow } = require('electron')
const config = require('./config')

// Inicio de sesión con cuenta de Microsoft (Minecraft original).
// El jugador escribe su contraseña en la página de Microsoft; el launcher solo recibe un código.
// Pasos: Microsoft -> Xbox Live -> XSTS -> servicios de Minecraft -> perfil.

const CLIENT_ID = process.env.LAGANG_MS_CLIENT_ID || config.msClientId
const AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
const REDIRECT = 'https://login.microsoftonline.com/common/oauth2/nativeclient'
const SCOPE = 'XboxLive.signin offline_access'

const XBOX_ERRORS = {
  2148916233: 'Esta cuenta de Microsoft no tiene perfil de Xbox. Créalo en xbox.com y vuelve a intentar.',
  2148916235: 'Xbox Live no está disponible en el país de esta cuenta.',
  2148916236: 'La cuenta necesita verificación de adulto en Xbox.',
  2148916237: 'La cuenta necesita verificación de adulto en Xbox.',
  2148916238: 'Es una cuenta de menor: un adulto debe agregarla a un grupo familiar de Microsoft.',
}

const configured = () => Boolean(CLIENT_ID)

async function request(url, options, label) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), ...options })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(`${label} respondió ${res.status}`)
    error.status = res.status
    error.body = body
    throw error
  }
  return body
}

const postJson = (url, data, label) =>
  request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) }, label)

const postForm = (url, data, label) =>
  request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) }, label)

// Abre la página de Microsoft en una ventana aparte y devuelve el código de autorización.
function askForCode(parentWindow, challenge) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      parent: parentWindow,
      modal: true,
      width: 520,
      height: 680,
      title: 'Iniciar sesión con Microsoft',
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      // Sesión en memoria y nueva cada vez: permite agregar una segunda cuenta sin arrastrar la anterior.
      webPreferences: { partition: `ms-login-${Date.now()}`, sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    win.setMenu(null)
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
      if (!win.isDestroyed()) win.close()
    }
    const check = (event, url) => {
      if (!url.startsWith(REDIRECT)) return
      event.preventDefault()
      const params = new URL(url).searchParams
      const code = params.get('code')
      if (code) finish(resolve, code)
      else finish(reject, new Error(params.get('error') === 'access_denied' ? 'Inicio de sesión cancelado.' : params.get('error_description') || 'Microsoft no autorizó el inicio de sesión.'))
    }
    win.webContents.on('will-redirect', check)
    win.webContents.on('will-navigate', check)
    win.on('closed', () => finish(reject, new Error('Inicio de sesión cancelado.')))
    const query = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT,
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    })
    win.loadURL(`${AUTHORITY}/authorize?${query}`)
  })
}

// Con el token de Microsoft, llega hasta el perfil y el token de Minecraft.
async function minecraftSession(tokens) {
  const xbl = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${tokens.access_token}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }, 'Xbox Live')

  let xsts
  try {
    xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }, 'Xbox Live')
  } catch (err) {
    throw new Error(XBOX_ERRORS[err.body?.XErr] ?? err.message)
  }

  let minecraft
  try {
    minecraft = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
      identityToken: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}`,
    }, 'Minecraft')
  } catch (err) {
    // Mojang solo acepta aplicaciones que aprobó: ver README, "Cuenta de Microsoft".
    if (err.status === 403) throw new Error('Mojang todavía no aprobó este launcher para iniciar sesión con Microsoft.')
    throw err
  }

  let profile
  try {
    profile = await request('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${minecraft.access_token}` },
    }, 'Minecraft')
  } catch (err) {
    if (err.status === 404) throw new Error('Esta cuenta de Microsoft no tiene Minecraft: Java Edition.')
    throw err
  }

  return {
    profile: { id: profile.id, name: profile.name },
    accessToken: minecraft.access_token,
    refreshToken: tokens.refresh_token,
  }
}

async function login(parentWindow) {
  if (!configured()) throw new Error('El inicio de sesión con Microsoft todavía no está configurado en este launcher.')
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const code = await askForCode(parentWindow, challenge)
  const tokens = await postForm(`${AUTHORITY}/token`, {
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
  }, 'Microsoft')
  return minecraftSession(tokens)
}

async function refresh(refreshToken) {
  const tokens = await postForm(`${AUTHORITY}/token`, {
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPE,
  }, 'Microsoft')
  return minecraftSession(tokens)
}

module.exports = { configured, login, refresh }
