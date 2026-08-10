<script setup lang="ts"></script>

<template>
  <div class="w-10 h-full flex items-center justify-center relative shrink-0">
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
