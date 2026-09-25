const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `      questionResizeObserver.observe(questionWrapperRef.value)
    }
  } catch (err) {
    console.error('Erro ao carregar dados na Projeção:', err)
  }`

const count = content.split(anchor).length - 1
console.log("ancora: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `      questionResizeObserver.observe(questionWrapperRef.value)
    }

    // NOVO - a fonte Carlito e' custom (@font-face) e pode ainda nao estar
    // carregada quando o primeiro fit corre (sobretudo na 1a execucao apos
    // instalar, antes de qualquer cache de fontes do SO/Chromium). Se isso
    // acontecer, o texto e' medido com a fonte de fallback (mais estreita),
    // o fit calcula um tamanho maior do que cabe de verdade, e nunca mais
    // recalcula. Assim que as fontes ficam prontas, forcamos um novo fit.
    document.fonts?.ready?.then(() => {
      scheduleQuestionFit()
    })
  } catch (err) {
    console.error('Erro ao carregar dados na Projeção:', err)
  }`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-fontfit", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ProjecaoView.vue")
