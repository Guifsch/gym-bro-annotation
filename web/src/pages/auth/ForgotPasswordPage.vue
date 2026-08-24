<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '../../components/auth/AuthShell.vue'
import * as authApi from '../../api/auth'
import { extractErrorMessage } from '../../utils/errors'

const router = useRouter()

const step = ref<'request' | 'confirm'>('request')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const email = ref('')
const form = reactive({ code: '', password: '', confirmPassword: '' })

async function submitRequest(): Promise<void> {
  errorMessage.value = ''
  loading.value = true
  try {
    const { message } = await authApi.forgotPassword({ email: email.value })
    successMessage.value = message
    step.value = 'confirm'
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível enviar o código de recuperação.')
  } finally {
    loading.value = false
  }
}

async function submitConfirm(): Promise<void> {
  errorMessage.value = ''

  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'As senhas precisam ser iguais.'
    return
  }

  loading.value = true
  try {
    await authApi.resetPassword({ email: email.value, code: form.code, password: form.password })
    router.push({ path: '/login', query: { reset: '1' } })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível redefinir a senha.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :title="step === 'request' ? 'Esqueci minha senha' : 'Redefinir senha'"
    :subtitle="
      step === 'request'
        ? 'Informe seu e-mail e enviaremos um código de redefinição.'
        : 'Digite o código recebido e escolha uma nova senha.'
    "
  >
    <VAlert v-if="successMessage" type="success" variant="tonal" class="mb-5">{{ successMessage }}</VAlert>
    <VAlert v-if="errorMessage" type="error" variant="tonal" class="mb-5">{{ errorMessage }}</VAlert>

    <VForm v-if="step === 'request'" @submit.prevent="submitRequest">
      <VTextField
        v-model="email"
        label="E-mail da conta"
        type="email"
        autocomplete="email"
        maxlength="254"
        prepend-inner-icon="mdi-email-fast-outline"
        class="mb-2"
      />

      <VBtn type="submit" class="auth-submit-btn mt-4" height="44" :loading="loading" block>Enviar código</VBtn>
    </VForm>

    <VForm v-else @submit.prevent="submitConfirm">
      <VTextField v-model="email" label="E-mail" readonly prepend-inner-icon="mdi-email-outline" class="mb-4" />
      <VTextField
        v-model="form.code"
        label="Código recebido"
        inputmode="numeric"
        maxlength="6"
        prepend-inner-icon="mdi-shield-key-outline"
        class="mb-4"
      />
      <VTextField
        v-model="form.password"
        label="Nova senha"
        type="password"
        autocomplete="new-password"
        maxlength="128"
        prepend-inner-icon="mdi-lock-reset"
        class="mb-4"
      />
      <VTextField
        v-model="form.confirmPassword"
        label="Confirmar nova senha"
        type="password"
        autocomplete="new-password"
        maxlength="128"
        prepend-inner-icon="mdi-shield-check-outline"
        class="mb-2"
      />

      <VBtn type="submit" class="auth-submit-btn mt-4" height="44" :loading="loading" block>
        Atualizar senha
      </VBtn>
    </VForm>

    <div class="auth-link-row mt-6 justify-center">
      <RouterLink to="/login">Voltar ao login</RouterLink>
    </div>
  </AuthShell>
</template>
