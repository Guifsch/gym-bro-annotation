import { reactive, readonly } from 'vue'

const state = reactive({ title: '', subtitle: '' })

export function usePageTitle() {
  function setPageTitle(title: string, subtitle = ''): void {
    state.title = title
    state.subtitle = subtitle
  }

  return { pageTitle: readonly(state), setPageTitle }
}
