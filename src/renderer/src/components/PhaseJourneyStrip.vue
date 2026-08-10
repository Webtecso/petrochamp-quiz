<script setup lang="ts">
interface Phase {
  label: string
  icon: string
}

defineProps<{
  phases: Phase[]
  completedCount: number
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-4 z-10 relative">
    <template v-for="(phase, i) in phases" :key="phase.label">
      <div class="flex flex-col items-center gap-1 transition-opacity duration-700" :class="i < completedCount ? 'opacity-100' : 'opacity-30'">
        <div class="w-12 h-12 rounded-full bg-white/10 border border-petro-primary/50 flex items-center justify-center text-xl">
          {{ phase.icon }}
        </div>
        <span class="text-[10px] text-white/70 uppercase tracking-wide">{{ phase.label }}</span>
      </div>
      <span v-if="i < phases.length - 1" class="text-petro-primary/50">→</span>
    </template>
  </div>
</template>
