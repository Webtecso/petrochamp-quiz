const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `      // CORRIGIDO - usava 8000ms fixo, independente da duracao configurada
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

const count = content.split(anchor).length - 1
console.log("ancora [minimo de seguranca do carrossel]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `      // CORRIGIDO - usava 8000ms fixo, independente da duracao configurada
      // no Admin (partnersDurationSeconds) e do tempo real que o carrossel
      // de parceiros (PartnerCarousel.vue, animacao CSS de 16s por volta)
      // precisa para dar pelo menos uma volta completa. Isso cortava a
      // sequencia a meio sempre que a volta demorava mais de 8s.
      //
      // CORRIGIDO #2 - mesmo respeitando partnersDurationSeconds, ainda
      // cortava os ultimos parceiros: o PartnerCarousel.vue so comeca a
      // animar depois de fetchPartners() (chamada de rede) resolver, mas
      // este setTimeout comeca a contar antes disso. Impomos um minimo
      // absoluto que cobre uma volta completa da animacao (16s) mais uma
      // margem para o carregamento dos dados/imagens, mesmo que o valor
      // configurado no Admin seja menor.
      const ANIMATION_LOOP_SECONDS = 16
      const LOAD_MARGIN_SECONDS = 5
      const configuredSeconds = await getPartnersDurationSeconds()
      const seconds = Math.max(configuredSeconds, ANIMATION_LOOP_SECONDS + LOAD_MARGIN_SECONDS)
      setTimeout(() => {
        liveState.phaseTransition.stage = 'webtec'
        broadcast()
      }, seconds * 1000)
    })`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-partners-min-safety", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: minimo de seguranca (21s) garantido para o carrossel de parceiros, cobrindo a animacao + latencia de carregamento.")
