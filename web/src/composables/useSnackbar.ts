import { reactive } from 'vue'

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

function open(text: string, color: 'success' | 'error'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function close(): void {
  snackbar.show = false
}

export function useSnackbar() {
  return {
    snackbar,
    success: (text: string) => open(text, 'success'),
    error: (text: string) => open(text, 'error'),
    close,
  }
}
