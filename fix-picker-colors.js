const fs = require("fs")
const filePath = "src\\renderer\\src\\components\\ModeratorAnswerPicker.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const edits = [
  {
    name: "props novos: teamACorrect/teamBCorrect",
    anchor: `const props = defineProps<{
  teamAName: string
  teamAOptions: OptionInput[]
  teamAAnswer: string | null
  teamBName: string
  teamBOptions: OptionInput[]
  teamBAnswer: string | null
}>()`,
    replacement: `const props = defineProps<{
  teamAName: string
  teamAOptions: OptionInput[]
  teamAAnswer: string | null
  teamACorrect?: boolean | null
  teamBName: string
  teamBOptions: OptionInput[]
  teamBAnswer: string | null
  teamBCorrect?: boolean | null
}>()`
  },
  {
    name: "funcao de classe do botao A (cor por certo/errado)",
    anchor: `        <template v-if="formattedTeamAOptions.length > 0">
          <button
            v-for="opt in formattedTeamAOptions"
            :key="opt.label"
            type="button"
            class="w-10 h-10 rounded-full text-sm font-bold border transition flex items-center justify-center cursor-pointer shadow-sm"
            :class="teamAAnswer === opt.label ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-300 text-gray-700 hover:border-petro-primary hover:bg-gray-50'"
            :disabled="!!teamAAnswer"
            @click="emit('pick', 'A', opt.label)"
          >`,
    replacement: `        <template v-if="formattedTeamAOptions.length > 0">
          <button
            v-for="opt in formattedTeamAOptions"
            :key="opt.label"
            type="button"
            class="w-10 h-10 rounded-full text-sm font-bold border transition flex items-center justify-center cursor-pointer shadow-sm"
            :class="
              teamAAnswer === opt.label && teamACorrect === true
                ? 'bg-green-500 text-white border-green-500'
                : teamAAnswer === opt.label && teamACorrect === false
                  ? 'bg-red-500 text-white border-red-500'
                  : teamAAnswer === opt.label
                    ? 'bg-petro-primary text-white border-petro-primary'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-petro-primary hover:bg-gray-50'
            "
            :disabled="!!teamAAnswer"
            @click="emit('pick', 'A', opt.label)"
          >`
  },
  {
    name: "funcao de classe do botao B (cor por certo/errado)",
    anchor: `        <template v-if="formattedTeamBOptions.length > 0">
          <button
            v-for="opt in formattedTeamBOptions"
            :key="opt.label"
            type="button"
            class="w-10 h-10 rounded-full text-sm font-bold border transition flex items-center justify-center cursor-pointer shadow-sm"
            :class="teamBAnswer === opt.label ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-300 text-gray-700 hover:border-petro-primary hover:bg-gray-50'"
            :disabled="!!teamBAnswer"
            @click="emit('pick', 'B', opt.label)"
          >`,
    replacement: `        <template v-if="formattedTeamBOptions.length > 0">
          <button
            v-for="opt in formattedTeamBOptions"
            :key="opt.label"
            type="button"
            class="w-10 h-10 rounded-full text-sm font-bold border transition flex items-center justify-center cursor-pointer shadow-sm"
            :class="
              teamBAnswer === opt.label && teamBCorrect === true
                ? 'bg-green-500 text-white border-green-500'
                : teamBAnswer === opt.label && teamBCorrect === false
                  ? 'bg-red-500 text-white border-red-500'
                  : teamBAnswer === opt.label
                    ? 'bg-petro-primary text-white border-petro-primary'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-petro-primary hover:bg-gray-50'
            "
            :disabled="!!teamBAnswer"
            @click="emit('pick', 'B', opt.label)"
          >`
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

fs.writeFileSync(filePath + ".bak-correct-colors", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ModeratorAnswerPicker.vue agora colore verde/vermelho por certo/errado.")
