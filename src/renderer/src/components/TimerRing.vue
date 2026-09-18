<script setup lang="ts">
defineProps<{
  seconds: number
}>()
</script>
<template>
  <div
    class="mx-auto rounded-full border-4 flex items-center justify-center font-bold shrink-0"
    style="
      width: clamp(4.5rem, 8vw, 9rem);
      height: clamp(4.5rem, 8vw, 9rem);
      font-size: clamp(1.25rem, 3vw, 3rem);
      color: aliceblue;
      border-color: rgba(255, 255, 255, 0.5);
    "
  >
    {{ seconds }}
  </div>
</template>
