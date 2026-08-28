import { app, shell, BrowserWindow, screen, session } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync, mkdirSync, appendFileSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import http from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// NOVO — log persistente em ficheiro. Numa app empacotada (subsistema
// Windows GUI), o stdout/console.log do processo principal não aparece em
// lado nenhum visível — mesmo correndo o .exe a partir de um terminal.
// Sem isto, um problema no arranque do backend em produção é invisível.
// O ficheiro fica em %APPDATA%\petrochamp-quiz\logs\main.log.
function logToFile(message: string): void {
  try {
    const logsDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logsDir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${message}\n`
    appendFileSync(join(logsDir, 'main.log'), line, 'utf8')
  } catch {
    // Se nem o log conseguir escrever, não há nada a fazer — não deixamos
    // isto rebentar a app.
  }
}

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

  // NOVO — garante que existe uma base de dados gravável em userData antes
  // de arrancar o backend em produção. A pasta de instalação (resources/)
  // não é local seguro para gravar (fica só de leitura em muitos setups, e
  // é apagada/substituída em cada atualização). userData é a pasta correta
  // e persistente por utilizador (ex: %APPDATA%\petrochamp-quiz).
  function ensureProdDatabase(): string {
    const userDataDir = app.getPath('userData')
    const dbPath = join(userDataDir, 'petrochamp.db')

    if (!existsSync(dbPath)) {
      const seedPath = join(process.resourcesPath, 'petrochamp-backend', 'seed.db')
      if (existsSync(seedPath)) {
        mkdirSync(userDataDir, { recursive: true })
        copyFileSync(seedPath, dbPath)
        console.log('Base de dados inicial copiada para:', dbPath)
        logToFile(`Base de dados inicial copiada para: ${dbPath}`)
      } else {
        console.warn('Aviso: seed.db não encontrado em resources. O backend vai criar a base de dados do zero.')
        logToFile(`Aviso: seed.db não encontrado em resources (esperado em: ${seedPath}). O backend vai criar a base de dados do zero.`)
      }
    } else {
      logToFile(`Base de dados já existia em: ${dbPath}`)
    }

    return dbPath
  }

  function startLocalBackend(): void {
    if (backendProcess) return

    logToFile(`startLocalBackend chamado. is.dev=${is.dev}`)

    if (is.dev) {
      const backendPath = join(app.getAppPath(), 'petrochamp-backend')
      console.log('A arrancar backend local (dev) em:', backendPath)
      logToFile(`A arrancar backend local (dev) em: ${backendPath}`)

      backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: backendPath,
        shell: true,
        stdio: 'pipe'
      })
    } else {
      // PRODUÇÃO — corre o backend já compilado (dist/index.js) com o
      // próprio binário do Electron em modo "run as node", em vez de
      // depender de `npm`/`tsx` que não fazem parte do pacote final e de
      // depender de o utilizador ter Node.js instalado na máquina.
      const backendPath = join(process.resourcesPath, 'petrochamp-backend')
      const entryPoint = join(backendPath, 'dist', 'index.js')
      const dbPath = ensureProdDatabase()

      console.log('A arrancar backend local (produção) em:', backendPath)
      logToFile(`A arrancar backend local (produção). backendPath=${backendPath} entryPoint=${entryPoint} entryPointExiste=${existsSync(entryPoint)} dbPath=${dbPath}`)

      backendProcess = spawn(process.execPath, [entryPoint], {
        cwd: backendPath,
        shell: false,
        stdio: 'pipe',
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: `file:${dbPath}`,
          UPLOADS_DIR: join(app.getPath('userData'), 'uploads'),
          PORT: '4000'
        }
      })
    }

    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf8').trim()
        if (text) {
          console.log(`[Backend] ${text}`)
          logToFile(`[Backend] ${text}`)
        }
      })
    }

    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf8').trim()
        if (text) {
          console.error(`[Backend Error] ${text}`)
          logToFile(`[Backend Error] ${text}`)
        }
      })
    }

    backendProcess.on('error', (err) => {
      console.error('Falha ao arrancar o processo do backend:', err)
      logToFile(`Falha ao arrancar o processo do backend: ${err}`)
    })

    backendProcess.on('exit', (code) => {
      console.log('Backend local terminou, código:', code)
      logToFile(`Backend local terminou, código: ${code}`)
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

    logToFile('=== App a arrancar ===')
    startLocalBackend()
    try {
      await waitForBackend('http://localhost:4000/health', 40000)
      console.log('Backend local pronto.')
      logToFile('Backend local pronto (respondeu a /health).')
      triggerSyncInBackground()
    } catch (error) {
      console.error('Não foi possível confirmar o arranque do backend local:', error)
      logToFile(`Não foi possível confirmar o arranque do backend local: ${error}`)
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
