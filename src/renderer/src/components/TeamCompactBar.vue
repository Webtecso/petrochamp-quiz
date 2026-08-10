<script setup lang="ts">
defineProps<{
  teamAName: string
  teamALogoUrl?: string
  teamAScore: number
  teamAActive?: boolean
  teamBName: string
  teamBLogoUrl?: string
  teamBScore: number
  teamBActive?: boolean
  showScore?: boolean
}>()
</script>

<template>
  <div class="bg-petro-dark rounded-2xl shadow-lg px-5 py-3 flex items-center justify-between gap-4 w-full max-w-2xl mx-auto relative overflow-hidden">
    <div class="bar-sheen"></div>

    <div
      class="flex items-center gap-3 relative z-10 px-3 py-1.5 rounded-xl transition-all duration-300"
      :class="teamAActive ? 'bg-petro-primary/40 team-glow' : ''"
    >
      <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
        <img v-if="teamALogoUrl" :src="teamALogoUrl" :alt="teamAName" class="w-full h-full object-cover" />
        <span v-else class="text-white text-xs font-bold">{{ teamAName.slice(0, 2).toUpperCase() }}</span>
      </div>
      <div class="text-white">
        <div class="text-sm font-semibold">{{ teamAName }}</div>
        <div v-if="showScore" class="text-xl font-extrabold">{{ teamAScore }}</div>
      </div>
    </div>

    <div class="text-white/40 font-bold text-sm relative z-10 shrink-0">VS</div>

    <div
      class="flex items-center gap-3 relative z-10 flex-row-reverse px-3 py-1.5 rounded-xl transition-all duration-300"
      :class="teamBActive ? 'bg-petro-primary/40 team-glow' : ''"
    >
      <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
        <img v-if="teamBLogoUrl" :src="teamBLogoUrl" :alt="teamBName" class="w-full h-full object-cover" />
        <span v-else class="text-white text-xs font-bold">{{ teamBName.slice(0, 2).toUpperCase() }}</span>
      </div>
      <div class="text-white text-right">
        <div class="text-sm font-semibold">{{ teamBName }}</div>
        <div v-if="showScore" class="text-xl font-extrabold">{{ teamBScore }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar-sheen {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(122, 26, 46, 0.25), transparent 70%);
}
.team-glow {
  animation: teamGlow 1.6s ease-in-out infinite;
}
@keyframes teamGlow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.4); }
}
</style>
