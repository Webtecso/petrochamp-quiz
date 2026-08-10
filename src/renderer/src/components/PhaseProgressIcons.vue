<script setup lang="ts">
import { usePhasesStore } from '../stores/phases'

defineProps<{ currentPhase: number }>()

const phasesStore = usePhasesStore()
</script>

<template>
  <div class="flex items-center gap-3 relative z-10">
    <template v-for="(p, i) in phasesStore.phases" :key="p.id">
      <div class="flex flex-col items-center gap-1" :class="p.order === currentPhase ? 'opacity-100' : 'opacity-40'">
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2"
          :class="p.order === currentPhase ? 'border-petro-primary bg-petro-primary/20 phase-active text-petro-primary' : 'border-white/30 text-white/70'"
        >
          {{ p.order }}
        </div>
        <span class="text-[10px] text-white/70 uppercase tracking-wide">{{ p.order }}ª Fase</span>
        <span class="text-xs text-white font-semibold">{{ p.label }}</span>
      </div>
      <span v-if="i < phasesStore.phases.length - 1" class="text-white/30 text-lg">›</span>
    </template>
  </div>
</template>

<style scoped>
.phase-active {
  animation: phasePulse 2s ease-in-out infinite;
}
@keyframes phasePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(122, 26, 46, 0); }
}
</style>
