<script setup lang="ts">
import { ref, watch } from 'vue'
import * as exerciciosApi from '../../api/exercicios'
import type { ExercicioHistoricoEntry } from '../../types/workout'
import { formatDateTimeBRT } from '../../utils/date'
import { useSnackbar } from '../../composables/useSnackbar'
import { extractErrorMessage } from '../../utils/errors'

const props = defineProps<{ modelValue: boolean; exercicioId: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const snackbar = useSnackbar()
const historico = ref<ExercicioHistoricoEntry[]>([])
const loading = ref(false)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    loading.value = true
    try {
      historico.value = await exerciciosApi.getExercicioHistorico(props.exercicioId)
    } catch (error) {
      snackbar.error(extractErrorMessage(error, 'Não foi possível carregar o histórico.'))
    } finally {
      loading.value = false
    }
  }
)

async function removeEntry(entryId: string): Promise<void> {
  try {
    historico.value = await exerciciosApi.deleteExercicioHistoricoEntry(props.exercicioId, entryId)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir o registro.'))
  }
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="480" @update:model-value="(v) => emit('update:modelValue', v)">
    <VCard>
      <VCardTitle>Histórico de edições</VCardTitle>
      <VCardText class="dialog-scroll">
        <div v-if="loading" class="text-center py-6">
          <VProgressCircular indeterminate color="primary" />
        </div>
        <p v-else-if="!historico.length" class="text-medium-emphasis text-body-2">Nenhuma alteração registrada ainda.</p>
        <VList v-else density="compact">
          <VListItem v-for="entry in historico" :key="entry._id" class="historico-item py-2">
            <VListItemTitle class="historico-item__title">{{ entry.nome }}</VListItemTitle>
            <VListItemSubtitle class="historico-item__subtitle">
              {{ entry.sets ?? '—' }}x{{ entry.reps ?? '—' }} · {{ entry.pesoKg ?? '—' }}kg ·
              {{ formatDateTimeBRT(entry.alteradoEm) }}
            </VListItemSubtitle>
            <template #append>
              <VBtn icon="mdi-trash-can-outline" variant="text" size="small" @click="removeEntry(entry._id)" />
            </template>
          </VListItem>
        </VList>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="emit('update:modelValue', false)">Fechar</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.historico-item :deep(.v-list-item-title),
.historico-item :deep(.v-list-item-subtitle) {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  -webkit-line-clamp: unset;
}

.historico-item__title {
  word-break: break-word;
}

.historico-item__subtitle {
  word-break: break-word;
}
</style>
