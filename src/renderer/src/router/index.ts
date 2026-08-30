import { createRouter, createWebHashHistory } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { useCampeonatoStore } from '../stores/campeonato'
import { usePhasesStore } from '../stores/phases'
import { isAdminLoggedIn, checkAdminConfigured } from '../services/adminAuth'

import ModeradorLayout from '../views/ModeradorLayout.vue'
import AppEntryView from '../views/AppEntryView.vue'
import ServerConfigView from '../views/ServerConfigView.vue'
import ModeSelectView from '../views/ModeSelectView.vue'
import { useModeratorStore } from '../stores/moderator'
import CampeonatoSelectView from '../views/CampeonatoSelectView.vue'
import ModeradorBracketView from '../views/ModeradorBracketView.vue'
import EquipasSelectView from '../views/EquipasSelectView.vue'
import SalaEsperaView from '../views/SalaEsperaView.vue'
import ModeradorDashboard from '../views/ModeradorDashboard.vue'
import RankingView from '../views/RankingView.vue'
import ConfiguracoesView from '../views/ConfiguracoesView.vue'
import ModeradorPodioView from '../views/ModeradorPodioView.vue'
import JuradosView from '../views/JuradosView.vue'
import ModeradorApresentacaoView from '../views/ModeradorApresentacaoView.vue'
import ModeradorRepescagemView from '../views/ModeradorRepescagemView.vue'
import ProjecaoView from '../views/ProjecaoView.vue'
import JogadorEntryView from '../views/JogadorEntryView.vue'
import JogadorGameView from '../views/JogadorGameView.vue'
import JogadorResultView from '../views/JogadorResultView.vue'
import AdminLayout from '../views/AdminLayout.vue'
import AdminSetupView from '../views/AdminSetupView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminTeamsView from '../views/AdminTeamsView.vue'
import AdminPhasesView from '../views/AdminPhasesView.vue'
import AdminQuestionsView from '../views/AdminQuestionsView.vue'
import AdminEvaluationView from '../views/AdminEvaluationView.vue'
import AdminJurorsView from '../views/AdminJurorsView.vue'
import AdminPresentationView from '../views/AdminPresentationView.vue'
import AdminSettingsView from '../views/AdminSettingsView.vue'
import AdminTiebreakView from '../views/AdminTiebreakView.vue'
import AdminBracketPreviewView from '../views/AdminBracketPreviewView.vue'
import AdminSuspensePhrasesView from '../views/AdminSuspensePhrasesView.vue'
import AdminPartnersView from '../views/AdminPartnersView.vue'
import AdminHistoryView from '../views/AdminHistoryView.vue'
import AdminRepescagemView from '../views/AdminRepescagemView.vue'
import ModeradorLoginView from '../views/ModeradorLoginView.vue'
import AdminModeratorsView from '../views/AdminModeratorsView.vue'

const defaultPath = Capacitor.isNativePlatform() ? '/servidor' : '/moderador/modo'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: defaultPath },
    { path: '/servidor', name: 'servidor', component: ServerConfigView },
    { path: '/inicio', name: 'inicio', component: AppEntryView },
    { path: '/admin/setup', name: 'admin-setup', component: AdminSetupView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    {
      path: '/moderador',
      component: ModeradorLayout,
      children: [
        { path: 'login', name: 'moderador-login', component: ModeradorLoginView },
        { path: '', redirect: '/moderador/modo' },
        { path: 'modo', name: 'moderador-modo', component: ModeSelectView },
        { path: 'campeonato', name: 'moderador-campeonato', component: CampeonatoSelectView },
        { path: 'chaveamento', name: 'moderador-chaveamento', component: ModeradorBracketView },
        { path: 'equipas', name: 'moderador-equipas', component: EquipasSelectView },
        { path: 'sala-espera', name: 'moderador-sala-espera', component: SalaEsperaView },
        { path: 'jogo', name: 'moderador-jogo', component: ModeradorDashboard },
        { path: 'ranking', name: 'moderador-ranking', component: RankingView },
        { path: 'podio', name: 'moderador-podio', component: ModeradorPodioView },
        { path: 'jurados', name: 'moderador-jurados', component: JuradosView },
        { path: 'apresentacao', name: 'moderador-apresentacao', component: ModeradorApresentacaoView },
        { path: 'repescagem', name: 'moderador-repescagem', component: ModeradorRepescagemView },
        { path: 'configuracoes', name: 'moderador-configuracoes', component: ConfiguracoesView }
      ]
    },
    {
      path: '/admin',
      component: AdminLayout,
      children: [
        { path: '', redirect: '/admin/equipas' },
        { path: 'equipas', name: 'admin-equipas', component: AdminTeamsView },
        { path: 'fases', name: 'admin-fases', component: AdminPhasesView },
        { path: 'perguntas', name: 'admin-perguntas', component: AdminQuestionsView },
        { path: 'desempate', name: 'admin-desempate', component: AdminTiebreakView },
        { path: 'avaliacao', name: 'admin-avaliacao', component: AdminEvaluationView },
        { path: 'jurados', name: 'admin-jurados', component: AdminJurorsView },
        { path: 'apresentacao', name: 'admin-apresentacao', component: AdminPresentationView },
        { path: 'chaveamento', name: 'admin-chaveamento', component: AdminBracketPreviewView },
        { path: 'repescagem', name: 'admin-repescagem', component: AdminRepescagemView },
        { path: 'suspense', name: 'admin-suspense', component: AdminSuspensePhrasesView },
        { path: 'parceiros', name: 'admin-parceiros', component: AdminPartnersView },
        { path: 'historico', name: 'admin-historico', component: AdminHistoryView },
        { path: 'moderadores', name: 'admin-moderadores', component: AdminModeratorsView },
        { path: 'configuracoes', name: 'admin-configuracoes', component: AdminSettingsView }
      ]
    },
    { path: '/projecao', name: 'projecao', component: ProjecaoView },
    { path: '/jogador', name: 'jogador-entrada', component: JogadorEntryView },
    { path: '/jogador/jogo', name: 'jogador-jogo', component: JogadorGameView },
    { path: '/jogador/resultado', name: 'jogador-resultado', component: JogadorResultView }
  ]
})

