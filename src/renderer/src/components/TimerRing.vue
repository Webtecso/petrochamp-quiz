<script setup lang="ts">
defineProps<{
  seconds: number
}>()
</script>

<template>
  <div class="w-24 h-24 mx-auto rounded-full border-4 border-petro-primary flex items-center justify-center text-2xl font-bold text-petro-primary">
    {{ seconds }}
  </div>
</template>
