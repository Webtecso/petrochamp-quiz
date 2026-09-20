import { app, shell, BrowserWindow, screen, session, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
// import { pathToFileURL } from 'url'
import { existsSync, copyFileSync, mkdirSync, appendFileSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import http from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function logToFile(message: string): void {
  try {
    const logsDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logsDir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${message}\n`
    appendFileSync(join(logsDir, 'main.log'), line, 'utf8')
  } catch {
    // Se nem o log conseguir escrever, não há nada a fazer - não deixamos
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

  function runPrismaMigrations(backendPath: string, dbPath: string): Promise<void> {
    return new Promise((resolve) => {
      const prismaCliEntry = join(backendPath, "node_modules", "prisma", "build", "index.js")

      if (!existsSync(prismaCliEntry)) {
        logToFile("Aviso: CLI do Prisma nao encontrado em " + prismaCliEntry + ". A saltar migrate deploy.")
        resolve()
        return
      }

      logToFile("A aplicar migracoes pendentes a: " + dbPath)

      const migrateProcess = spawn(process.execPath, [prismaCliEntry, "migrate", "deploy"], {
        cwd: backendPath,
        shell: false,
        windowsHide: true,
        stdio: "pipe",
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          DATABASE_URL: "file:" + dbPath.replace(/\\/g, "/")
        }
      })

      migrateProcess.stdout?.on("data", (data: Buffer) => {
        const text = data.toString("utf8").trim()
        if (text) logToFile("[Migrate] " + text)
      })

      migrateProcess.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf8").trim()
        if (text) logToFile("[Migrate Error] " + text)
      })

      migrateProcess.on("error", (err) => {
        logToFile("Falha ao arrancar o processo de migracao: " + err)
        resolve()
      })

      migrateProcess.on("exit", (code) => {
        logToFile("Migrate deploy terminou, codigo: " + code)
        resolve()
      })
    })
  }

  async function startLocalBackend(): Promise<void> {
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
      const backendPath = join(process.resourcesPath, 'petrochamp-backend')
      const entryPoint = join(backendPath, 'dist', 'index.js')
      const dbPath = ensureProdDatabase()

      await runPrismaMigrations(backendPath, dbPath)

      logToFile(
        `A arrancar backend local (produção). backendPath=${backendPath} entryPoint=${entryPoint} entryPointExiste=${existsSync(entryPoint)} cwdExiste=${existsSync(backendPath)} dbPath=${dbPath} execPath=${process.execPath}`
      )

      if (!existsSync(entryPoint) || !existsSync(backendPath)) {
        logToFile('ABORTADO: petrochamp-backend não foi empacotado em extraResources.')
        return
      }

      backendProcess = spawn(process.execPath, [entryPoint], {
        cwd: backendPath,
        shell: false,
        windowsHide: true,
        stdio: 'pipe',
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: `file:${dbPath.replace(/\\/g, '/')}`,
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

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve()
              return
            }

            if (Date.now() - start > timeoutMs) {
              reject(new Error(`Backend respondeu com HTTP ${res.statusCode}`))
              return
            }

            setTimeout(attempt, 400)
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
    // Escolhe sempre um ecra de destino de forma robusta, sem depender
    // da heuristica antiga (bounds.x !== 0 || bounds.y !== 0), que falha
    // quando o segundo ecra tambem tem bounds.x === 0 (ex. disposicao
    // vertical) ou quando so ha um ecra ligado durante testes. Preferimos
    // o ecra NAO-primario se existir mais que um; caso contrario usamos
    // o primario. Definimos os bounds explicitamente, sem depender de
    // maximize(), que se comporta de forma inconsistente entre setups.
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const targetDisplay =
      displays.find((d) => d.id !== primaryDisplay.id) ?? primaryDisplay

    const projectionWindow = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
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
      projectionWindow.setBounds(targetDisplay.bounds)
      projectionWindow.show()
      projectionWindow.setFullScreen(true)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      projectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/projecao')
    } else {
      projectionWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/projecao' })
    }
  }

  function initAutoUpdater(): void {
    if (is.dev) {
      logToFile('[auto-update] Saltado - ambiente de desenvolvimento.')
      return
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('update-available', (info) => {
      logToFile('[auto-update] Nova versao disponivel: ' + info.version)
      const win = BrowserWindow.getAllWindows()[0]
      dialog
        .showMessageBox(win ?? undefined, {
          type: 'info',
          buttons: ['Atualizar agora', 'Mais tarde'],
          defaultId: 0,
          cancelId: 1,
          title: 'Nova versão disponível',
          message: 'Uma nova versão (' + info.version + ') está disponível.',
          detail:
            'Os dados do campeonato, jurados e notas não são afetados pela atualização. Queres transferir e instalar agora?'
        })
        .then((result) => {
          if (result.response === 0) {
            logToFile('[auto-update] Utilizador aceitou - a transferir.')
            autoUpdater.downloadUpdate()
          } else {
            logToFile('[auto-update] Utilizador recusou - pergunta-se de novo na proxima abertura.')
          }
        })
    })

    autoUpdater.on('update-downloaded', (info) => {
      logToFile('[auto-update] Download concluido: ' + info.version)
      const win = BrowserWindow.getAllWindows()[0]
      dialog
        .showMessageBox(win ?? undefined, {
          type: 'info',
          buttons: ['Reiniciar e instalar', 'Mais tarde'],
          defaultId: 0,
          cancelId: 1,
          title: 'Atualização pronta',
          message: 'A atualização foi transferida.',
          detail: 'A app vai fechar e reabrir com a nova versão. Os teus dados mantêm-se.'
        })
        .then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall()
          }
        })
    })

    autoUpdater.on('error', (err) => {
      logToFile('[auto-update] Erro ao verificar/transferir atualizacao: ' + err)
    })

    autoUpdater.checkForUpdates().catch((err) => {
      logToFile('[auto-update] Falha ao verificar atualizacoes: ' + err)
    })
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
    await startLocalBackend()
    try {
      await waitForBackend('http://localhost:4000/health', 40000)
      console.log('Backend local pronto.')
      logToFile('Backend local pronto (respondeu a /health).')
      triggerSyncInBackground()
    } catch (error) {
      console.error('Não foi possível confirmar o arranque do backend local:', error)
      logToFile(`Não foi possível confirmar o arranque do backend local: ${error}`)
      console.log('Sincronização saltada nesta sessão - tenta novamente na próxima abertura da app.')
    }

    createModeratorWindow()
    createProjectionWindow()
    initAutoUpdater()

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
