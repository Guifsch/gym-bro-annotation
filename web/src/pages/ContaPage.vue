<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import * as authApi from '../api/auth'
import { useAuthStore } from '../stores/auth'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const auth = useAuthStore()
const router = useRouter()
const snackbar = useSnackbar()

const profile = reactive({
  name: auth.user?.name ?? '',
  email: auth.user?.email ?? '',
})
const savingProfile = ref(false)

const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const savingPassword = ref(false)
const passwordError = ref('')

const loggingOut = ref(false)

const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

async function saveProfile(): Promise<void> {
  savingProfile.value = true
  try {
    const { user } = await authApi.updateProfile({ name: profile.name.trim(), email: profile.email.trim() })
    auth.setUser(user)
    snackbar.success('Perfil atualizado.')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar o perfil.'))
  } finally {
    savingProfile.value = false
  }
}

async function changePassword(): Promise<void> {
  passwordError.value = ''

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'As senhas precisam ser iguais.'
    return
  }

  savingPassword.value = true
  try {
    await authApi.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    snackbar.success('Senha atualizada.')
  } catch (error) {
    passwordError.value = extractErrorMessage(error, 'Não foi possível trocar a senha.')
  } finally {
    savingPassword.value = false
  }
}

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div>
    <PageHeader title="Conta" subtitle="Gerencie seus dados e preferências de acesso." />

    <VCard class="mb-4" max-width="520">
      <VCardText>
        <div class="section-heading">
          <span class="section-icon"><VIcon icon="mdi-account-outline" size="20" color="primary" /></span>
          <div>
            <p class="section-heading__title">Perfil</p>
            <p class="text-hint">Atualize suas informações pessoais.</p>
          </div>
        </div>

        <VForm class="d-flex flex-column ga-4" @submit.prevent="saveProfile">
          <VTextField v-model="profile.name" label="Nome" maxlength="80" />
          <VTextField v-model="profile.email" label="E-mail" type="email" maxlength="254" />
          <VBtn
            color="primary"
            type="submit"
            prepend-icon="mdi-content-save-outline"
            :loading="savingProfile"
            style="align-self: start"
          >
            Salvar
          </VBtn>
        </VForm>
      </VCardText>
    </VCard>

    <VCard class="mb-4" max-width="520">
      <VCardText>
        <div class="section-heading">
          <span class="section-icon"><VIcon icon="mdi-lock-outline" size="20" color="primary" /></span>
          <div>
            <p class="section-heading__title">Trocar senha</p>
            <p class="text-hint">Mantenha sua conta segura alterando sua senha regularmente.</p>
          </div>
        </div>

        <VAlert v-if="passwordError" type="error" variant="tonal" class="mb-4" density="compact">
          {{ passwordError }}
        </VAlert>

        <VForm class="d-flex flex-column ga-4" @submit.prevent="changePassword">
          <VTextField
            v-model="passwordForm.currentPassword"
            label="Senha atual"
            :type="showCurrentPassword ? 'text' : 'password'"
            maxlength="128"
            :append-inner-icon="showCurrentPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            @click:append-inner="showCurrentPassword = !showCurrentPassword"
          />
          <VTextField
            v-model="passwordForm.newPassword"
            label="Nova senha"
            :type="showNewPassword ? 'text' : 'password'"
            maxlength="128"
            :append-inner-icon="showNewPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            @click:append-inner="showNewPassword = !showNewPassword"
          />
          <VTextField
            v-model="passwordForm.confirmPassword"
            label="Confirmar nova senha"
            :type="showConfirmPassword ? 'text' : 'password'"
            maxlength="128"
            :append-inner-icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            @click:append-inner="showConfirmPassword = !showConfirmPassword"
          />
          <VBtn
            color="primary"
            type="submit"
            prepend-icon="mdi-lock-outline"
            :loading="savingPassword"
            style="align-self: start"
          >
            Atualizar senha
          </VBtn>
        </VForm>
      </VCardText>
    </VCard>

    <VBtn variant="outlined" color="error" prepend-icon="mdi-logout" :loading="loggingOut" @click="handleLogout">
      Sair
    </VBtn>
  </div>
</template>

<style scoped>
.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.section-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-heading__title {
  font-size: 1.05rem;
  font-weight: 700;
}
</style>
