<script setup lang="ts">
import TeamAvatar from './TeamAvatar.vue'

withDefaults(
  defineProps<{
    name: string
    score: number
    logoUrl?: string
    editable?: boolean
    institution?: string
    active?: boolean
  }>(),
  { active: false }
)

const emit = defineEmits<{
  add: [amount: number]
}>()
</script>

<template>
  <div
    class="bg-white rounded-2xl shadow p-4 sm:p-6 w-full max-w-[9rem] sm:max-w-56 text-center flex flex-col items-center gap-2 transition-all duration-500"
    :class="active ? 'ring-2 ring-petro-primary card-glow' : ''"
  >
    <TeamAvatar :name="name" :logo-url="logoUrl" size="lg" />
    <h3 class="font-bold text-petro-primary text-sm sm:text-base truncate w-full">{{ name }}</h3>
    <p v-if="institution" class="text-[10px] sm:text-[11px] text-gray-400 -mt-1 truncate w-full">{{ institution }}</p>
    <div class="text-3xl sm:text-4xl font-extrabold text-petro-primary">{{ score }}</div>
    <div class="text-[10px] sm:text-xs text-gray-400">PONTOS</div>

    <div v-if="editable" class="flex items-center gap-1 sm:gap-2 mt-2">
      <button
        class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-petro-primary/10 text-petro-primary font-bold hover:bg-petro-primary/20 transition flex items-center justify-center text-xs sm:text-sm"
        @click="emit('add', -10)"
      >
        −
      </button>
      <span class="text-[10px] sm:text-xs text-gray-400">10 pts</span>
      <button
        class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-petro-primary text-white font-bold hover:opacity-90 transition flex items-center justify-center text-xs sm:text-sm"
        @click="emit('add', 10)"
      >
        +
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-glow {
  animation: cardGlowPulse 1.8s ease-in-out infinite;
}
@keyframes cardGlowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(122, 26, 46, 0.15); }
}
</style>
