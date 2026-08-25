import { app, shell, BrowserWindow, screen, session } from 'electron'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import http from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  let backendProcess: ChildProcess | null = null

  function startLocalBackend(): void {
    if (backendProcess) return
    const backendPath = join(app.getAppPath(), 'petrochamp-backend')
    console.log('A arrancar backend local em:', backendPath)

    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: backendPath,
      shell: true,
      stdio: 'pipe'
    })

    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf8').trim()
        if (text) console.log(`[Backend] ${text}`)
      })
    }

    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf8').trim()
        if (text) console.error(`[Backend Error] ${text}`)
      })
    }

    backendProcess.on('exit', (code) => {
      console.log('Backend local terminou, código:', code)
      backendProcess = null
    })
  }

  function stopLocalBackend(): void {
    if (backendProcess) {
      if (process.platform === 'win32' && backendProcess.pid) {
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t'], { windowsHide: true })
      } else {
        backendProcess.kill()
      }
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

  // (Bloco 3) — dispara a sincronização com o Cloud através do próprio
  // backend Local (que já sabe se há Internet e onde fica o Cloud, via
  // CLOUD_API_URL no seu .env). Não bloqueia a abertura das janelas: corre
  // "fire and forget" com um timeout de segurança, e falha em silêncio se
  // não houver Internet — a app abre sempre, sincronizada ou não.
  function triggerSyncInBackground(): void {
    const req = http.request(
      'http://localhost:4000/api/sync/run',
      { method: 'POST', timeout: 20000 },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            if (parsed.ran) {
              console.log('Sincronização com o Cloud concluída ao abrir a app.', parsed)
            } else {
              console.log('Sincronização não correu (provavelmente sem Internet):', parsed.reason)
            }
          } catch {
            console.log('Resposta de sincronização não interpretável.')
          }
        })
      }
    )
    req.on('error', (error) => {
      console.log('Não foi possível contactar o serviço de sincronização local:', error.message)
    })
    req.end()
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
      // ALTERADO — timeout aumentado de 20s para 40s: na primeira vez que
      // o tsx compila tudo, o backend pode demorar mais que 20s a arrancar,
      // fazendo o waitForBackend desistir antes de hora.
      await waitForBackend('http://localhost:4000/health', 40000)
      console.log('Backend local pronto.')
      // ALTERADO — triggerSyncInBackground() só corre aqui dentro, depois
      // de confirmado que o backend respondeu. Antes corria sempre, mesmo
      // quando o waitForBackend falhava por timeout — nesse caso a
      // sincronização tentava ligar-se a um backend que ainda nem estava
      // de pé, e falhava sempre com "connection refused".
      triggerSyncInBackground()
    } catch (error) {
      console.error('Não foi possível confirmar o arranque do backend local:', error)
      console.log('Sincronização saltada nesta sessão — tenta novamente na próxima abertura da app.')
    }

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
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    stopLocalBackend()
  })
}
