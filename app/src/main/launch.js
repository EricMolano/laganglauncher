const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { launch, createMinecraftProcessWatcher } = require('@xmcl/core')
const paths = require('./paths')

const JVM_FLAGS = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:InitiatingHeapOccupancyPercent=15',
]

// Lanza Minecraft conectando directo al servidor. Los eventos se informan con `on`.
async function start({ server, profile, accessToken, userType = 'legacy', memory, prepared, on }) {
  fs.mkdirSync(paths.logs, { recursive: true })
  const log = fs.createWriteStream(path.join(paths.logs, `${server.id}.log`))
  const proc = await launch({
    gamePath: prepared.instanceDir,
    resourcePath: paths.shared,
    javaPath: prepared.javaPath,
    version: prepared.versionId,
    gameProfile: profile,
    accessToken: accessToken ?? crypto.randomBytes(16).toString('hex'),
    userType,
    minMemory: Math.min(2048, memory),
    maxMemory: memory,
    launcherName: 'La Gang',
    launcherBrand: 'lagang',
    quickPlayMultiplayer: `${server.host}:${server.port}`,
    extraJVMArgs: JVM_FLAGS,
    extraExecOption: { detached: false, windowsHide: true },
  })
  proc.stdout?.pipe(log)
  proc.stderr?.pipe(log)
  const watcher = createMinecraftProcessWatcher(proc)
  watcher.on('minecraft-window-ready', () => on('ready'))
  watcher.on('minecraft-exit', (e) => on('exit', { code: e.code, crashReport: e.crashReportLocation || null }))
  watcher.on('error', (err) => on('exit', { code: -1, error: String(err?.message ?? err) }))
  return proc
}

module.exports = { start }
