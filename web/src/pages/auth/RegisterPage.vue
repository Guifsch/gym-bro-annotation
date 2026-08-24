<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '../../components/auth/AuthShell.vue'
import * as authApi from '../../api/auth'
import { extractErrorMessage } from '../../utils/errors'

const router = useRouter()

const step = ref<'form' | 'code'>('form')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const code = ref('')

async function submitForm(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'As senhas precisam ser iguais.'
    return
  }

  loading.value = true
  try {
    const { message } = await authApi.registerRequest({
      name: form.name,
      email: form.email,
      password: form.password,
    })
    successMessage.value = message
    step.value = 'code'
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível enviar o código de confirmação.')
  } finally {
    loading.value = false
  }
}

async function submitCode(): Promise<void> {
  errorMessage.value = ''
  loading.value = true
  try {
    await authApi.registerConfirm({ email: form.email, code: code.value })
    router.push({ path: '/login', query: { registered: '1' } })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível confirmar o cadastro.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :title="step === 'form' ? 'Criar conta' : 'Confirme seu e-mail'"
    :subtitle="step === 'form' ? 'Organize seus treinos também pelo computador.' : 'Enviamos um código de 6 dígitos para o seu e-mail.'"
  >
    <VAlert v-if="successMessage" type="success" variant="tonal" class="mb-5">{{ successMessage }}</VAlert>
    <VAlert v-if="errorMessage" type="error" variant="tonal" class="mb-5">{{ errorMessage }}</VAlert>

    <VForm v-if="step === 'form'" @submit.prevent="submitForm">
      <VTextField
        v-model="form.name"
        label="Nome"
        autocomplete="name"
        maxlength="80"
        prepend-inner-icon="mdi-account-outline"
        class="mb-4"
      />
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
        autocomplete="new-password"
        maxlength="128"
        prepend-inner-icon="mdi-lock-outline"
        class="mb-4"
      />
      <VTextField
        v-model="form.confirmPassword"
        label="Confirmar senha"
        type="password"
        autocomplete="new-password"
        maxlength="128"
        prepend-inner-icon="mdi-shield-check-outline"
        class="mb-2"
      />

      <VBtn type="submit" class="auth-submit-btn mt-4" height="44" :loading="loading" block>Continuar</VBtn>
    </VForm>

    <VForm v-else @submit.prevent="submitCode">
      <VTextField
        v-model="form.email"
        label="E-mail"
        readonly
        prepend-inner-icon="mdi-email-outline"
        class="mb-4"
      />
      <VTextField
        v-model="code"
        label="Código de confirmação"
        inputmode="numeric"
        maxlength="6"
        prepend-inner-icon="mdi-shield-key-outline"
        class="mb-2"
      />

      <VBtn type="submit" class="auth-submit-btn mt-4" height="44" :loading="loading" block>
        Confirmar cadastro
      </VBtn>
    </VForm>

    <div class="auth-link-row mt-6 justify-center">
      <span>Já tem conta? <RouterLink to="/login">Entrar</RouterLink></span>
    </div>
  </AuthShell>
</template>
