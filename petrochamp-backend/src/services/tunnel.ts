import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import fs from 'fs'
import { liveState } from '../socket/liveState'

const LOCAL_TARGET = 'http://localhost:4000'
const URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
const STARTUP_TIMEOUT_MS = 30000
const RESTART_DELAY_MS = 5000
const MAX_AUTO_RESTARTS = 5

let tunnelProcess: ChildProcessWithoutNullStreams | null = null
let broadcastFn: (() => void) | null = null
let startupTimeoutHandle: ReturnType<typeof setTimeout> | null = null
let restartCount = 0
let manuallyStopped = false
let outputBuffer = ''

export type TunnelStatus = 'idle' | 'starting' | 'online' | 'failed'

function setStatus(status: TunnelStatus): void {
  liveState.publicVotingStatus = status
  broadcastFn?.()
}

function resolveCloudflaredPath(): string {
  const resourcesPath = (process as any).resourcesPath as string | undefined
  if (resourcesPath) {
    const bundled = path.join(resourcesPath, 'cloudflared', 'cloudflared.exe')
    if (fs.existsSync(bundled)) return bundled
  }
  return 'cloudflared'
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

function clearStartupTimeout(): void {
  if (startupTimeoutHandle) {
    clearTimeout(startupTimeoutHandle)
    startupTimeoutHandle = null
  }
}

function handleOutput(chunk: Buffer): void {
  if (liveState.publicVotingUrl) return

  outputBuffer += stripAnsi(chunk.toString())
  if (outputBuffer.length > 5000) {
    outputBuffer = outputBuffer.slice(-2000)
  }

  const match = outputBuffer.match(URL_REGEX)
  if (match) {
    clearStartupTimeout()
    liveState.publicVotingUrl = `${match[0]}/portal/votacao.html`
    restartCount = 0
    setStatus('online')
    console.log(`[tunnel] Portal de votação disponível em: ${liveState.publicVotingUrl}`)
  }
}

function launch(): void {
  const cloudflaredPath = resolveCloudflaredPath()
  console.log('[tunnel] A iniciar túnel Cloudflare com:', cloudflaredPath)
  setStatus('starting')
  outputBuffer = ''
  liveState.publicVotingUrl = null

  try {
    tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', LOCAL_TARGET])
  } catch (err) {
    console.error('[tunnel] Falha ao lançar cloudflared:', err)
    setStatus('failed')
    return
  }

  startupTimeoutHandle = setTimeout(() => {
    if (!liveState.publicVotingUrl) {
      console.error('[tunnel] Túnel não respondeu dentro do tempo limite.')
      setStatus('failed')
    }
  }, STARTUP_TIMEOUT_MS)

  tunnelProcess.stdout.on('data', handleOutput)
  tunnelProcess.stderr.on('data', handleOutput)

  tunnelProcess.on('error', (err) => {
    console.error('[tunnel] Falha ao iniciar cloudflared:', err.message)
    setStatus('failed')
  })

  tunnelProcess.on('exit', (code) => {
    console.log(`[tunnel] Processo cloudflared terminou (código ${code})`)
    clearStartupTimeout()
    tunnelProcess = null
    liveState.publicVotingUrl = null

    if (manuallyStopped) {
      setStatus('idle')
      return
    }

    if (restartCount >= MAX_AUTO_RESTARTS) {
      console.error('[tunnel] Número máximo de tentativas de reinício atingido — a desistir.')
      setStatus('failed')
      return
    }

    restartCount += 1
    console.log(`[tunnel] A tentar reiniciar o túnel em ${RESTART_DELAY_MS / 1000}s (tentativa ${restartCount}/${MAX_AUTO_RESTARTS})...`)
    setStatus('starting')
    setTimeout(() => {
      if (!manuallyStopped) launch()
    }, RESTART_DELAY_MS)
  })
}

export function startPublicTunnel(broadcast: () => void): void {
  if (tunnelProcess) return
  manuallyStopped = false
  restartCount = 0
  broadcastFn = broadcast
  launch()
}

export function stopPublicTunnel(): void {
  manuallyStopped = true
  clearStartupTimeout()
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
  }
  setStatus('idle')
}
