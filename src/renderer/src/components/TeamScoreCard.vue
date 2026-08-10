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
    class="bg-white rounded-2xl shadow p-6 w-56 text-center flex flex-col items-center gap-2 transition-all duration-500"
    :class="active ? 'ring-2 ring-petro-primary card-glow' : ''"
  >
    <TeamAvatar :name="name" :logo-url="logoUrl" size="lg" />
    <h3 class="font-bold text-petro-primary">{{ name }}</h3>
    <p v-if="institution" class="text-[11px] text-gray-400 -mt-1">{{ institution }}</p>
    <div class="text-4xl font-extrabold text-petro-primary">{{ score }}</div>
    <div class="text-xs text-gray-400">PONTOS</div>

    <div v-if="editable" class="flex items-center gap-2 mt-2">
      <button
        class="w-8 h-8 rounded-full bg-petro-primary/10 text-petro-primary font-bold hover:bg-petro-primary/20 transition"
        @click="emit('add', -10)"
      >
        −
      </button>
      <span class="text-xs text-gray-400">10 pts</span>
      <button
        class="w-8 h-8 rounded-full bg-petro-primary text-white font-bold hover:opacity-90 transition"
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
