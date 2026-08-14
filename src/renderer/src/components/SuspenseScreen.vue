<script setup lang="ts">
import LogoMark from './LogoMark.vue'

defineProps<{
  message?: string
  transparent?: boolean
}>()
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center gap-10 text-white relative overflow-hidden"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <div class="glow-circle"></div>

    <LogoMark theme="dark" size="lg" class="z-10 logo-in" />

    <div class="flex gap-2.5 z-10 dots-in">
      <span class="w-3.5 h-3.5 rounded-full bg-amber-400 animate-bounce" style="animation-delay: -0.3s"></span>
      <span class="w-3.5 h-3.5 rounded-full bg-amber-400 animate-bounce" style="animation-delay: -0.15s"></span>
      <span class="w-3.5 h-3.5 rounded-full bg-amber-400 animate-bounce"></span>
    </div>

    <div class="z-10 text-center max-w-3xl px-8 message-in">
      <div class="divider-line mx-auto mb-5"></div>
      <p class="text-3xl md:text-4xl font-extrabold leading-snug tracking-tight message-glow">
        {{ message ?? 'O campeonato vai começar daqui a pouco...' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.glow-circle {
  position: absolute;
  width: 560px;
  height: 560px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(212, 169, 75, 0.28) 0%, rgba(122, 26, 46, 0.35) 45%, transparent 72%);
  animation: pulseGlow 3s ease-in-out infinite;
}
@keyframes pulseGlow {
  0%, 100% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}

.divider-line {
  width: 64px;
  height: 3px;
  border-radius: 9999px;
  background: linear-gradient(90deg, transparent, #d4a94b, transparent);
}

.logo-in {
  animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.dots-in {
  animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
}
.message-in {
  animation: fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
}

@keyframes fadeUp {
  from { transform: translateY(14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.message-glow {
  animation: textBreathe 3.5s ease-in-out infinite;
}
@keyframes textBreathe {
  0%, 100% { text-shadow: 0 2px 10px rgba(0,0,0,0.35); }
  50% { text-shadow: 0 2px 24px rgba(212, 169, 75, 0.45), 0 2px 10px rgba(0,0,0,0.35); }
}
</style>
