<script setup lang="ts">
import LogoMark from './LogoMark.vue'
</script>

<template>
  <div class="min-h-screen bg-petro-dark flex flex-col items-center justify-center gap-8 text-white">
    <div class="logo-pop">
      <LogoMark size="lg" />
    </div>
    <div class="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div class="loading-fill h-full bg-petro-primary rounded-full"></div>
    </div>
    <p class="text-xs text-white/40 tracking-widest uppercase">A carregar...</p>
  </div>
</template>

<style scoped>
.logo-pop {
  animation: logoPop 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes logoPop {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}
.loading-fill {
  animation: loadingFill 2s ease-in-out forwards;
}
@keyframes loadingFill {
  from { width: 0%; }
  to { width: 100%; }
}
</style>
