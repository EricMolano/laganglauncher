const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { MinecraftFolder, Version } = require('@xmcl/core')
const {
  getVersionList,
  installTask,
  installDependenciesTask,
  installFabric,
  installForgeTask,
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask,
} = require('@xmcl/installer')
const { Agent, interceptors } = require('undici')
const paths = require('./paths')

const FORGE_MAVEN = ['https://maven.minecraftforge.net/']
const JAVA_TARGETS = { 17: 'java-runtime-gamma', 21: 'java-runtime-delta' }

// XMCL lanza todas las descargas a la vez; sin límite, Mojang corta las conexiones.
const dispatcher = new Agent({ connections: 12, connect: { timeout: 30000 }, bodyTimeout: 60000 })
  .compose(interceptors.retry({ maxRetries: 4, minTimeout: 1000 }), interceptors.redirect({ maxRedirections: 5 }))
const net = { dispatcher, assetsDownloadConcurrency: 24 }

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const writeJson = async (file, data) => {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(data, null, 1))
}

// Corre una tarea de XMCL informando el avance de la tarea raíz, como mucho 10 veces por segundo.
// El total crece a medida que XMCL descubre archivos, así que el avance nunca retrocede.
// Si fallan descargas se reintenta: lo ya bajado y verificado no se vuelve a bajar.
async function runTask(makeTask, report, attempts = 3) {
  let best = 0
  for (let attempt = 1; ; attempt++) {
    const task = makeTask()
    let last = 0
    try {
      return await task.startAndWait({
        onUpdate() {
          const now = Date.now()
          if (now - last < 100 || !(task.total > 0)) return
          last = now
          best = Math.max(best, task.progress / task.total)
          report(best)
        },
      })
    } catch (err) {
      if (attempt >= attempts) throw describeError(err)
    }
  }
}

function describeError(err) {
  const inner = err?.errors?.[0] ?? err
  const message = inner?.message ?? String(inner)
  const wrapped = new Error(err?.errors ? `${err.errors.length} descargas fallaron (${message})` : message)
  wrapped.cause = err
  return wrapped
}

function javaExecutable(major) {
  const bin = path.join(paths.java(major), 'bin')
  return process.platform === 'win32' ? path.join(bin, 'javaw.exe') : path.join(bin, 'java')
}

async function ensureJava(major, progress) {
  const exe = javaExecutable(major)
  const marker = path.join(paths.java(major), '.lagang-ok')
  if (fs.existsSync(exe) && fs.existsSync(marker)) return exe
  progress({ stage: 'java', label: `Preparando Java ${major}`, ratio: 0 })
  const manifest = await fetchJavaRuntimeManifest({ target: JAVA_TARGETS[major], dispatcher })
  await runTask(() => installJavaRuntimeTask({ manifest, destination: paths.java(major), ...net }), (ratio) =>
    progress({ stage: 'java', label: `Preparando Java ${major}`, ratio }),
  )
  if (process.platform !== 'win32') await fsp.chmod(exe, 0o755)
  await fsp.writeFile(marker, manifest.version?.name ?? String(major))
  return exe
}

// Minecraft base + Fabric/Forge en la carpeta compartida. Devuelve el id de versión que se lanza.
async function ensureGame(manifest, javaPath, progress, { repair = false } = {}) {
  const folder = MinecraftFolder.from(paths.shared)
  const stateFile = path.join(paths.shared, 'lagang-versions.json')
  const state = readJson(stateFile, {})
  const key = `${manifest.minecraft}/${manifest.loader.type}/${manifest.loader.version}`
  const known = state[key]
  if (!repair && known && fs.existsSync(folder.getVersionJson(known))) return known

  const mcLabel = `Descargando Minecraft ${manifest.minecraft}`
  progress({ stage: 'minecraft', label: mcLabel, ratio: 0 })
  const list = await getVersionList()
  const meta = list.versions.find((v) => v.id === manifest.minecraft)
  if (!meta) throw new Error(`Mojang no publica la versión ${manifest.minecraft}`)
  await runTask(() => installTask(meta, folder, { side: 'client', ...net }), (ratio) =>
    progress({ stage: 'minecraft', label: mcLabel, ratio }),
  )

  const { type, version } = manifest.loader
  const loaderLabel = `Instalando ${type === 'forge' ? 'Forge' : 'Fabric'} ${version}`
  progress({ stage: 'loader', label: loaderLabel, ratio: 0 })
  let versionId
  if (type === 'fabric') {
    versionId = await installFabric({ minecraftVersion: manifest.minecraft, version, minecraft: folder })
  } else if (type === 'forge') {
    const task = () => installForgeTask({ mcversion: manifest.minecraft, version }, folder, {
      java: javaPath,
      mavenHost: FORGE_MAVEN,
      side: 'client',
      ...net,
    })
    versionId = await runTask(task, (ratio) => progress({ stage: 'loader', label: loaderLabel, ratio }))
  } else {
    throw new Error(`Loader no soportado: ${type}`)
  }

  const resolved = await Version.parse(folder, versionId)
  await runTask(() => installDependenciesTask(resolved, { side: 'client', mavenHost: FORGE_MAVEN, ...net }), (ratio) =>
    progress({ stage: 'loader', label: loaderLabel, ratio }),
  )
  state[key] = versionId
  await writeJson(stateFile, state)
  return versionId
}

