import { app, shell, BrowserWindow, screen, session } from 'electron'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import http from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe'

let backendProcess: ChildProcess | null = null
let tunnelProcess: ChildProcess | null = null

function startLocalBackend(): void {
  if (backendProcess) return
  const backendPath = join(app.getAppPath(), 'petrochamp-backend')
  console.log('A arrancar backend local em:', backendPath)
  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendPath,
    shell: true,
    stdio: 'inherit'
  })
  backendProcess.on('exit', (code) => {
    console.log('Backend local terminou, código:', code)
    backendProcess = null
  })
}

function stopLocalBackend(): void {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
}

function waitForBackend(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function attempt(): void {
      http
        .get(url, (res) => {
          res.resume()
          resolve()
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error('Backend local não respondeu a tempo'))
            return
          }
          setTimeout(attempt, 400)
        })
    }
    attempt()
  })
}

function reportPublicUrl(url: string): void {
  const publicPortalUrl = `${url}/portal/votacao.html`
  const body = JSON.stringify({ url: publicPortalUrl })
  const req = http.request(
    'http://localhost:4000/api/internal/public-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    },
    (res) => res.resume()
  )
  req.on('error', (err) => console.error('Falha ao reportar URL público:', err))
  req.end(body)
}

function startPublicTunnel(): void {
  if (tunnelProcess) return
  console.log('A arrancar túnel público (cloudflared)...')
  tunnelProcess = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', 'http://localhost:4000'])

  tunnelProcess.on('error', (err) => {
    console.error('Falha ao arrancar o túnel público (cloudflared não encontrado?):', err)
    tunnelProcess = null
  })

  const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

  function handleOutput(chunk: Buffer): void {
    const text = chunk.toString()
    console.log('[cloudflared]', text)
    const match = text.match(urlRegex)
    if (match) {
      console.log('Túnel público disponível em:', match[0])
      reportPublicUrl(match[0])
    }
  }

  tunnelProcess.stdout?.on('data', handleOutput)
  tunnelProcess.stderr?.on('data', handleOutput) // cloudflared escreve o URL no stderr

  tunnelProcess.on('exit', (code) => {
    console.log('Túnel público terminou, código:', code)
    tunnelProcess = null
  })
}

function stopPublicTunnel(): void {
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
  }
}

function createModeratorWindow(): void {
  const moderatorWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'Petrochamp - Moderador',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })

  moderatorWindow.on('ready-to-show', () => {
    moderatorWindow.show()
  })

  moderatorWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    moderatorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    moderatorWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createProjectionWindow(): void {
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0)

  const projectionWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    x: externalDisplay ? externalDisplay.bounds.x + 40 : undefined,
    y: externalDisplay ? externalDisplay.bounds.y + 40 : undefined,
    show: false,
    autoHideMenuBar: true,
    title: 'Petrochamp - Projeção (Telão)',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })

  projectionWindow.on('ready-to-show', () => {
    projectionWindow.show()
    if (externalDisplay) {
      projectionWindow.maximize()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    projectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/projecao')
  } else {
    projectionWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/projecao' })
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.petrochamp.quiz')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  startLocalBackend()
  try {
    await waitForBackend('http://localhost:4000/health', 20000)
    console.log('Backend local pronto.')
  } catch (error) {
    console.error('Não foi possível confirmar o arranque do backend local:', error)
  }

  startPublicTunnel()

  createModeratorWindow()
  createProjectionWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createModeratorWindow()
      createProjectionWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopLocalBackend()
  stopPublicTunnel()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopLocalBackend()
  stopPublicTunnel()
})
