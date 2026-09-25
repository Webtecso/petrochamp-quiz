const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ModeradorDashboard.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const edits = [
  {
    name: "ModeratorAnswerPicker do desempate (tiebreak/3o-4o)",
    anchor: `        :team-a-answer="tiebreakTeamAAnswer"
        :team-b-answer="tiebreakTeamBAnswer"
        @pick="pickActiveTiebreakAnswer"`,
    replacement: `        :team-a-answer="tiebreakTeamAAnswer"
        :team-b-answer="tiebreakTeamBAnswer"
        :team-a-correct="tiebreakTeamACorrect"
        :team-b-correct="tiebreakTeamBCorrect"
        @pick="pickActiveTiebreakAnswer"`
  },
  {
    name: "ModeratorAnswerPicker do Quiz normal",
    anchor: `        :team-a-answer="store.teamAAnswer"
        :team-b-answer="store.teamBAnswer"
        @pick="pickAnswer"`,
    replacement: `        :team-a-answer="store.teamAAnswer"
        :team-b-answer="store.teamBAnswer"
        :team-a-correct="store.teamACorrect"
        :team-b-correct="store.teamBCorrect"
        @pick="pickAnswer"`
  }
]

let ok = true
for (const e of edits) {
  const count = content.split(e.anchor).length - 1
  console.log("ancora [" + e.name + "]: " + count + "x")
  if (count !== 1) { console.error("  -> Abortado."); ok = false }
}
if (!ok) { console.error("Abortado: nada foi escrito."); process.exit(1) }
for (const e of edits) content = content.replace(e.anchor, e.replacement)

fs.writeFileSync(filePath + ".bak-picker-correct", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ModeratorAnswerPicker agora recebe teamACorrect/teamBCorrect nos dois usos.")
