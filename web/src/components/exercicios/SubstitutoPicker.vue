<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Categoria, Exercicio } from '../../types/workout'

const props = defineProps<{
  modelValue: string[]
  exercicios: Exercicio[]
  categorias: Categoria[]
  excludeId?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const dialogOpen = ref(false)

const candidatos = computed(() => props.exercicios.filter((exercicio) => exercicio._id !== props.excludeId))

const grupos = computed(() =>
  props.categorias
    .map((categoria) => ({
      categoria,
      exercicios: candidatos.value.filter((exercicio) => exercicio.categoriaId === categoria._id),
    }))
    .filter((grupo) => grupo.exercicios.length > 0)
)

function nomeDe(id: string): string {
  return candidatos.value.find((exercicio) => exercicio._id === id)?.nome ?? '—'
}

function remove(id: string): void {
  emit('update:modelValue', props.modelValue.filter((item) => item !== id))
}

function toggle(id: string): void {
  if (props.modelValue.includes(id)) {
    remove(id)
  } else if (props.modelValue.length < 20) {
    emit('update:modelValue', [...props.modelValue, id])
  }
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-2 mb-2">
      <VChip v-for="id in modelValue" :key="id" closable @click:close="remove(id)">
        {{ nomeDe(id) }}
      </VChip>
      <VBtn variant="outlined" size="small" prepend-icon="mdi-plus" @click="dialogOpen = true">
        Adicionar substituto
      </VBtn>
    </div>

    <VDialog v-model="dialogOpen" max-width="480">
      <VCard>
        <VCardTitle>Exercícios substitutos</VCardTitle>
        <VCardText class="dialog-scroll">
          <div v-for="grupo in grupos" :key="grupo.categoria._id" class="mb-2">
            <VListSubheader>{{ grupo.categoria.nome }}</VListSubheader>
            <VListItem
              v-for="exercicio in grupo.exercicios"
              :key="exercicio._id"
              :title="exercicio.nome"
              @click="toggle(exercicio._id)"
            >
              <template #prepend>
                <VCheckboxBtn :model-value="modelValue.includes(exercicio._id)" readonly />
              </template>
            </VListItem>
          </div>
          <p v-if="!grupos.length" class="text-medium-emphasis text-body-2">Nenhum outro exercício cadastrado.</p>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="primary" @click="dialogOpen = false">Concluído</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
