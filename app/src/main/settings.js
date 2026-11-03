const fs = require('node:fs')
const os = require('node:os')
const paths = require('./paths')

let cache

function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(paths.settings, 'utf8'))
  } catch {
    cache = {}
  }
  cache.memory ??= {}
  return cache
}

function save(patch) {
  const next = { ...load(), ...patch }
  fs.mkdirSync(require('node:path').dirname(paths.settings), { recursive: true })
  fs.writeFileSync(paths.settings, JSON.stringify(next, null, 2))
  cache = next
  return next
}

// RAM para un servidor: la elegida por el jugador o la recomendada, sin pasar de la mitad del equipo.
function memoryFor(server) {
  const totalMb = Math.floor(os.totalmem() / 1024 / 1024)
  const chosen = load().memory[server.id]
  const fallback = Math.min(server.memory.recommended, Math.floor(totalMb / 2 / 512) * 512)
  return {
    value: chosen ?? Math.max(server.memory.min, fallback),
    min: server.memory.min,
    max: Math.max(server.memory.min, Math.floor((totalMb - 2048) / 512) * 512),
    recommended: server.memory.recommended,
  }
}

module.exports = { load, save, memoryFor }
