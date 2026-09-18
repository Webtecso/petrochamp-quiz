const fs = require("fs")
const path = require("path")

const filePath = path.join(".", "src", "main", "index.ts")

const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")
const original = content

const anchor = `  function createProjectionWindow(): void {
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
    })`

const replacement = `  function createProjectionWindow(): void {
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
    })`

const count = content.split(anchor).length - 1
console.log(`ancora: encontrada ${count}x`)
if (count !== 1) {
  console.error("Abortado: ancora nao encontrada exatamente 1x.")
  process.exit(1)
}
content = content.replace(anchor, replacement)

if (content === original) {
  console.error("Nenhuma alteracao foi aplicada.")
  process.exit(1)
}

if (hasCRLF) content = content.replace(/\n/g, "\r\n")

fs.writeFileSync(filePath, content, "utf8")
console.log(`OK: ${filePath} atualizado.`)
