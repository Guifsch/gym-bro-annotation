<script setup lang="ts">
import { useThemeMode } from '../../composables/useThemeMode'

defineProps<{
  title: string
  subtitle?: string
}>()

const { isDark, toggle } = useThemeMode()
</script>

<template>
  <div class="auth-page">
    <VBtn
      :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
      variant="text"
      class="theme-toggle"
      :title="isDark ? 'Modo claro' : 'Modo escuro'"
      @click="toggle"
    />

    <VCard class="auth-card" max-width="480">
      <VCardText class="pa-6 pa-sm-10">
        <div class="auth-brand">
          <div class="auth-brand__badge">
            <VIcon icon="mdi-dumbbell" size="28" color="white" />
          </div>
          <span class="auth-brand__title">Gym Bro</span>
        </div>

        <h1 class="auth-title text-center">{{ title }}</h1>
        <p v-if="subtitle" class="auth-subtitle text-center">{{ subtitle }}</p>

        <div class="mt-6">
          <slot />
        </div>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-background));
  padding: 24px;
}

.theme-toggle {
  position: absolute;
  top: 20px;
  right: 20px;
}

.auth-card {
  width: 100%;
  border: 1px solid rgba(var(--v-theme-primary), 0.16);
}

.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}

.auth-brand__badge {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #138e5f 0%, #15b580 100%);
  box-shadow: 0 4px 16px rgba(21, 181, 128, 0.35);
}

.auth-brand__title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #15b580;
  text-shadow: 0 0 10px rgba(21, 181, 128, 0.35);
  letter-spacing: 0.02em;
}

.auth-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.auth-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.95rem;
}
</style>
