<script setup lang="ts">
defineProps<{
  phase: number
  label: string
}>()
</script>

<template>
  <div class="flex items-center gap-2 bg-petro-primary/10 text-petro-primary px-3 py-1.5 rounded-lg font-semibold text-sm">
    FASE {{ phase }} <span class="font-normal">{{ label }}</span>
  </div>
</template>
