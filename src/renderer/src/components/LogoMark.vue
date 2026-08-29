<script setup lang="ts">
import fullLogo from '../assets/branding/logo-full.png'
import iconLogo from '../assets/branding/logo-icon.png'
import whiteBoxLogo from '../assets/logo-petrochamp.png'
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
// AUMENTADO - sizePx fixo (88/156/200px) trocado por sizeClamp, uma
// string CSS clamp() por tamanho, para o logo escalar com a largura do
// ecrã em vez de ter sempre a mesma altura física em qualquer
// dispositivo (telemóvel pequeno vs monitor/projetor grande).
const sizeClamp = {
  sm: 'clamp(3.5rem, 6vw, 5.5rem)',
  md: 'clamp(6rem, 10vw, 9.75rem)',
  lg: 'clamp(8rem, 13vw, 12.5rem)'
}[props.size]
const resolvedLogo = props.iconOnly ? iconLogo : props.theme === 'dark' ? whiteBoxLogo : fullLogo
</script>
<template>
  <div
    class="inline-flex items-center justify-center"
    :class="theme === 'dark' ? 'bg-white rounded-2xl shadow-lg px-4 py-2' : ''"
  >
    <img
      :src="resolvedLogo"
      alt="Petrochamp"
      :class="sizeClass"
      :style="`height: ${sizeClamp} !important; width: auto !important;`"
    />
  </div>
</template>
