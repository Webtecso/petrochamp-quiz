<script setup lang="ts">
import { watch } from 'vue'
import LogoMark from '../components/LogoMark.vue'
import { useRouter } from 'vue-router'
import { adminLogout, adminToken } from '../services/adminAuth'
import adminBg from '../assets/projecao-bg.jpg'

const router = useRouter()
const isLocalAccess =
  typeof window === 'undefined' ||
  !window.location.protocol.startsWith('http') ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

// NOVO - adminToken é limpo automaticamente (para null) sempre que
// qualquer pedido via adminFetch/api.ts recebe 401 (sessão expirada ou
// inválida). Antes disso não havia nenhuma reação na UI: o token
// desaparecia do localStorage silenciosamente, mas continuavas dentro do
// Admin a tentar ações que falhavam sempre com o mesmo 401 sem explicação
// nenhuma. Este watch garante que, assim que isso acontece, és mandado de
// volta para o login imediatamente.
watch(adminToken, (token) => {
  if (!token && router.currentRoute.value.path.startsWith('/admin') && router.currentRoute.value.path !== '/admin/login') {
    router.replace('/admin/login')
  }
})

async function logout(): Promise<void> {
  await adminLogout()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col relative">
    <!-- NOVO - fundo do Admin (a mesma imagem usada na Projeção), aplicado
    aqui no layout para cobrir todas as páginas do Admin de uma vez, em vez
    de repetir em cada view. -->
    <div
      class="fixed inset-0 -z-10 bg-cover bg-center"
      :style="{ backgroundImage: `url(${adminBg})` }"
    ></div>

    <nav class="flex items-center justify-between gap-3 bg-petro-dark px-6 py-3 flex-wrap relative z-10">
      <LogoMark size="sm" />
      <div class="flex items-center gap-2 flex-wrap">
        <RouterLink to="/admin/equipas" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Equipas</RouterLink>
        <RouterLink to="/admin/fases" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Fases</RouterLink>
        <RouterLink to="/admin/perguntas" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Perguntas</RouterLink>
        <RouterLink to="/admin/perguntas-por-equipa" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Perguntas por Equipa</RouterLink>
        <RouterLink to="/admin/desempate" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Desempate</RouterLink>
        <RouterLink to="/admin/avaliacao" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Avaliação (Analíticas)</RouterLink>
        <RouterLink to="/admin/jurados" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Jurados</RouterLink>
        <RouterLink to="/admin/apresentacao" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Apresentação</RouterLink>
        <RouterLink to="/admin/chaveamento" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Chaveamento</RouterLink>
        <RouterLink to="/admin/repescagem" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Repescagem</RouterLink>
        <RouterLink to="/admin/suspense" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Suspense</RouterLink>
        <RouterLink to="/admin/parceiros" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Parceiros</RouterLink>
        <RouterLink to="/admin/historico" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Histórico</RouterLink>
        <RouterLink to="/admin/moderadores" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Moderadores</RouterLink>
        <RouterLink to="/admin/configuracoes" class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition" active-class="bg-petro-primary text-white">Configurações</RouterLink>
        <RouterLink
          v-if="isLocalAccess"
          to="/moderador"
          class="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition">← Voltar ao Moderador</RouterLink>
        <button class="px-4 py-2 rounded-lg text-sm text-red-300 hover:text-red-100 transition" @click="logout">Sair</button>
      </div>
    </nav>
    <main class="flex-1 px-8 py-8 relative z-10">
      <router-view />
    </main>
  </div>
</template>
