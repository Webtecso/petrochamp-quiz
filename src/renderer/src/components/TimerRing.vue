<script setup lang="ts">
defineProps<{
  seconds: number
}>()
</script>
<template>
  <!--
    CORRIGIDO - w-24/h-24/text-2xl eram tamanhos fixos em rem, iguais em
    qualquer ecrã. Em monitores/projetores grandes o cronómetro ficava
    desproporcionalmente pequeno face ao resto da tela. Agora o diâmetro
    e o tamanho do número escalam com a largura do ecrã (vw), com um
    mínimo e máximo para nunca ficar ilegível nem gigantesco demais.
  -->
  <div
    class="mx-auto rounded-full border-4 border-petro-primary flex items-center justify-center font-bold text-petro-primary shrink-0"
    style="
      width: clamp(4.5rem, 8vw, 9rem);
      height: clamp(4.5rem, 8vw, 9rem);
      font-size: clamp(1.25rem, 3vw, 3rem);
    "
  >
    {{ seconds }}
  </div>
</template>
