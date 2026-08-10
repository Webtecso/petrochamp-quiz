<script setup lang="ts">
import LogoMark from './LogoMark.vue'

defineProps<{
  message?: string
  transparent?: boolean
}>()
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center gap-8 text-white relative overflow-hidden"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <div class="glow-circle"></div>
    <LogoMark theme="dark" size="lg" class="z-10" />
    <div class="flex gap-2 z-10">
      <span class="w-3 h-3 rounded-full bg-petro-primary animate-bounce" style="animation-delay: -0.3s"></span>
      <span class="w-3 h-3 rounded-full bg-petro-primary animate-bounce" style="animation-delay: -0.15s"></span>
      <span class="w-3 h-3 rounded-full bg-petro-primary animate-bounce"></span>
    </div>
    <p class="text-lg text-white/70 z-10 text-center max-w-md px-6">
      {{ message ?? 'O campeonato vai começar daqui a pouco...' }}
    </p>
  </div>
</template>

<style scoped>
.glow-circle {
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(122, 26, 46, 0.4) 0%, transparent 70%);
  animation: pulseGlow 2.5s ease-in-out infinite;
}
@keyframes pulseGlow {
  0%, 100% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}
</style>
