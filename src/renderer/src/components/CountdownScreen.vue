<script setup lang="ts">
defineProps<{ seconds: number; message?: string; transparent?: boolean }>()
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center gap-6 text-white"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <div class="text-9xl font-black countdown-pulse text-petro-primary">{{ seconds }}</div>
    <p class="text-sm text-white/60 tracking-widest uppercase">{{ message ?? 'A batalha vai começar...' }}</p>
  </div>
</template>

<style scoped>
.countdown-pulse {
  animation: countdownPulse 1s ease-in-out infinite;
}
@keyframes countdownPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.85; }
}
</style>
