<script setup lang="ts">
defineProps<{ seconds: number; message?: string; transparent?: boolean }>()
</script>
<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center gap-6 text-white px-6"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <!--
      CORRIGIDO - 'text-9xl' era um tamanho fixo em rem, igual em qualquer
      ecrã, independentemente do tamanho físico do monitor/projetor. Em
      ecrãs de projeção grandes ficava desproporcionalmente pequeno.
      clamp(mínimo, preferido, máximo) faz o número escalar com a largura
      do ecrã (vw), mas nunca fica ilegível em ecrãs pequenos nem
      gigantesco demais em ecrãs muito largos.
    -->
    <div
      class="font-black countdown-pulse text-petro-primary leading-none"
      style="font-size: clamp(6rem, 22vw, 20rem)"
    >
      {{ seconds }}
    </div>
    <p
      class="text-white/60 tracking-widest uppercase text-center"
      style="font-size: clamp(0.8rem, 1.6vw, 1.25rem)"
    >
      {{ message ?? 'A batalha vai começar...' }}
    </p>
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
