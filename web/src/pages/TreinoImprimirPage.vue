<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as treinosApi from '../api/treinos'
import * as categoriasApi from '../api/categorias'
import * as exerciciosApi from '../api/exercicios'
import type { Categoria, Exercicio, Treino } from '../types/workout'
import { generateTreinoPdf, type TreinoPdfGrupo } from '../utils/treinoPdf'

const props = defineProps<{ id: string }>()

const loading = ref(true)
const notFound = ref(false)
const generating = ref(false)
const done = ref(false)
const treino = ref<Treino | null>(null)
const categorias = ref<Categoria[]>([])
const exerciciosData = ref<Exercicio[]>([])
const dataGeracao = ref('')
const capaDataUrlById = ref<Record<string, string>>({})

async function load(): Promise<void> {
  loading.value = true
  try {
    const [treinoData, categoriasData, exerciciosResult] = await Promise.all([
      treinosApi.getTreino(props.id),
      categoriasApi.listCategorias(),
      exerciciosApi.listExercicios(),
    ])
    treino.value = treinoData
    categorias.value = categoriasData
    exerciciosData.value = exerciciosResult

    const hoje = new Date()
    dataGeracao.value = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// The API already re-encodes cover photos down to a small JPEG (GET .../capa/thumb) — the
// storage bucket has no CORS policy, so the browser can't read the original's pixels itself,
// and embedding the original at full resolution is what made the PDF heavy in the first place.
async function loadCapaDataUrl(id: string): Promise<[string, string] | null> {
  try {
    const blob = await exerciciosApi.getExercicioCapaThumb(id)
    return [id, await blobToDataUrl(blob)]
  } catch {
    return null
  }
}

const exercicios = computed(() => {
  const ids = new Set(treino.value?.exercicioIds ?? [])
  return exerciciosData.value.filter((exercicio) => ids.has(exercicio._id))
})

const grupos = computed(() =>
  categorias.value
    .map((categoria) => ({
      categoria,
      exercicios: exercicios.value
        .filter((exercicio) => exercicio.categoriaId === categoria._id)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    }))
    .filter((grupo) => grupo.exercicios.length > 0)
)

const substitutosDisplayById = computed(() => {
  const map = new Map<string, Map<string, string>>()
  const nomeDe = (id: string) => exerciciosData.value.find((e) => e._id === id)?.nome

  function add(ownerId: string, subId: string, subNome: string): void {
    if (!map.has(ownerId)) map.set(ownerId, new Map())
    map.get(ownerId)!.set(subId, subNome)
  }

  for (const exercicio of exerciciosData.value) {
    for (const subId of exercicio.substitutoIds) {
      const subNome = nomeDe(subId)
      if (subNome) add(exercicio._id, subId, subNome)
      add(subId, exercicio._id, exercicio.nome)
    }
  }
  return map
})

function substitutosDe(id: string): string[] {
  return [...(substitutosDisplayById.value.get(id)?.values() ?? [])]
}

async function baixarPdf(): Promise<void> {
  if (!treino.value) return
  generating.value = true
  try {
    const idsWithCapa = exercicios.value.filter((exercicio) => exercicio.capa).map((exercicio) => exercicio._id)
    const resolved = await Promise.all(idsWithCapa.map(loadCapaDataUrl))
    capaDataUrlById.value = Object.fromEntries(resolved.filter((entry): entry is [string, string] => entry !== null))

    const pdfGrupos: TreinoPdfGrupo[] = grupos.value.map((grupo) => ({
      categoriaNome: grupo.categoria.nome,
      exercicios: grupo.exercicios.map((exercicio) => ({
        nome: exercicio.nome,
        sets: exercicio.sets,
        reps: exercicio.reps,
        pesoKg: exercicio.pesoKg,
        imageDataUrl: capaDataUrlById.value[exercicio._id],
        substitutos: substitutosDe(exercicio._id),
      })),
    }))

    generateTreinoPdf({ treinoNome: treino.value.nome, dataGeracao: dataGeracao.value, grupos: pdfGrupos })
    done.value = true
  } finally {
    generating.value = false
  }
}

function closePage(): void {
  window.close()
}

onMounted(async () => {
  await load()
  if (treino.value) {
    await baixarPdf()
  }
})
</script>

<template>
  <div class="imprimir-page">
    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate color="primary" />
      <p class="text-medium-emphasis text-body-2 mt-4">Carregando treino...</p>
    </div>

    <div v-else-if="notFound" class="text-center py-10">
      <p class="text-medium-emphasis text-body-2">Não foi possível carregar este treino.</p>
    </div>

    <div v-else-if="treino" class="text-center py-10">
      <VIcon icon="mdi-file-pdf-box" size="48" color="primary" class="mb-3" />
      <h1 class="text-h6 font-weight-bold">{{ treino.nome }}</h1>
      <p class="text-medium-emphasis text-body-2 mt-1">
        {{ generating ? 'Gerando PDF...' : done ? 'PDF baixado.' : 'Preparando...' }}
      </p>

      <div class="d-flex justify-center ga-2 mt-6">
        <VBtn color="primary" prepend-icon="mdi-download" :loading="generating" @click="baixarPdf">
          Baixar novamente
        </VBtn>
        <VBtn variant="outlined" @click="closePage">Fechar</VBtn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.imprimir-page {
  max-width: 420px;
  margin: 0 auto;
  padding: 32px 24px;
}
</style>
