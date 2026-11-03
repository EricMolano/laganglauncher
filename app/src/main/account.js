const crypto = require('node:crypto')

const VALID_NAME = /^[a-zA-Z0-9_]{3,16}$/

// El mismo UUID que calcula un servidor en modo offline: MD5("OfflinePlayer:" + nombre), versión 3.
function offlineUUID(name) {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${name}`).digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  return hash.toString('hex')
}

function offlineProfile(name) {
  if (!VALID_NAME.test(name)) {
    throw new Error('El nombre debe tener de 3 a 16 letras, números o guion bajo.')
  }
  return { name, id: offlineUUID(name) }
}

module.exports = { VALID_NAME, offlineUUID, offlineProfile }
