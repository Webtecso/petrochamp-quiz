<script setup lang="ts"></script>

<template>
  <!-- ATUALIZADO — w-10 fixo trocado por clamp() em vw, para as linhas de
       ligação do chaveamento escalarem proporcionalmente às caixas das
       equipas (que também passaram a usar clamp), em vez de ficarem
       desproporcionalmente curtas/longas em ecrãs grandes. -->
  <div class="w-[clamp(1.5rem,3vw,3.5rem)] h-full flex items-center justify-center relative shrink-0">
    <div class="connector-vline"></div>
    <div class="connector-hline connector-hline-left"></div>
    <div class="connector-hline connector-hline-right"></div>
  </div>
</template>

<style scoped>
.connector-vline {
  position: absolute;
  top: 20%;
  bottom: 20%;
  left: 50%;
  width: 2px;
  background: var(--color-petro-primary);
  opacity: 0.3;
  transform-origin: center;
  animation: growLine 0.6s ease both;
  animation-delay: 0.4s;
}
.connector-hline {
  position: absolute;
  top: 50%;
  width: 50%;
  height: 2px;
  background: var(--color-petro-primary);
  opacity: 0.3;
}
.connector-hline-left {
  left: 0;
}
.connector-hline-right {
  right: 0;
}
@keyframes growLine {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}
</style>
