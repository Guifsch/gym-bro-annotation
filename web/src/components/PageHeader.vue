<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePageTitle } from '../composables/usePageTitle'

const props = defineProps<{
  title: string
  subtitle?: string
  /** Fallback destination — used only when there's no actual browser-history entry to go back
   * to (e.g. the page was opened directly via a link or a refresh). Otherwise `goBack` returns
   * wherever the user actually came from instead of always landing on this fixed route. */
  back?: string
}>()

const { setPageTitle } = usePageTitle()
const router = useRouter()

watch(
  () => [props.title, props.subtitle],
  () => setPageTitle(props.title, props.subtitle ?? ''),
  { immediate: true }
)

function goBack(): void {
  if (window.history.state?.back) {
    router.back()
  } else if (props.back) {
    router.push(props.back)
  }
}
</script>

<template>
  <div v-if="back || $slots.actions" class="page-header mb-4">
    <VBtn v-if="back" icon="mdi-arrow-left" variant="text" size="small" @click="goBack" />
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
