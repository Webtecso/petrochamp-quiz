<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    logoUrl?: string
    size?: 'sm' | 'md' | 'lg'
    ring?: boolean
    dark?: boolean
  }>(),
  { size: 'md', ring: false, dark: false }
)

const sizeClasses: Record<string, string> = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg'
}
</script>

<template>
  <div
    class="rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold"
    :class="[
      sizeClasses[size],
      ring ? 'ring-4 ring-yellow-300/70' : '',
      dark ? 'bg-white/10 text-white' : 'bg-petro-primary/10 text-petro-primary'
    ]"
  >
    <img v-if="logoUrl" :src="logoUrl" :alt="name" class="w-full h-full object-cover" />
    <span v-else>{{ name.slice(0, 2).toUpperCase() }}</span>
  </div>
</template>
