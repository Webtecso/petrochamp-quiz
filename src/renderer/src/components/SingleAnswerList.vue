<script setup lang="ts">
interface Option {
  label: string
  text: string
}

const props = defineProps<{
  options: Option[]
  correctIndex: number
  answer: string | null
  correct: boolean | null
}>()

function cls(index: number, label: string): string {
  if (props.answer === label && props.correct === true) return 'bg-green-500 text-white border-green-500'
  if (props.answer === label && props.correct === false) return 'bg-red-500 text-white border-red-500'
  if (props.correct === false && index === props.correctIndex) return 'bg-green-500 text-white border-green-500'
  return 'border-gray-200'
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <div
      v-for="(opt, i) in options"
      :key="opt.label"
      class="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-all duration-300"
      :class="cls(i, opt.label)"
    >
      <span
        class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-petro-primary/10 text-petro-primary"
        :class="cls(i, opt.label) !== 'border-gray-200' ? 'bg-white/20 text-white' : ''"
      >
        {{ opt.label }}
      </span>
      {{ opt.text }}
    </div>
  </div>
</template>
