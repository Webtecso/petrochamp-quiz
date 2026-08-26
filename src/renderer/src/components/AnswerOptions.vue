<script setup lang="ts">
interface Option {
  label: string
  text: string
}

const props = withDefaults(
  defineProps<{
    options: Option[]
    correctIndex?: number
    correctIndexes?: number[]
    teamAAnswer?: string | null
    teamBAnswer?: string | null
    teamACorrect?: boolean | null
    teamBCorrect?: boolean | null
  }>(),
  {}
)

function isCorrectOption(index: number): boolean {
  if (Array.isArray(props.correctIndexes) && props.correctIndexes.length) {
    return props.correctIndexes.includes(index)
  }
  return index === props.correctIndex
}

function optionClass(index: number, label: string): string {
  const anyWrong = props.teamACorrect === false || props.teamBCorrect === false
  if (props.teamAAnswer === label && props.teamACorrect === true) return 'bg-green-500 text-white border-green-500'
  if (props.teamBAnswer === label && props.teamBCorrect === true) return 'bg-green-500 text-white border-green-500'
  if (props.teamAAnswer === label && props.teamACorrect === false) return 'bg-red-500 text-white border-red-500'
  if (props.teamBAnswer === label && props.teamBCorrect === false) return 'bg-red-500 text-white border-red-500'
  if (isCorrectOption(index) && anyWrong) return 'bg-green-500 text-white border-green-500'
  return 'border-gray-200'
}
</script>

<template>
  <div class="grid gap-3" :class="options.length > 4 ? 'grid-cols-2' : 'grid-cols-2'">
    <div
      v-for="(opt, i) in options"
      :key="opt.label"
      class="relative flex items-center gap-2 border rounded-xl px-4 py-3 text-left transition-all duration-300"
      :class="optionClass(i, opt.label)"
    >
      <span
        class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-petro-primary/10 text-petro-primary shrink-0"
        :class="optionClass(i, opt.label) !== 'border-gray-200' ? 'bg-white/20 text-white' : ''"
      >
        {{ opt.label }}
      </span>
      <span class="flex-1">{{ opt.text }}</span>

      <div class="ml-auto flex items-center gap-1 shrink-0">
        <span v-if="teamAAnswer === opt.label" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20">A</span>
        <span v-if="teamBAnswer === opt.label" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20">B</span>
      </div>
    </div>
  </div>
</template>
