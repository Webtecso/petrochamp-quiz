const fs = require("fs")

const filePath = "src\\main\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `  function runPrismaMigrations(backendPath: string, dbPath: string): Promise<void> {
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
          DATABASE_URL: "file:" + dbPath.replace(/\\\\/g, "/")
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
  }`

const count = content.split(anchor).length - 1
console.log("ancora R1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora R1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `  function runPrismaDbPush(backendPath: string, dbPath: string): Promise<void> {
    return new Promise((resolve) => {
      const prismaCliEntry = join(backendPath, "node_modules", "prisma", "build", "index.js")
      logToFile("A tentar 'prisma db push' como recuperacao (base de dados legada sem historico de migracoes)...")

      const pushProcess = spawn(
        process.execPath,
        [prismaCliEntry, "db", "push", "--skip-generate", "--accept-data-loss"],
        {
          cwd: backendPath,
          shell: false,
          windowsHide: true,
          stdio: "pipe",
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            DATABASE_URL: "file:" + dbPath.replace(/\\\\/g, "/")
          }
        }
      )

      pushProcess.stdout?.on("data", (data: Buffer) => {
        const text = data.toString("utf8").trim()
        if (text) logToFile("[DB Push] " + text)
      })

      pushProcess.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf8").trim()
        if (text) logToFile("[DB Push Error] " + text)
      })

      pushProcess.on("error", (err) => {
        logToFile("Falha ao arrancar 'prisma db push': " + err)
        resolve()
      })

      pushProcess.on("exit", (code) => {
        logToFile("'prisma db push' terminou, codigo: " + code)
        resolve()
      })
    })
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
          DATABASE_URL: "file:" + dbPath.replace(/\\\\/g, "/")
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

      migrateProcess.on("exit", async (code) => {
        logToFile("Migrate deploy terminou, codigo: " + code)
        if (code !== 0) {
          await runPrismaDbPush(backendPath, dbPath)
        }
        resolve()
      })
    })
  }`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: src/main/index.ts atualizado.")
