<script setup lang="ts">
import LogoMark from '../components/LogoMark.vue'
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col">
    <nav class="flex items-center justify-between gap-3 bg-petro-dark px-6 py-3 flex-wrap">
      <LogoMark size="sm" />
      <div class="flex items-center gap-2 flex-wrap">
        <RouterLink to="/admin/equipas" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Equipas</RouterLink>
        <RouterLink to="/admin/fases" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Fases</RouterLink>
        <RouterLink to="/admin/perguntas" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Perguntas</RouterLink>
        <RouterLink to="/admin/desempate" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Desempate</RouterLink>
        <RouterLink to="/admin/avaliacao" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Avaliação (Analíticas)</RouterLink>
        <RouterLink to="/admin/jurados" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Jurados</RouterLink>
        <RouterLink to="/admin/apresentacao" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Apresentação</RouterLink>
        <RouterLink to="/admin/chaveamento" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Chaveamento</RouterLink>
        <RouterLink to="/admin/repescagem" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Repescagem</RouterLink>
        <RouterLink to="/admin/suspense" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Suspense</RouterLink>
        <RouterLink to="/admin/parceiros" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Parceiros</RouterLink>
        <RouterLink to="/admin/historico" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Histórico</RouterLink>
        <RouterLink to="/admin/configuracoes" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Configurações</RouterLink>
        <RouterLink to="/moderador" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition">← Voltar ao Moderador</RouterLink>
      </div>
    </nav>
    <main class="flex-1 px-8 py-8">
      <router-view />
    </main>
  </div>
</template>
