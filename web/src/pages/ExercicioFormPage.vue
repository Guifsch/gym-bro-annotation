<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ExercicioForm from '../components/exercicios/ExercicioForm.vue'
import PageHeader from '../components/PageHeader.vue'
import * as categoriasApi from '../api/categorias'
import * as exerciciosApi from '../api/exercicios'
import type { Categoria, Exercicio } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const snackbar = useSnackbar()

const categorias = ref<Categoria[]>([])
const exercicios = ref<Exercicio[]>([])
const loading = ref(true)

const mode = computed(() => (props.id ? 'edit' : 'create'))
const exercicio = computed(() => exercicios.value.find((item) => item._id === props.id) ?? null)
const notFound = computed(() => mode.value === 'edit' && !loading.value && !exercicio.value)

async function load(): Promise<void> {
  loading.value = true
  try {
    const [categoriasData, exerciciosData] = await Promise.all([
      categoriasApi.listCategorias(),
      exerciciosApi.listExercicios(),
    ])
    categorias.value = categoriasData
    exercicios.value = exerciciosData
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar o exercício.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function handleCreated(created: Exercicio): void {
  snackbar.success('Exercício criado.')
  router.replace(`/exercicios/${created._id}`)
}

function handleUpdated(updated: Exercicio): void {
  const index = exercicios.value.findIndex((item) => item._id === updated._id)
  if (index !== -1) exercicios.value[index] = updated
}

function handleDeleted(): void {
  snackbar.success('Exercício excluído.')
  router.push('/exercicios')
}
</script>

<template>
  <div>
    <PageHeader
      :title="mode === 'create' ? 'Novo exercício' : 'Editar exercício'"
      :subtitle="mode === 'create' ? 'Cadastre um novo exercício no seu catálogo.' : 'Atualize as informações do seu exercício.'"
      back="/exercicios"
    />

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="notFound">
      <VCardText class="text-center py-10">
        <p class="text-medium-emphasis text-body-2 mb-4">Este exercício foi removido.</p>
        <VBtn color="primary" to="/exercicios">Voltar para exercícios</VBtn>
      </VCardText>
    </VCard>

    <ExercicioForm
      v-else
      :mode="mode"
      :exercicio="exercicio"
      :categorias="categorias"
      :exercicios="exercicios"
      @created="handleCreated"
      @updated="handleUpdated"
      @deleted="handleDeleted"
    />
  </div>
</template>
