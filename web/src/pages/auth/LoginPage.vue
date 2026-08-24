<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '../../components/auth/AuthShell.vue'
import * as authApi from '../../api/auth'
import { useAuthStore } from '../../stores/auth'
import { extractErrorMessage } from '../../utils/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const errorMessage = ref('')

const successMessage = computed(() => {
  if (route.query.registered === '1') return 'Conta criada com sucesso. Faça login para continuar.'
  if (route.query.reset === '1') return 'Senha redefinida. Entre com sua nova senha.'
  return ''
})

async function submit(): Promise<void> {
  errorMessage.value = ''
  loading.value = true
  try {
    const { user } = await authApi.login({ email: form.email, password: form.password })
    auth.setUser(user)
    router.push('/calendario')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível fazer login.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Bem-vindo de volta" subtitle="Acesse sua conta para continuar seus treinos.">
    <VAlert v-if="successMessage" type="success" variant="tonal" class="mb-5">{{ successMessage }}</VAlert>
    <VAlert v-if="errorMessage" type="error" variant="tonal" class="mb-5">{{ errorMessage }}</VAlert>

    <VForm @submit.prevent="submit">
      <VTextField
        v-model="form.email"
        label="E-mail"
        type="email"
        autocomplete="email"
        maxlength="254"
        prepend-inner-icon="mdi-email-outline"
        class="mb-4"
      />
      <VTextField
        v-model="form.password"
        label="Senha"
        type="password"
        autocomplete="current-password"
        maxlength="128"
        prepend-inner-icon="mdi-lock-outline"
        class="mb-2"
      />

      <VBtn type="submit" class="auth-submit-btn mt-4" height="44" :loading="loading" block>Entrar</VBtn>
    </VForm>

    <div class="auth-link-row mt-6">
      <RouterLink to="/register">Criar conta</RouterLink>
      <RouterLink to="/forgot-password">Esqueci minha senha</RouterLink>
    </div>
  </AuthShell>
</template>
