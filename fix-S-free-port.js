const fs = require("fs")

const filePath = "src\\main\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

function applyAnchor(label, anchor, replacement) {
  const count = content.split(anchor).length - 1
  console.log(label + ": encontrada " + count + "x")
  if (count !== 1) {
    console.error("Abortado: " + label + " nao encontrada exatamente 1x.")
    process.exit(1)
  }
  content = content.replace(anchor, replacement)
}

applyAnchor(
  "ancora S1 - antes de stopLocalBackend",
  `  function stopLocalBackend(): void {`,
  `  function freePort(port: number): Promise<void> {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') {
        resolve()
        return
      }

      const netstatProcess = spawn('cmd', ['/c', \`netstat -ano | findstr :\${port}\`], {
        windowsHide: true,
        shell: false,
        stdio: 'pipe'
      })

      let output = ''
      netstatProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString('utf8')
      })

      netstatProcess.on('close', () => {
        const pids = new Set<string>()
        for (const line of output.split('\\n')) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.includes('LISTENING')) continue
          const parts = trimmed.split(/\\s+/)
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0') pids.add(pid)
        }

        if (pids.size === 0) {
          resolve()
          return
        }

        logToFile(\`A porta \${port} esta ocupada por processo(s) orfao(s): \${[...pids].join(', ')}. A libertar...\`)

        let remaining = pids.size
        for (const pid of pids) {
          const killer = spawn('taskkill', ['/pid', pid, '/f', '/t'], { windowsHide: true })
          killer.on('close', () => {
            remaining -= 1
            if (remaining <= 0) resolve()
          })
          killer.on('error', () => {
            remaining -= 1
            if (remaining <= 0) resolve()
          })
        }
      })

      netstatProcess.on('error', () => resolve())
    })
  }

  function stopLocalBackend(): void {`
)

applyAnchor(
  "ancora S2 - antes do spawn de producao",
  `      if (!existsSync(entryPoint) || !existsSync(backendPath)) {
        logToFile('ABORTADO: petrochamp-backend não foi empacotado em extraResources.')
        return
      }

      backendProcess = spawn(process.execPath, [entryPoint], {`,
  `      if (!existsSync(entryPoint) || !existsSync(backendPath)) {
        logToFile('ABORTADO: petrochamp-backend não foi empacotado em extraResources.')
        return
      }

      await freePort(4000)

      backendProcess = spawn(process.execPath, [entryPoint], {`
)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: src/main/index.ts atualizado (freePort antes do backend de producao).")
