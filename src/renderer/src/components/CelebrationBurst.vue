<script setup lang="ts">
import { ref, onMounted } from 'vue'

const active = ref(true)
const confettiColors = ['#7a1a2e', '#f2c14e', '#4a0f1c', '#ffffff']

onMounted(() => {
  setTimeout(() => {
    active.value = false
  }, 4000)
})
</script>

<template>
  <div v-if="active" class="absolute inset-0 overflow-hidden pointer-events-none z-20">
    <span
      v-for="n in 30"
      :key="'c' + n"
      class="confetti"
      :style="{
        left: (n * 3.3) % 100 + '%',
        backgroundColor: confettiColors[n % confettiColors.length],
        animationDelay: (n % 8) * 0.15 + 's',
        animationDuration: 2.5 + (n % 5) * 0.3 + 's'
      }"
    ></span>

    <span v-for="n in 2" :key="'r' + n" class="rocket" :style="{ left: 20 + n * 55 + '%', animationDelay: n * 0.3 + 's' }">
      🚀
    </span>
  </div>
</template>

<style scoped>
.confetti {
  position: absolute;
  top: -5%;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  animation-name: confettiFall;
  animation-timing-function: ease-in;
  animation-fill-mode: forwards;
}
@keyframes confettiFall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(420px) rotate(360deg);
    opacity: 0;
  }
}
.rocket {
  position: absolute;
  bottom: 0;
  font-size: 1.75rem;
  animation: rocketLaunch 1.8s ease-out forwards;
}
@keyframes rocketLaunch {
  0% {
    transform: translateY(0) scale(0.8);
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateY(-420px) scale(1);
    opacity: 0;
  }
}
</style>
