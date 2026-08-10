<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import BracketMatchCard from './BracketMatchCard.vue'
import type { BracketPhase } from '../data/bracket'

const props = defineProps<{
  phases: BracketPhase[]
}>()

const containerRef = ref<HTMLElement | null>(null)
const matchRefs = ref<(HTMLElement | null)[][]>([])
const svgPaths = ref<string[]>([])
const svgSize = ref({ width: 0, height: 0 })

function setMatchRef(el: unknown, phaseIndex: number, matchIndex: number): void {
  if (!matchRefs.value[phaseIndex]) matchRefs.value[phaseIndex] = []
  matchRefs.value[phaseIndex][matchIndex] = el as HTMLElement | null
}

function computePaths(): void {
  if (!containerRef.value) return

  svgSize.value = {
    width: containerRef.value.scrollWidth,
    height: containerRef.value.scrollHeight
  }

  const paths: string[] = []

  for (let p = 0; p < props.phases.length - 1; p++) {
    const currentMatches = matchRefs.value[p] || []
    for (let m = 0; m < currentMatches.length; m++) {
      const fromEl = currentMatches[m]
      const targetIndex = Math.floor(m / 2)
      const toEl = matchRefs.value[p + 1]?.[targetIndex]
      if (!fromEl || !toEl) continue

      const startX = fromEl.offsetLeft + fromEl.offsetWidth
      const startY = fromEl.offsetTop + fromEl.offsetHeight / 2
      const endX = toEl.offsetLeft
      const endY = toEl.offsetTop + toEl.offsetHeight / 2
      const midX = startX + (endX - startX) / 2

      paths.push(`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`)
    }
  }

  svgPaths.value = paths
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  computePaths()
  resizeObserver = new ResizeObserver(() => computePaths())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.phases,
  async () => {
    matchRefs.value = []
    await nextTick()
    computePaths()
  },
  { deep: true }
)
</script>

<template>
  <div class="overflow-x-auto py-4 w-full">
    <div ref="containerRef" class="relative flex items-center gap-10 w-max mx-auto px-4">
      <svg class="absolute inset-0 pointer-events-none" :width="svgSize.width" :height="svgSize.height">
        <path
          v-for="(d, i) in svgPaths"
          :key="i"
          :d="d"
          class="bracket-line"
          :style="{ animationDelay: i * 0.12 + 's' }"
          fill="none"
          stroke="var(--color-petro-primary)"
          stroke-width="2"
        />
      </svg>

      <div
        v-for="(phase, phaseIndex) in phases"
        :key="phase.name"
        class="flex flex-col justify-around gap-6 shrink-0 relative z-10 bracket-column"
        :style="{ animationDelay: phaseIndex * 0.15 + 's' }"
      >
        <h3
          class="text-petro-primary font-semibold text-xs uppercase tracking-wide text-center flex items-center justify-center gap-1"
        >
          {{ phase.name }}
          <span v-if="phase.matches.length === 1">🏆</span>
        </h3>
        <div class="flex flex-col justify-around gap-6 flex-1">
          <div v-for="(match, matchIndex) in phase.matches" :key="match.id" :ref="(el) => setMatchRef(el, phaseIndex, matchIndex)">
            <BracketMatchCard :team-a="match.teamA" :team-b="match.teamB" :winner-id="match.winnerId" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bracket-line {
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  animation: drawLine 0.9s ease forwards;
}
.bracket-column {
  animation: fadeSlideIn 0.5s ease both;
}
@keyframes drawLine {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
