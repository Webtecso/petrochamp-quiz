<script setup lang="ts">
import { computed } from 'vue'

const colors = ['#facc15', '#e5e7eb', '#d97706', '#7a1a2e', '#ffffff']

const pieces = computed(() =>
  Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.2,
    color: colors[i % colors.length],
    rotate: Math.random() * 360
  }))
)
</script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-20">
    <span
      v-for="p in pieces"
      :key="p.id"
      class="confetti-piece"
      :style="{
        left: p.left + '%',
        backgroundColor: p.color,
        animationDelay: p.delay + 's',
        animationDuration: p.duration + 's',
        transform: `rotate(${p.rotate}deg)`
      }"
    ></span>
  </div>
</template>

<style scoped>
.confetti-piece {
  position: absolute;
  top: -20px;
  width: 8px;
  height: 12px;
  opacity: 0.9;
  animation-name: confettiFall;
  animation-timing-function: ease-in;
  animation-fill-mode: forwards;
}
@keyframes confettiFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(420px) rotate(340deg); opacity: 0; }
}
</style>
