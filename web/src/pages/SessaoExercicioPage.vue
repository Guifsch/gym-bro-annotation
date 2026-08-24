<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ExercicioForm from '../components/exercicios/ExercicioForm.vue'
import PageHeader from '../components/PageHeader.vue'
import * as sessoesApi from '../api/sessoes'
import * as exerciciosApi from '../api/exercicios'
import * as categoriasApi from '../api/categorias'
import type { Categoria, Exercicio, Sessao } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const props = defineProps<{ date: string; sessaoId: string; exercicioId: string }>()
const router = useRouter()
const snackbar = useSnackbar()

const loading = ref(true)
const sessao = ref<Sessao | null>(null)
const exercicios = ref<Exercicio[]>([])
const categorias = ref<Categoria[]>([])

const exercicio = computed(() => exercicios.value.find((item) => item._id === props.exercicioId) ?? null)
const entry = computed(() => sessao.value?.entries.find((item) => item.exercicioId === props.exercicioId) ?? null)
const notFound = computed(() => !loading.value && !exercicio.value)

async function load(): Promise<void> {
  loading.value = true
  try {
    const [sessaoData, exerciciosData, categoriasData] = await Promise.all([
      sessoesApi.getSessao(props.sessaoId),
      exerciciosApi.listExercicios(),
      categoriasApi.listCategorias(),
    ])
    sessao.value = sessaoData
    exercicios.value = exerciciosData
    categorias.value = categoriasData
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar o exercício.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function handleUpdated(updated: Exercicio): void {
  const index = exercicios.value.findIndex((item) => item._id === updated._id)
  if (index !== -1) exercicios.value[index] = updated
  snackbar.success('Exercício salvo.')
}

function handleDeleted(): void {
  snackbar.success('Exercício excluído.')
  router.push(`/calendario/${props.date}/${props.sessaoId}`)
}
</script>

<template>
  <div>
    <PageHeader :title="exercicio?.nome ?? 'Exercício'" :back="`/calendario/${date}/${sessaoId}`" />

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="notFound">
      <VCardText class="text-center py-10">
        <p class="text-medium-emphasis text-body-2 mb-4">Este exercício foi removido.</p>
        <VBtn color="primary" :to="`/calendario/${date}/${sessaoId}`">Voltar para a sessão</VBtn>
      </VCardText>
    </VCard>

    <ExercicioForm
      v-else
      mode="edit"
      :exercicio="exercicio"
      :categorias="categorias"
      :exercicios="exercicios"
      :sessao-context="{ sessaoId, entry }"
      @updated="handleUpdated"
      @deleted="handleDeleted"
    />
  </div>
</template>
