<script setup lang="ts">
import fullLogo from '../assets/branding/logo-full.png'
import iconLogo from '../assets/branding/logo-icon.png'

const props = withDefaults(
  defineProps<{
    theme?: 'light' | 'dark'
    size?: 'sm' | 'md' | 'lg'
    iconOnly?: boolean
  }>(),
  {
    theme: 'light',
    size: 'md',
    iconOnly: false
  }
)

const sizeClass = { sm: 'h-8', md: 'h-12', lg: 'h-20' }[props.size]
</script>

<template>
  <div
    class="inline-flex items-center justify-center"
    :class="theme === 'dark' ? 'bg-white rounded-2xl shadow-lg px-4 py-2' : ''"
  >
    <img :src="iconOnly ? iconLogo : fullLogo" alt="Petrochamp" :class="sizeClass" />
  </div>
</template>
