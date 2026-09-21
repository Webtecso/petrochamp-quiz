const fs = require("fs")

const filePath = "src\\renderer\\src\\components\\BracketMatchCard.vue"
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
  "ancora H1",
  `function rowClass(team?: Slot): string {
  if (!team) return 'text-gray-300 bg-gray-50 italic'
  if (!props.winnerId) return 'text-gray-700'
  if (team.id === props.winnerId) return 'bg-petro-primary text-white font-semibold winner-pulse'
  return 'text-black line-through opacity-60'
}`,
  `function rowClass(team?: Slot): string {
  if (!team) return 'text-gray-300 bg-gray-50 italic'
  if (!props.winnerId) return 'text-gray-700'
  if (team.id === props.winnerId) return 'bg-petro-primary text-white font-semibold winner-glow'
  return 'text-gray-500 opacity-70'
}`
)

applyAnchor(
  "ancora H2",
  `<style scoped>
.winner-pulse {
  animation: winnerPulse 1s ease;
}
@keyframes winnerPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.5);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(122, 26, 46, 0);
  }
}
</style>`,
  `<style scoped>
.winner-glow {
  animation: winnerGlow 1.8s ease-in-out infinite;
}
@keyframes winnerGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.55), 0 0 12px 2px rgba(122, 26, 46, 0.35);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(122, 26, 46, 0), 0 0 22px 6px rgba(122, 26, 46, 0.6);
  }
}
</style>`
)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: BracketMatchCard.vue atualizado.")