const isLocalAccess =
  typeof window === 'undefined' ||
  !window.location.protocol.startsWith('http') ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

// NOVO - cache simples em memória do resultado de checkAdminConfigured().
// Depois de confirmarmos que HÁ password configurada, esse facto nunca
// deixa de ser verdade durante a vida da aplicação (só ficaria falso de
// novo se a BD fosse apagada, o que implica reiniciar a app de qualquer
// forma). Isto evita fazer um pedido de rede a cada navegação para dentro
// da área /admin. Enquanto ainda não sabemos (null) ou sabemos que NÃO
// está configurado (false), voltamos a perguntar ao servidor a cada
// navegação - é barato e garante que assim que o setup for concluído
// nesta mesma sessão, a próxima navegação já reconhece isso.
let adminConfiguredCache: boolean | null = null

async function isAdminConfigured(): Promise<boolean> {
  if (adminConfiguredCache === true) return true
  const configured = await checkAdminConfigured().catch(() => false)
  adminConfiguredCache = configured
  return configured
}

async function resumeRoute(store: ReturnType<typeof useCampeonatoStore>): Promise<string | null> {
  if (!store.championship) return null

  // 1. Pódio ativo
  if (store.podium.active || store.podiumReveal.stage !== 'idle') {
    return '/moderador/podio'
  }

  // 2. Transições e Animações (Intro de Quiz, Ranking, Suspense, Repescagem)
  if (
    ['ranking', 'partnersPending', 'partners', 'webtec', 'organizer', 'suspense', 'quizIntro', 'repescagem'].includes(
      store.phaseFlow.stage
    )
  ) {
    return '/moderador/ranking'
  }

  // 3. Apresentação ativamente em curso (countdown, presenting, concluded)
  if (store.presentationFlow.stage !== 'idle') {
    return '/moderador/apresentacao'
  }

  // 4. Jogo com equipas ativas na mesa
  if (store.teamA && store.teamB) {
    return '/moderador/jogo'
  }

  // 5. Deteção do tipo da fase atual
  //
  // ATUALIZADO - refaz sempre esta busca (em vez de só quando o array
  // estava vazio). O array ficava em cache de um campeonato para o
  // seguinte - se mudasses de tipo de campeonato (ex: Universitário para
  // Ensino Médio, que têm tipos de fase diferentes), o resumo continuava a
  // ler as fases do campeonato anterior e detetava o tipo de fase errado.
  // Era a causa da Apresentação/Apresentação+Quiz parecer "estragada" sem
  // nenhuma mudança na tela em si.
  const phasesStore = usePhasesStore()
  await phasesStore.fetchPhases(store.championship)

  const currentPhase = phasesStore.phases.find((p) => Number(p.order) === Number(store.phase))
  const phaseType = currentPhase?.type

  if (phaseType === 'apresentacao' || phaseType === 'apresentacao_quiz') {
    return '/moderador/apresentacao'
  }

  return '/moderador/equipas'
}

const RESUME_PATHS = ['/moderador', '/moderador/campeonato']

router.beforeEach(async (to, from) => {
  const moderatorStore = useModeratorStore()

  if (!isLocalAccess && !to.path.startsWith('/admin')) {
    return isAdminLoggedIn() ? '/admin' : '/admin/login'
  }

  const isModeratorArea = to.path.startsWith('/moderador') && to.path !== '/moderador/login'
  if (isModeratorArea && !moderatorStore.isLoggedIn) {
    return '/moderador/login'
  }

  const store = useCampeonatoStore()

  // NOVO - se estamos a entrar em qualquer página da área /admin (exceto
  // a própria /admin/setup) e ainda NÃO existe nenhuma password
  // configurada no backend, manda sempre para /admin/setup em vez de
  // /admin/login. Antes disto, ir direto a /admin/login sem nunca ter
  // configurado password mostrava o formulário de login normalmente, e só
  // ao submeter é que aparecia o erro "Admin ainda não foi configurado." -
  // confuso para quem está a montar o evento pela primeira vez, ou depois
  // de uma migração/reset ter apagado a tabela AdminAuth sem se
  // aperceberem.
  if (to.path.startsWith('/admin') && to.path !== '/admin/setup') {
    const configured = await isAdminConfigured()
    if (!configured) {
      return '/admin/setup'
    }
  }

  const isAdminArea = to.path.startsWith('/admin') && to.path !== '/admin/setup' && to.path !== '/admin/login'
  if (isAdminArea && !isAdminLoggedIn()) {
    return '/admin/login'
  }

  if (to.path.startsWith('/admin') && !from.path.startsWith('/admin')) {
    store.enterAdmin?.()
  } else if (!to.path.startsWith('/admin') && from.path.startsWith('/admin')) {
    store.exitAdmin?.()
  }

  if (RESUME_PATHS.includes(to.path)) {
    const target = await resumeRoute(store)
    if (target) return target
    if (to.path === '/moderador') return '/moderador/modo'
    return true
  }

  return true
})

export default router