async function sha1File(file) {
  const hash = crypto.createHash('sha1')
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

async function download(url, dest, sha1, onBytes) {
  const tmp = `${dest}.part`
  await fsp.mkdir(path.dirname(dest), { recursive: true })
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const hash = crypto.createHash('sha1')
      const body = Readable.fromWeb(res.body)
      body.on('data', (chunk) => {
        hash.update(chunk)
        onBytes(chunk.length)
      })
      await pipeline(body, fs.createWriteStream(tmp))
      if (hash.digest('hex') !== sha1) throw new Error('el archivo llegó dañado')
      await fsp.rename(tmp, dest)
      return
    } catch (err) {
      await fsp.rm(tmp, { force: true })
      if (attempt >= 3) throw new Error(`No se pudo descargar ${path.basename(dest)}: ${err.message}`)
    }
  }
}

// Deja la instancia igual al manifiesto: baja lo que falta o cambió y quita mods que ya no van.
async function syncFiles(manifest, instanceDir, progress, { repair = false } = {}) {
  const indexFile = path.join(instanceDir, '.lagang-files.json')
  const index = repair ? {} : readJson(indexFile, {})
  const pending = []
  for (const file of manifest.files) {
    const dest = path.join(instanceDir, file.path)
    const stat = fs.statSync(dest, { throwIfNoEntry: false })
    const cached = index[file.path]
    const fresh = stat && stat.size === file.size &&
      (cached?.sha1 === file.sha1 && cached.mtime === stat.mtimeMs || (await sha1File(dest)) === file.sha1)
    if (fresh) index[file.path] = { sha1: file.sha1, mtime: stat.mtimeMs }
    else pending.push(file)
  }

  const wanted = new Set(manifest.files.map((f) => path.normalize(f.path)))
  for (const dir of manifest.managed) {
    const abs = path.join(instanceDir, dir)
    if (!fs.existsSync(abs)) continue
    for (const entry of await fsp.readdir(abs, { withFileTypes: true })) {
      const rel = path.normalize(path.join(dir, entry.name))
      if (entry.isFile() && !wanted.has(rel)) {
        await fsp.rm(path.join(abs, entry.name), { force: true })
        delete index[rel.replaceAll('\\', '/')]
      }
    }
  }

  const totalBytes = pending.reduce((sum, f) => sum + f.size, 0)
  let doneBytes = 0
  let doneFiles = 0
  const report = () => progress({
    stage: 'mods',
    label: `Sincronizando mods (${doneFiles}/${pending.length})`,
    ratio: totalBytes ? doneBytes / totalBytes : 1,
  })
  if (pending.length) report()
  const queue = [...pending]
  let lastReport = 0
  const worker = async () => {
    for (let file; (file = queue.shift());) {
      const dest = path.join(instanceDir, file.path)
      await download(file.url, dest, file.sha1, (n) => {
        doneBytes += n
        if (Date.now() - lastReport > 100) {
          lastReport = Date.now()
          report()
        }
      })
      index[file.path] = { sha1: file.sha1, mtime: fs.statSync(dest).mtimeMs }
      doneFiles++
      report()
    }
  }
  try {
    await Promise.all(Array.from({ length: 6 }, worker))
  } finally {
    await writeJson(indexFile, index)
  }
  return pending.length
}

// Primera vez: español y sin el tutorial. Después se respeta lo que el jugador cambie.
async function seedOptions(instanceDir) {
  const file = path.join(instanceDir, 'options.txt')
  if (fs.existsSync(file)) return
  await fsp.mkdir(instanceDir, { recursive: true })
  await fsp.writeFile(file, 'lang:es_es\ntutorialStep:none\nskipMultiplayerWarning:true\nonboardAccessibility:false\n')
}

async function prepare(server, manifest, progress, options = {}) {
  const instanceDir = paths.instance(server.id)
  const javaPath = await ensureJava(manifest.java, progress)
  const versionId = await ensureGame(manifest, javaPath, progress, options)
  await syncFiles(manifest, instanceDir, progress, options)
  await seedOptions(instanceDir)
  return { javaPath, versionId, instanceDir }
}

module.exports = { prepare }
