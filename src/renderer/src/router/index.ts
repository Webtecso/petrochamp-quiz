import { createRouter, createWebHashHistory } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { useCampeonatoStore } from '../stores/campeonato'
import ModeradorLayout from '../views/ModeradorLayout.vue'
import AppEntryView from '../views/AppEntryView.vue'
import ServerConfigView from '../views/ServerConfigView.vue'
import ModeSelectView from '../views/ModeSelectView.vue'
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

const defaultPath = Capacitor.isNativePlatform() ? '/servidor' : '/moderador'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: defaultPath },
    { path: '/servidor', name: 'servidor', component: ServerConfigView },
    { path: '/inicio', name: 'inicio', component: AppEntryView },
    {
      path: '/moderador',
      component: ModeradorLayout,
      children: [
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
        { path: 'configuracoes', name: 'admin-configuracoes', component: AdminSettingsView }
      ]
    },
    { path: '/projecao', name: 'projecao', component: ProjecaoView },
    { path: '/jogador', name: 'jogador-entrada', component: JogadorEntryView },
    { path: '/jogador/jogo', name: 'jogador-jogo', component: JogadorGameView },
    { path: '/jogador/resultado', name: 'jogador-resultado', component: JogadorResultView }
  ]
})

const ONBOARDING_PATHS = ['/moderador', '/moderador/modo', '/moderador/campeonato']

router.beforeEach((to, from) => {
  const store = useCampeonatoStore()

  if (to.path.startsWith('/admin') && !from.path.startsWith('/admin')) {
    store.enterAdmin()
  } else if (!to.path.startsWith('/admin') && from.path.startsWith('/admin')) {
    store.exitAdmin()
  }

  if (!ONBOARDING_PATHS.includes(to.path)) return true

  if (store.presentationFlow.stage !== 'idle') {
    return '/moderador/apresentacao'
  }
  if (store.teamA && store.teamB) {
    return '/moderador/jogo'
  }
  return true
})

export default router
