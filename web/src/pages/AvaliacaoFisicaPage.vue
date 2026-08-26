<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import * as bodyGoalsApi from '../api/bodyGoals'
import type { BodyGoalSummary } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'
import { clampMaxValue, maxValueRule } from '../utils/numberField'

const router = useRouter()
const snackbar = useSnackbar()

const goals = ref<BodyGoalSummary[]>([])
const loading = ref(true)
const createDialog = ref(false)
const form = reactive({ nome: '', pesoMetaKg: '' })
const creating = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    goals.value = await bodyGoalsApi.listBodyGoals()
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar as metas.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function createGoal(): Promise<void> {
  const pesoMetaKg = Number(form.pesoMetaKg)
  if (!pesoMetaKg || pesoMetaKg <= 0) return

  creating.value = true
  try {
    const goal = await bodyGoalsApi.createBodyGoal({ nome: form.nome.trim() || undefined, pesoMetaKg })
    router.push(`/avaliacao-fisica/${goal._id}`)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível criar a meta.'))
    creating.value = false
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function goalTitle(goal: BodyGoalSummary): string {
  return goal.nome?.trim() || `Meta de ${goal.pesoMetaKg} kg`
}

const deleteTarget = ref<BodyGoalSummary | null>(null)
const deleting = ref(false)

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await bodyGoalsApi.deleteBodyGoal(deleteTarget.value._id)
    goals.value = goals.value.filter((item) => item._id !== deleteTarget.value!._id)
    deleteTarget.value = null
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir a meta.'))
  } finally {
    deleting.value = false
  }
}

const hasGoals = computed(() => goals.value.length > 0)
</script>

<template>
  <div>
    <PageHeader title="Avaliação Física" subtitle="Acompanhe suas metas de peso e medidas.">
      <template #actions>
        <VBtn color="primary" size="small" prepend-icon="mdi-plus" @click="createDialog = true">Nova meta</VBtn>
      </template>
    </PageHeader>

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="!hasGoals">
      <VCardText class="empty-state py-12">
        <div class="empty-state__icon"><VIcon icon="mdi-flag-outline" size="34" color="primary" /></div>
        <p class="text-h6 font-weight-bold mt-4">Crie sua primeira meta</p>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Defina um peso-alvo e comece a registrar seu peso e medidas ao longo do tempo.
        </p>
        <VBtn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="createDialog = true">Nova meta</VBtn>
      </VCardText>
    </VCard>

    <div v-else>
      <VCard v-for="goal in goals" :key="goal._id" class="mb-3 goal-row">
        <VCardText class="d-flex align-center ga-4 flex-wrap">
          <RouterLink :to="`/avaliacao-fisica/${goal._id}`" class="goal-icon">
            <VIcon icon="mdi-flag-outline" size="24" color="primary" />
          </RouterLink>

          <RouterLink :to="`/avaliacao-fisica/${goal._id}`" class="goal-info">
            <p class="font-weight-bold">{{ goalTitle(goal) }}</p>
            <p class="text-body-2 text-medium-emphasis">Criada em {{ formatDate(goal.createdAt) }}</p>
          </RouterLink>

          <VSpacer />

          <div class="goal-stat">
            <span v-if="goal.latestPesoKg != null" class="goal-stat__value">{{ goal.latestPesoKg }} kg</span>
            <VIcon v-if="goal.latestPesoKg != null" icon="mdi-arrow-right" size="14" class="mx-1" />
            <VChip size="small" variant="tonal" color="primary">{{ goal.pesoMetaKg }} kg</VChip>
          </div>

          <VBtn icon="mdi-pencil-outline" variant="text" size="small" :to="`/avaliacao-fisica/${goal._id}`" />
          <VBtn icon="mdi-trash-can-outline" variant="text" size="small" color="error" @click="deleteTarget = goal" />
        </VCardText>
      </VCard>
    </div>

    <VDialog v-model="createDialog" max-width="420">
      <VCard>
        <VCardTitle>Nova meta</VCardTitle>
        <VCardText>
          <VForm class="d-flex flex-column ga-4" @submit.prevent="createGoal">
            <VTextField v-model="form.nome" label="Nome (opcional)" maxlength="80" autofocus />
            <VTextField
              v-model="form.pesoMetaKg"
              label="Meta de peso (kg)"
              type="number"
              min="0"
              max="500"
              :rules="[maxValueRule(500)]"
              @blur="form.pesoMetaKg = clampMaxValue(form.pesoMetaKg, 500)"
            />
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="createDialog = false">Cancelar</VBtn>
          <VBtn color="primary" :loading="creating" :disabled="!form.pesoMetaKg" @click="createGoal">Criar</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="!!deleteTarget" max-width="440" @update:model-value="deleteTarget = null">
      <VCard v-if="deleteTarget">
        <VCardTitle>Excluir meta</VCardTitle>
        <VCardText>
          Tem certeza que deseja excluir "{{ goalTitle(deleteTarget) }}"? Todos os registros de peso e medidas
          dessa meta também serão excluídos.
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="deleteTarget = null">Cancelar</VBtn>
          <VBtn color="error" :loading="deleting" @click="confirmDelete">Excluir</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.goal-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.goal-info {
  color: inherit;
  text-decoration: none;
  min-width: 0;
}

.goal-stat {
  display: flex;
  align-items: center;
}

.goal-stat__value {
  font-weight: 700;
  font-size: 0.95rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
