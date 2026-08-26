<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useThemeMode } from '../composables/useThemeMode'
import { usePageTitle } from '../composables/usePageTitle'

const router = useRouter()
const auth = useAuthStore()
const { isDark, toggle: toggleTheme } = useThemeMode()
const { pageTitle } = usePageTitle()

const navItems = [
  { title: 'Calendário', icon: 'mdi-calendar-month-outline', to: '/calendario' },
  { title: 'Categorias', icon: 'mdi-shape-outline', to: '/categorias' },
  { title: 'Exercícios', icon: 'mdi-dumbbell', to: '/exercicios' },
  { title: 'Treinos', icon: 'mdi-clipboard-list-outline', to: '/treinos' },
  { title: 'Alimentação', icon: 'mdi-food-apple-outline', to: '/alimentacao' },
  { title: 'Avaliação Física', icon: 'mdi-clipboard-pulse-outline', to: '/avaliacao-fisica' },
  { title: 'Relatórios', icon: 'mdi-chart-bar', to: '/relatorios' },
]

const drawerOpen = ref(true)
const loggingOut = ref(false)

const initials = computed(() => {
  const name = auth.user?.name?.trim() ?? ''
  if (!name) return '?'
  const parts = name.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
})

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <VApp>
    <VNavigationDrawer v-model="drawerOpen" width="224" class="app-drawer">
      <div class="app-drawer-inner">
        <div class="app-brand">
          <div class="app-brand__badge">
            <VIcon icon="mdi-dumbbell" size="18" color="white" />
          </div>
          <span class="app-brand__title">Gym Bro</span>
        </div>

        <VList nav density="compact" class="app-nav app-nav--scroll">
          <VListItem
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
          />
        </VList>

        <div class="app-drawer-footer">
          <VList nav density="compact" class="app-nav app-nav--append">
            <VListItem :title="isDark ? 'Modo claro' : 'Modo escuro'" @click="toggleTheme">
              <template #prepend>
                <VIcon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" size="20" />
              </template>
              <template #append>
                <VSwitch :model-value="isDark" density="compact" hide-details readonly class="app-theme-switch" />
              </template>
            </VListItem>
          </VList>

          <RouterLink to="/conta" class="app-profile">
            <VAvatar size="34" color="rgba(255,255,255,0.18)">
              <span class="app-profile__initials">{{ initials }}</span>
            </VAvatar>
            <div class="app-profile__text">
              <span class="app-profile__name">{{ auth.user?.name }}</span>
              <span class="app-profile__link">Ver perfil</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </VNavigationDrawer>

    <VAppBar flat class="app-bar" height="68">
      <VBtn icon="mdi-menu" variant="text" @click="drawerOpen = !drawerOpen" />
      <div class="app-bar__title">
        <span class="app-bar__title-main">{{ pageTitle.title }}</span>
        <span v-if="pageTitle.subtitle" class="app-bar__title-sub">{{ pageTitle.subtitle }}</span>
      </div>

      <VSpacer />

      <VMenu>
        <template #activator="{ props: menuProps }">
          <VBtn variant="text" class="app-user-btn" v-bind="menuProps">
            <VAvatar size="30" color="primary" class="mr-2">
              <span class="app-user-btn__initials">{{ initials }}</span>
            </VAvatar>
            <span class="app-user-btn__name">{{ auth.user?.name }}</span>
            <VIcon icon="mdi-chevron-down" size="18" class="ml-1" />
          </VBtn>
        </template>
        <VList density="compact" min-width="180">
          <VListItem to="/conta" prepend-icon="mdi-account-circle-outline" title="Conta" />
          <VListItem
            prepend-icon="mdi-logout"
            title="Sair"
            :disabled="loggingOut"
            @click="handleLogout"
          />
        </VList>
      </VMenu>
    </VAppBar>

    <VMain scrollable>
      <VContainer class="page-container pa-8">
        <RouterView />
      </VContainer>
    </VMain>
  </VApp>
</template>

<style scoped>
.app-drawer {
  background: linear-gradient(180deg, #0c573f 0%, #0b7a56 100%) !important;
  border: none !important;
}

.app-drawer :deep(.v-navigation-drawer__content) {
  height: 100%;
  overflow: hidden;
}

.app-drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-nav--scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.app-drawer-footer {
  flex: none;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 16px;
}

.app-brand__badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

.app-brand__title {
  font-weight: 800;
  font-size: 1.1rem;
  color: #fff;
}

.app-nav {
  padding-left: 8px;
  padding-right: 8px;
}

.app-nav :deep(.v-list-item-title) {
  font-size: 0.92rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.app-nav :deep(.v-icon) {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.85);
}

.app-nav :deep(.v-list-item) {
  border-radius: 10px;
  margin-bottom: 2px;
}

.app-nav :deep(.v-list-item--active) {
  background: rgba(255, 255, 255, 0.16);
}

.app-nav :deep(.v-list-item--active .v-list-item-title),
.app-nav :deep(.v-list-item--active .v-icon) {
  color: #fff;
}

.app-nav--append {
  margin-bottom: 4px;
}

.app-theme-switch {
  transform: scale(0.8);
}

.app-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 18px;
  text-decoration: none;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.app-profile__initials {
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
}

.app-profile__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-profile__name {
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-profile__link {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
}

.app-bar {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.app-bar__title {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  margin-left: 4px;
}

.app-bar__title-main {
  font-weight: 700;
  font-size: 1.2rem;
}

.app-bar__title-sub {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.app-user-btn {
  text-transform: none;
  padding-inline: 8px;
}

.app-user-btn__initials {
  color: #fff;
  font-weight: 700;
  font-size: 0.78rem;
}

.app-user-btn__name {
  font-size: 0.92rem;
  font-weight: 600;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
