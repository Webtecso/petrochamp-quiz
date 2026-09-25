const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `      flow.currentPage = Math.max(1, flow.currentPage - 1)

      broadcast()
    })

    socket.on(
      'juror:setPresentationScore',`

const count = content.split(anchor).length - 1
console.log("ancora: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `      flow.currentPage = Math.max(1, flow.currentPage - 1)

      broadcast()
    })

    // NOVO - paginacao de enunciados analiticos longos (resposta aberta ou
    // multipla escolha com texto extenso). Segue o mesmo padrao de
    // presentationNextPage/PrevPage, mas calcula o total de paginas na hora
    // porque o texto vive na BD (EvaluationItem.text), nao no liveState.
    socket.on('moderator:analyticNextPage', async () => {
      if (liveState.currentItemSource !== 'analytic' || !liveState.currentAnalyticItemId) return
      const item = await prisma.evaluationItem.findUnique({
        where: { id: liveState.currentAnalyticItemId }
      })
      if (!item) return
      const totalPages = paginateText(item.text, ANALYTIC_PAGE_MAX_CHARS).length
      if (liveState.analyticQuestionPage >= totalPages) return
      liveState.analyticQuestionPage += 1
      broadcast()
    })

    socket.on('moderator:analyticPrevPage', () => {
      if (liveState.currentItemSource !== 'analytic' || !liveState.currentAnalyticItemId) return
      liveState.analyticQuestionPage = Math.max(1, liveState.analyticQuestionPage - 1)
      broadcast()
    })

    socket.on(
      'juror:setPresentationScore',`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-analytic-handlers", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: handlers moderator:analyticNextPage/PrevPage adicionados.")
