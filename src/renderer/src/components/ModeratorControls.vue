<script setup lang="ts">
defineProps<{
  isRunning: boolean
  dashboardDisabled: boolean
  canFinish: boolean
}>()

const emit = defineEmits<{
  start: []
  pause: []
  finish: []
  dashboard: []
}>()
</script>

<template>
  <footer class="flex items-center justify-center gap-3 bg-petro-dark px-6 py-4 flex-wrap">
    <button
      class="px-4 py-2 rounded-lg bg-white/10 text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed"
      :disabled="dashboardDisabled"
      @click="emit('dashboard')"
    >
      Dashboard
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm"
      :class="isRunning ? 'bg-white/10 text-white' : 'bg-petro-primary text-white'"
      @click="isRunning ? emit('pause') : emit('start')"
    >
      {{ isRunning ? 'Pausar Tempo' : 'Iniciar Tempo' }}
    </button>
    <button
      class="px-4 py-2 rounded-lg bg-white/10 text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed"
      :disabled="!canFinish"
      @click="emit('finish')"
    >
      Finalizar Rodada
    </button>
  </footer>
</template>
