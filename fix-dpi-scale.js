const fs = require("fs")

function checkAnchor(content, anchor, label, expected = 1) {
  const count = content.split(anchor).length - 1
  console.log("ancora [" + label + "]: encontrada " + count + "x (esperado " + expected + ")")
  if (count !== expected) {
    console.error("ABORTADO: ancora [" + label + "] nao bateu " + expected + "x.")
    process.exit(1)
  }
  return count
}

const filePath = "src\\main\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// --- Anchor 1: appendSwitch existentes, para adicionar as duas novas flags de DPI ---
const anchor1 = `app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')`
checkAnchor(content, anchor1, "1 - appendSwitch block")

const repl1 = anchor1 + `
// NOVO - forca um fator de escala consistente em todas as janelas,
// independentemente da escala (DPI) configurada em cada monitor no
// Windows. Sem isto, quando o monitor de projecao tem uma escala
// diferente do monitor principal (ex: portatil a 125%, projetor a 100%),
// o Chromium pode medir clientWidth/clientHeight errados, fazendo o
// algoritmo de auto-fit do texto da pergunta calcular tamanhos
// inconsistentes (texto pequeno demais, cortado, ou por vezes nem
// aparecer) - exatamente o sintoma relatado, e que so acontece em PCs
// com configuracao de monitores diferente da maquina de desenvolvimento.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('high-dpi-support', '1')`

content = content.replace(anchor1, repl1)

// --- Anchor 2: dentro de createProjectionWindow, logar o scaleFactor de cada monitor ---
const anchor2 = `    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const targetDisplay =
      displays.find((d) => d.id !== primaryDisplay.id) ?? primaryDisplay`
checkAnchor(content, anchor2, "2 - displays/targetDisplay")

const repl2 = anchor2 + `

    // NOVO - regista o scaleFactor (DPI) de cada monitor detetado, para
    // diagnosticar problemas de dimensionamento do texto reportados em
    // PCs de clientes com configuracoes de ecra diferentes da maquina de
    // desenvolvimento. Consultar main.log apos reproduzir o problema.
    displays.forEach((d) => {
      logToFile(
        '[projecao] monitor id=' + d.id +
        ' bounds=' + JSON.stringify(d.bounds) +
        ' scaleFactor=' + d.scaleFactor +
        (d.id === targetDisplay.id ? ' <- ESCOLHIDO PARA PROJECAO' : '')
      )
    })`

content = content.replace(anchor2, repl2)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: src/main/index.ts atualizado com force-device-scale-factor e log de monitores.")
