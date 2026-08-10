<script setup lang="ts">
import TeamAvatar from './TeamAvatar.vue'

withDefaults(
  defineProps<{
    teamAName: string
    teamAScore: number
    teamALogoUrl?: string
    teamAActive?: boolean
    teamBName: string
    teamBScore: number
    teamBLogoUrl?: string
    teamBActive?: boolean
  }>(),
  { teamAActive: false, teamBActive: false }
)
</script>

<template>
  <div class="flex items-center justify-center gap-8 bg-petro-dark px-8 py-5 text-white">
    <div class="flex items-center gap-3 transition-all duration-300" :class="teamAActive ? 'banner-glow' : ''">
      <TeamAvatar :name="teamAName" :logo-url="teamALogoUrl" size="md" dark />
      <div>
        <div class="font-semibold">{{ teamAName }}</div>
        <div class="text-xs text-white/60">{{ teamAScore }} PONTOS</div>
      </div>
    </div>

    <div class="text-white/40 font-bold text-lg">VS</div>

    <div class="flex items-center gap-3 transition-all duration-300" :class="teamBActive ? 'banner-glow' : ''">
      <div>
        <div class="font-semibold text-right">{{ teamBName }}</div>
        <div class="text-xs text-white/60 text-right">{{ teamBScore }} PONTOS</div>
      </div>
      <TeamAvatar :name="teamBName" :logo-url="teamBLogoUrl" size="md" dark />
    </div>
  </div>
</template>

<style scoped>
.banner-glow {
  animation: bannerGlowPulse 1.6s ease-in-out infinite;
}
@keyframes bannerGlowPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
}
</style>
