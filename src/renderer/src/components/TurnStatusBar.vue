<script setup lang="ts">
defineProps<{
  teamAName: string
  teamBName: string
  teamAAnswer: string | null
  teamBAnswer: string | null
}>()
</script>

<template>
  <div class="bg-petro-dark px-6 py-3 flex items-center justify-center gap-4 relative overflow-hidden">
    <div class="status-glow"></div>
    <span
      class="text-sm font-semibold px-4 py-1.5 rounded-full transition-all relative z-10"
      :class="!teamAAnswer ? 'bg-petro-primary text-white pulse-badge' : 'bg-white/10 text-white/50'"
    >
      {{ !teamAAnswer ? `É a vez de ${teamAName}` : `${teamAName} respondeu ✓` }}
    </span>
    <span class="text-white/30 text-xs relative z-10">•</span>
    <span
      class="text-sm font-semibold px-4 py-1.5 rounded-full transition-all relative z-10"
      :class="!teamBAnswer ? 'bg-petro-primary text-white pulse-badge' : 'bg-white/10 text-white/50'"
    >
      {{ !teamBAnswer ? `É a vez de ${teamBName}` : `${teamBName} respondeu ✓` }}
    </span>
  </div>
</template>

<style scoped>
.status-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(122, 26, 46, 0.3), transparent 70%);
  animation: glowPulse 2.4s ease-in-out infinite;
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
.pulse-badge {
  animation: badgePulse 1.6s ease-in-out infinite;
}
@keyframes badgePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(122, 26, 46, 0); }
}
</style>
