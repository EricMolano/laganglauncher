const crypto = require('node:crypto')
const { safeStorage } = require('electron')
const settings = require('./settings')
const { offlineProfile } = require('./account')
const microsoft = require('./microsoft')

// Cuentas guardadas en settings.json: { id, type: 'offline' | 'microsoft', name, uuid, refresh? }.
// De una cuenta de Microsoft solo se guarda el token de renovación, cifrado por Windows (safeStorage).

function all() {
  const s = settings.load()
  if (s.accounts) return s.accounts
  // Versiones anteriores guardaban un solo nombre en `username`.
  const accounts = []
  let active = null
  if (s.username) {
    try {
      const profile = offlineProfile(s.username)
      active = offlineId(profile.name)
      accounts.push({ id: active, type: 'offline', name: profile.name, uuid: profile.id })
    } catch {}
  }
  settings.save({ accounts, activeAccount: active, username: undefined })
  return accounts
}

const offlineId = (name) => `offline:${name.toLowerCase()}`
const active = () => all().find((a) => a.id === settings.load().activeAccount) ?? null

// Lo que ve la interfaz: nunca incluye tokens.
function state() {
  const current = active()
  return {
    accounts: all().map(({ id, type, name }) => ({ id, type, name })),
    activeAccount: current?.id ?? null,
    microsoftReady: microsoft.configured(),
  }
}

function upsert(account) {
  const accounts = all().filter((a) => a.id !== account.id)
  accounts.push(account)
  settings.save({ accounts, activeAccount: account.id })
  return state()
}

function addOffline(name) {
  const profile = offlineProfile(String(name).trim())
  return upsert({ id: offlineId(profile.name), type: 'offline', name: profile.name, uuid: profile.id })
}

const seal = (text) => safeStorage.encryptString(text).toString('base64')
const unseal = (text) => safeStorage.decryptString(Buffer.from(text, 'base64'))

async function addMicrosoft(parentWindow) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Este equipo no puede guardar la sesión de forma segura.')
  const session = await microsoft.login(parentWindow)
  return upsert({
    id: `microsoft:${session.profile.id}`,
    type: 'microsoft',
    name: session.profile.name,
    uuid: session.profile.id,
    refresh: seal(session.refreshToken),
  })
}

function select(id) {
  if (!all().some((a) => a.id === id)) throw new Error('Cuenta desconocida')
  settings.save({ activeAccount: id })
  return state()
}

function remove(id) {
  const accounts = all().filter((a) => a.id !== id)
  const current = settings.load().activeAccount
  settings.save({ accounts, activeAccount: current === id ? accounts[0]?.id ?? null : current })
  return state()
}

// Lo que necesita Minecraft para arrancar con la cuenta activa.
async function session() {
  const account = active()
  if (!account) throw new Error('Elige una cuenta para jugar.')
  if (account.type === 'offline') {
    return {
      profile: { name: account.name, id: account.uuid },
      accessToken: crypto.randomBytes(16).toString('hex'),
      userType: 'legacy',
    }
  }
  let fresh
  try {
    fresh = await microsoft.refresh(unseal(account.refresh))
  } catch (err) {
    throw new Error(`No se pudo renovar la sesión de ${account.name}. Quita la cuenta y vuelve a iniciar sesión. (${err.message})`)
  }
  // Microsoft entrega un token de renovación nuevo cada vez, y el nombre pudo cambiar.
  const accounts = all().map((a) => (a.id === account.id ? { ...a, name: fresh.profile.name, refresh: seal(fresh.refreshToken) } : a))
  settings.save({ accounts })
  return { profile: fresh.profile, accessToken: fresh.accessToken, userType: 'msa' }
}

module.exports = { state, addOffline, addMicrosoft, select, remove, session }
