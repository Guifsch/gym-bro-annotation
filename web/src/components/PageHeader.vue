<script setup lang="ts">
import { watch } from 'vue'
import { usePageTitle } from '../composables/usePageTitle'

const props = defineProps<{
  title: string
  subtitle?: string
  back?: string
}>()

const { setPageTitle } = usePageTitle()

watch(
  () => [props.title, props.subtitle],
  () => setPageTitle(props.title, props.subtitle ?? ''),
  { immediate: true }
)
</script>

<template>
  <div v-if="back || $slots.actions" class="page-header mb-4">
    <VBtn v-if="back" icon="mdi-arrow-left" variant="text" size="small" :to="back" />
    <VSpacer />
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
