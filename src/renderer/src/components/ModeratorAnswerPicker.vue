<script setup lang="ts">
import { computed } from 'vue'

type OptionInput = string | { label?: string; text?: string; [key: string]: any }

const props = defineProps<{
  teamAName: string
  teamAOptions: OptionInput[]
  teamAAnswer: string | null
  teamBName: string
  teamBOptions: OptionInput[]
  teamBAnswer: string | null
}>()

const emit = defineEmits<{ pick: [team: 'A' | 'B', label: string] }>()

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// Normaliza as opções garantindo que tenham sempre uma alínea (A, B, C, D) e um texto válido
function normalizeOptions(options: OptionInput[]) {
  if (!Array.isArray(options)) return []
  return options.map((opt, index) => {
    const defaultLabel = LETTERS[index] || String(index + 1)
    if (typeof opt === 'string') {
      return { label: defaultLabel, text: opt }
    }
    return {
      label: opt.label || defaultLabel,
      text: opt.text || opt.label || String(opt)
    }
  })
}

const formattedTeamAOptions = computed(() => normalizeOptions(props.teamAOptions))
const formattedTeamBOptions = computed(() => normalizeOptions(props.teamBOptions))
</script>

<template>
  <div class="grid grid-cols-2 gap-6 w-full max-w-2xl bg-white rounded-2xl shadow p-4">
    <!-- Bloco da Equipa A -->
    <div class="flex flex-col items-center gap-2">
      <span class="text-xs font-semibold text-gray-600">
        {{ teamAName }}
        <span v-if="teamAAnswer" class="text-green-600 font-bold">(Respondeu: {{ teamAAnswer }})</span>
        <span v-else class="text-petro-primary font-bold">(A responder)</span>:
      </span>
      <div class="flex gap-2 min-h-[38px] items-center flex-wrap justify-center">
        <template v-if="formattedTeamAOptions.length > 0">
          <button
            v-for="opt in formattedTeamAOptions"
            :key="opt.label"
            type="button"
            class="w-10 h-10 rounded-full text-sm font-bold border transition flex items-center justify-center cursor-pointer shadow-sm"
            :class="teamAAnswer === opt.label ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-300 text-gray-700 hover:border-petro-primary hover:bg-gray-50'"
            :disabled="!!teamAAnswer"
            @click="emit('pick', 'A', opt.label)"
          >
            {{ opt.label }}
          </button>
        </template>
        <span v-else class="text-xs text-gray-400 italic">Aguardando a vez...</span>
      </div>
    </div>

    <!-- Bloco da Equipa B -->
    <div class="flex flex-col items-center gap-2">
      <span class="text-xs font-semibold text-gray-600">
        {{ teamBName }}
        <span v-if="teamBAnswer" class="text-green-600 font-bold">(Respondeu: {{ teamBAnswer }})</span>
        <span v-else class="text-petro-primary font-bold">(A responder)</span>:
      </span>
      <div class="flex gap-2 min-h-[38px] items-center flex-wrap justify-center">
        <template v-if="formattedTeamBOptions.length > 0">
          <button
            v-for="opt in formattedTeamBOptions"
            :key="opt.label"
            type="button"
            class="w-10 h-10 rounded-full text-sm font-bold border transition flex items-center justify-center cursor-pointer shadow-sm"
            :class="teamBAnswer === opt.label ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-300 text-gray-700 hover:border-petro-primary hover:bg-gray-50'"
            :disabled="!!teamBAnswer"
            @click="emit('pick', 'B', opt.label)"
          >
            {{ opt.label }}
          </button>
        </template>
        <span v-else class="text-xs text-gray-400 italic">Aguardando a vez...</span>
      </div>
    </div>
  </div>
</template>
