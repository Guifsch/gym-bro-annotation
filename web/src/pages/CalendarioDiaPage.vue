<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import * as sessoesApi from '../api/sessoes'
import * as treinosApi from '../api/treinos'
import * as refeicoesApi from '../api/refeicoes'
import * as attendanceApi from '../api/attendance'
import type { Refeicao, Treino } from '../types/workout'
import type { SessaoDia } from '../api/sessoes'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const props = defineProps<{ date: string }>()
const snackbar = useSnackbar()

const loading = ref(true)
const sessoesDoDia = ref<SessaoDia[]>([])
const treinos = ref<Treino[]>([])
const refeicoes = ref<Refeicao[]>([])
const presente = ref(false)
const togglingPresenca = ref(false)
const togglingTreinoId = ref<string | null>(null)
const togglingRefeicaoId = ref<string | null>(null)

const dataFormatada = computed(() => {
  const [y, m, d] = props.date.split('-')
  return `${d}/${m}/${y}`
})

const refeicoesDoDia = computed(() => refeicoes.value.filter((refeicao) => refeicao.dates.includes(props.date)))

async function load(): Promise<void> {
  loading.value = true
  try {
    const [sessoesData, treinosData, refeicoesData, checked] = await Promise.all([
      sessoesApi.listSessoesForDay(props.date),
      treinosApi.listTreinos(),
      refeicoesApi.listRefeicoes(),
      attendanceApi.getAttendance(props.date),
    ])
    sessoesDoDia.value = sessoesData
    treinos.value = treinosData
    refeicoes.value = refeicoesData
    presente.value = checked
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar este dia.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function togglePresenca(): Promise<void> {
  const next = !presente.value
  togglingPresenca.value = true
  try {
    presente.value = await attendanceApi.setAttendance(props.date, next)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar a presença.'))
  } finally {
    togglingPresenca.value = false
  }
}

function treinoLinkado(treinoId: string): SessaoDia | undefined {
  return sessoesDoDia.value.find((sessao) => sessao.treinoId === treinoId)
}

async function toggleTreino(treino: Treino): Promise<void> {
  togglingTreinoId.value = treino._id
  try {
    const existing = treinoLinkado(treino._id)
    if (existing) {
      await sessoesApi.deleteSessao(existing._id)
      sessoesDoDia.value = sessoesDoDia.value.filter((sessao) => sessao._id !== existing._id)
    } else {
      const sessao = await sessoesApi.createSessaoDia({ treinoId: treino._id, date: props.date })
      sessoesDoDia.value.push({ _id: sessao._id, treinoId: treino._id, treinoNome: treino.nome, date: props.date })
    }
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar o treino do dia.'))
  } finally {
    togglingTreinoId.value = null
  }
}

async function toggleRefeicao(refeicao: Refeicao): Promise<void> {
  togglingRefeicaoId.value = refeicao._id
  try {
    const linked = refeicao.dates.includes(props.date)
    const dates = linked ? refeicao.dates.filter((d) => d !== props.date) : [...refeicao.dates, props.date]
    const updated = await refeicoesApi.updateRefeicao(refeicao._id, { dates })
    const index = refeicoes.value.findIndex((item) => item._id === refeicao._id)
    if (index !== -1) refeicoes.value[index] = updated
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar a refeição do dia.'))
  } finally {
    togglingRefeicaoId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader :title="dataFormatada" back="/calendario">
      <template #actions>
        <VCheckbox
          :model-value="presente"
          label="Fui na academia neste dia"
          color="primary"
          hide-details
          density="compact"
          :disabled="togglingPresenca"
          @update:model-value="togglePresenca"
        />
      </template>
    </PageHeader>

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VRow v-else>
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>Registrado neste dia</VCardTitle>
          <VCardText v-if="!sessoesDoDia.length && !refeicoesDoDia.length" class="text-medium-emphasis text-body-2">
            Nada vinculado a este dia ainda.
          </VCardText>
          <VList v-else>
            <VListItem
              v-for="sessao in sessoesDoDia"
              :key="sessao._id"
              :to="`/calendario/${date}/${sessao._id}`"
              prepend-icon="mdi-clipboard-list-outline"
              :title="sessao.treinoNome"
              subtitle="Treino"
            />
            <VListItem
              v-for="refeicao in refeicoesDoDia"
              :key="refeicao._id"
              :to="`/alimentacao/${refeicao._id}`"
              prepend-icon="mdi-food-apple-outline"
              :title="refeicao.nome"
              subtitle="Alimentação"
            />
          </VList>
        </VCard>
      </VCol>

      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>Vincular a este dia</VCardTitle>
          <VCardText>
            <p class="text-eyebrow mb-1">Treinos</p>
            <VList density="compact">
              <VListItem
                v-for="treino in treinos"
                :key="treino._id"
                :title="treino.nome"
                @click="toggleTreino(treino)"
              >
                <template #prepend>
                  <VCheckboxBtn :model-value="!!treinoLinkado(treino._id)" :loading="togglingTreinoId === treino._id" readonly />
                </template>
              </VListItem>
              <p v-if="!treinos.length" class="text-medium-emphasis text-body-2">Nenhum treino cadastrado ainda.</p>
            </VList>

            <p class="text-eyebrow mt-4 mb-1">Refeições</p>
            <VList density="compact">
              <VListItem
                v-for="refeicao in refeicoes"
                :key="refeicao._id"
                :title="refeicao.nome"
                @click="toggleRefeicao(refeicao)"
              >
                <template #prepend>
                  <VCheckboxBtn
                    :model-value="refeicao.dates.includes(date)"
                    :loading="togglingRefeicaoId === refeicao._id"
                    readonly
                  />
                </template>
              </VListItem>
              <p v-if="!refeicoes.length" class="text-medium-emphasis text-body-2">Nenhuma refeição cadastrada ainda.</p>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

