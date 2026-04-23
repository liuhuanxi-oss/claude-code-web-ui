import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/claude/ChatView.vue'),
    },
    {
      path: '/files',
      component: () => import('../views/claude/FilesView.vue'),
    },
    {
      path: '/terminal',
      component: () => import('../views/claude/TerminalView.vue'),
    },
    {
      path: '/jobs',
      component: () => import('../views/claude/JobsView.vue'),
    },
    {
      path: '/usage',
      component: () => import('../views/claude/UsageView.vue'),
    },
    {
      path: '/settings',
      component: () => import('../views/claude/SettingsView.vue'),
    },
  ],
})

export default router
