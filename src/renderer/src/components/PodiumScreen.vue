<script setup lang="ts">
import { computed } from 'vue'
import type { PodiumEntry } from '../data/podiumResults'
import IndustrialBackground from './IndustrialBackground.vue'
import CinematicOverlay from './CinematicOverlay.vue'
import ConfettiBurst from './ConfettiBurst.vue'
import RocketLaunch from './RocketLaunch.vue'
import PodiumStand from './PodiumStand.vue'
import PhaseProgressIcons from './PhaseProgressIcons.vue'
import LogoMark from './LogoMark.vue'

const props = defineProps<{
  phaseNumber: number
  phaseLabel: string
  entries: PodiumEntry[]
  isGrandFinal: boolean
  transparent?: boolean
}>()

const first = computed(() => props.entries[0])
const second = computed(() => props.entries[1])
const third = computed(() => props.entries[2])
</script>

<template>
  <div
    class="min-h-screen relative overflow-hidden flex flex-col items-center justify-between py-8 px-6 scene-zoom-in"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <IndustrialBackground />
    <div class="spotlight spotlight-left"></div>
    <div class="spotlight spotlight-right"></div>

    <div class="flex flex-col items-center gap-4 relative z-10">
      <LogoMark size="lg" />
      <div class="text-petro-primary font-semibold text-sm tracking-widest uppercase">
        {{ isGrandFinal ? 'Grande Final · Vencedores' : phaseLabel + ' · Vencedores da Fase' }}
      </div>
      <PhaseProgressIcons :current-phase="phaseNumber" />
    </div>

    <div class="flex items-end justify-center gap-6 relative z-10 flex-1 mt-6">
      <PodiumStand v-if="second" :rank="2" :entry="second" />
      <PodiumStand v-if="first" :rank="1" :entry="first" />
      <PodiumStand v-if="third" :rank="3" :entry="third" />
    </div>

    <ConfettiBurst :key="'confetti-' + phaseNumber" />
    <RocketLaunch v-if="isGrandFinal" :key="'rocket-' + phaseNumber" />
    <CinematicOverlay />
  </div>
</template>

<style scoped>
.scene-zoom-in {
  animation: sceneZoom 1.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes sceneZoom {
  from { transform: scale(1.12); filter: brightness(0.6); }
  to { transform: scale(1); filter: brightness(1); }
}
.spotlight {
  position: absolute;
  top: -10%;
  width: 300px;
  height: 140%;
  background: conic-gradient(from 0deg, transparent, rgba(250, 204, 21, 0.08), transparent 30%);
  animation: spotlightSweep 6s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}
.spotlight-left {
  left: 10%;
}
.spotlight-right {
  right: 10%;
  animation-delay: 3s;
}
@keyframes spotlightSweep {
  0%, 100% { transform: rotate(-15deg); opacity: 0.5; }
  50% { transform: rotate(15deg); opacity: 1; }
}
</style>
