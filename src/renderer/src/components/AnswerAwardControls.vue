<script setup lang="ts">
defineProps<{
  points: number
  awardedTeam: 'A' | 'B' | null
  teamAName: string
  teamBName: string
}>()

const emit = defineEmits<{
  award: [team: 'A' | 'B']
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-3">
    <button
      class="px-4 py-2 rounded-lg text-sm font-semibold border-2 transition disabled:cursor-not-allowed"
      :class="awardedTeam === 'A' ? 'bg-petro-primary text-white border-petro-primary' : 'border-gray-200 text-gray-600 hover:border-petro-primary'"
      :disabled="!!awardedTeam"
      @click="emit('award', 'A')"
    >
      ✓ {{ teamAName }} acertou (+{{ points }})
    </button>
    <button
      class="px-4 py-2 rounded-lg text-sm font-semibold border-2 transition disabled:cursor-not-allowed"
      :class="awardedTeam === 'B' ? 'bg-petro-primary text-white border-petro-primary' : 'border-gray-200 text-gray-600 hover:border-petro-primary'"
      :disabled="!!awardedTeam"
      @click="emit('award', 'B')"
    >
      ✓ {{ teamBName }} acertou (+{{ points }})
    </button>
  </div>
</template>
