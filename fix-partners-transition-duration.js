const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `    socket.on('moderator:showPhaseTransition', () => {
      liveState.phaseTransition.stage = 'carousel'
      broadcast()
      setTimeout(() => {
        liveState.phaseTransition.stage = 'webtec'
        broadcast()
      }, 8000)
    })`

const count = content.split(anchor).length - 1
console.log("ancora [showPhaseTransition 8000ms fixo]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `    socket.on('moderator:showPhaseTransition', async () => {
      liveState.phaseTransition.stage = 'carousel'
      broadcast()
      // CORRIGIDO - usava 8000ms fixo, independente da duracao configurada
      // no Admin (partnersDurationSeconds) e do tempo real que o carrossel
      // de parceiros (PartnerCarousel.vue, animacao CSS de 16s por volta)
      // precisa para dar pelo menos uma volta completa. Isso cortava a
      // sequencia a meio sempre que a volta demorava mais de 8s.
      const seconds = await getPartnersDurationSeconds()
      setTimeout(() => {
        liveState.phaseTransition.stage = 'webtec'
        broadcast()
      }, seconds * 1000)
    })`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-partners-transition", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: showPhaseTransition agora usa a duracao configurada dos parceiros em vez de 8000ms fixo.")
