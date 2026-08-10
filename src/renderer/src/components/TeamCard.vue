<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    institution?: string
    logoUrl?: string
    score: number
    maxScore?: number
    showScore?: boolean
    active?: boolean
  }>(),
  { showScore: true, active: false, maxScore: 10 }
)

const progressPercent = computed(() => Math.min(100, (props.score / (props.maxScore || 1)) * 100))
</script>

<template>
  <div
    class="bg-white rounded-2xl shadow-lg px-6 py-5 flex flex-col items-center gap-2 w-48 relative transition-all duration-500"
    :class="active ? 'card-active scale-105' : ''"
  >
    <span v-if="active" class="active-badge">A RESPONDER</span>

    <h3 class="font-bold text-sm text-gray-700 tracking-wide text-center">{{ name }}</h3>

    <div class="w-16 h-16 rounded-full bg-petro-primary/5 flex items-center justify-center overflow-hidden my-1 shrink-0">
      <img v-if="logoUrl" :src="logoUrl" :alt="name" class="w-full h-full object-cover" />
      <span v-else class="text-petro-primary font-bold text-lg">{{ name.slice(0, 2).toUpperCase() }}</span>
    </div>

    <p v-if="institution" class="text-[10px] text-gray-400 text-center leading-tight -mt-1 line-clamp-2">
      {{ institution }}
    </p>

    <template v-if="showScore">
      <div class="text-3xl font-extrabold text-petro-primary mt-1">{{ score }}</div>
      <div class="text-[10px] text-gray-400 tracking-widest">PONTOS</div>
      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
        <div
          class="h-full bg-gradient-to-r from-petro-primary to-red-400 rounded-full transition-all duration-700"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card-active {
  box-shadow: 0 0 0 3px rgba(122, 26, 46, 0.5), 0 10px 30px rgba(122, 26, 46, 0.25);
  animation: cardPulse 1.8s ease-in-out infinite;
}
@keyframes cardPulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(122, 26, 46, 0.5), 0 10px 30px rgba(122, 26, 46, 0.25); }
  50% { box-shadow: 0 0 0 7px rgba(122, 26, 46, 0.22), 0 10px 30px rgba(122, 26, 46, 0.35); }
}
.active-badge {
  position: absolute;
  top: -10px;
  background: var(--color-petro-primary);
  color: white;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 3px 10px;
  border-radius: 9999px;
  animation: badgeBounce 1.4s ease-in-out infinite;
  white-space: nowrap;
}
@keyframes badgeBounce {
  0%, 100% { transform: translateY(0) translateX(-50%); }
  50% { transform: translateY(-3px) translateX(-50%); }
}
.active-badge {
  left: 50%;
  transform: translateX(-50%);
}
</style>
