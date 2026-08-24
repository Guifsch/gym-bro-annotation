import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/auth/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../pages/auth/RegisterPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../pages/auth/ForgotPasswordPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/treinos/:id/imprimir',
      name: 'treino-imprimir',
      component: () => import('../pages/TreinoImprimirPage.vue'),
      props: true,
    },
    {
      path: '/',
      component: () => import('../layouts/AppShell.vue'),
      children: [
        { path: '', redirect: '/calendario' },
        { path: 'calendario', name: 'calendario', component: () => import('../pages/CalendarioPage.vue') },
        {
          path: 'calendario/:date',
          name: 'calendario-dia',
          component: () => import('../pages/CalendarioDiaPage.vue'),
          props: true,
        },
        {
          path: 'calendario/:date/:sessaoId',
          name: 'sessao',
          component: () => import('../pages/SessaoPage.vue'),
          props: true,
        },
        {
          path: 'calendario/:date/:sessaoId/:exercicioId',
          name: 'sessao-exercicio',
          component: () => import('../pages/SessaoExercicioPage.vue'),
          props: true,
        },
        { path: 'categorias', name: 'categorias', component: () => import('../pages/CategoriasPage.vue') },
        { path: 'exercicios', name: 'exercicios', component: () => import('../pages/ExerciciosPage.vue') },
        {
          path: 'exercicios/novo',
          name: 'exercicio-novo',
          component: () => import('../pages/ExercicioFormPage.vue'),
        },
        {
          path: 'exercicios/:id',
          name: 'exercicio-editar',
          component: () => import('../pages/ExercicioFormPage.vue'),
          props: true,
        },
        { path: 'treinos', name: 'treinos', component: () => import('../pages/TreinosPage.vue') },
        {
          path: 'treinos/:id',
          name: 'treino-editar',
          component: () => import('../pages/TreinoEditorPage.vue'),
          props: true,
        },
        { path: 'alimentacao', name: 'alimentacao', component: () => import('../pages/AlimentacaoPage.vue') },
        {
          path: 'alimentacao/:id',
          name: 'refeicao-editar',
          component: () => import('../pages/RefeicaoEditorPage.vue'),
          props: true,
        },
        { path: 'relatorios', name: 'relatorios', component: () => import('../pages/RelatoriosPage.vue') },
        { path: 'conta', name: 'conta', component: () => import('../pages/ContaPage.vue') },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.isSessionResolved) {
    await auth.bootstrap()
  }

  if (to.meta.guestOnly && auth.isLogged) {
    return { path: '/calendario' }
  }

  if (!to.meta.guestOnly && !auth.isLogged) {
    return { path: '/login' }
  }

  return true
})

export default router
