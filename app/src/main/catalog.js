const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const paths = require('./paths')

const CATALOG_URL = process.env.LAGANG_CATALOG_URL || 'http://209.145.60.34:8090/launcher/v1/catalog.json'
const cacheFile = path.join(paths.root, 'catalog.json')

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`)
  return res.json()
}

// Sin internet se usa el último catálogo descargado para poder abrir lo ya instalado.
async function fetchCatalog() {
  try {
    const catalog = await getJson(CATALOG_URL)
    fs.mkdirSync(paths.root, { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify(catalog))
    return { ...catalog, offline: false }
  } catch (err) {
    if (!fs.existsSync(cacheFile)) throw new Error(`No se pudo cargar la lista de servidores: ${err.message}`)
    return { ...JSON.parse(fs.readFileSync(cacheFile, 'utf8')), offline: true }
  }
}

const fetchManifest = (server) => getJson(server.manifest)

function writeVarInt(value) {
  const bytes = []
  do {
    let b = value & 0x7f
    value >>>= 7
    if (value) b |= 0x80
    bytes.push(b)
  } while (value)
  return Buffer.from(bytes)
}

function readVarInt(buf, offset) {
  let value = 0
  let size = 0
  let b
  do {
    if (offset + size >= buf.length) return null
    b = buf[offset + size]
    value |= (b & 0x7f) << (7 * size)
    size++
  } while (b & 0x80)
  return { value, size }
}

// Server List Ping: cuántos jugadores hay conectados.
function pingServer(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    let data = Buffer.alloc(0)
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeout, () => done({ online: false }))
    socket.on('error', () => done({ online: false }))
    socket.on('connect', () => {
      const hostBuf = Buffer.from(host, 'utf8')
      const portBuf = Buffer.alloc(2)
      portBuf.writeUInt16BE(port)
      const handshake = Buffer.concat([
        writeVarInt(0), writeVarInt(767), writeVarInt(hostBuf.length), hostBuf, portBuf, writeVarInt(1),
      ])
      socket.write(Buffer.concat([writeVarInt(handshake.length), handshake]))
      socket.write(Buffer.from([1, 0]))
    })
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk])
      const len = readVarInt(data, 0)
      if (!len || data.length < len.size + len.value) return
      const id = readVarInt(data, len.size)
      const strLen = readVarInt(data, len.size + id.size)
      const start = len.size + id.size + strLen.size
      try {
        const status = JSON.parse(data.subarray(start, start + strLen.value).toString('utf8'))
        done({ online: true, players: status.players?.online ?? 0, max: status.players?.max ?? 0 })
      } catch {
        done({ online: true, players: 0, max: 0 })
      }
    })
  })
}

module.exports = { fetchCatalog, fetchManifest, pingServer }
