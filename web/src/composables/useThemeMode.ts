import { computed } from 'vue'
import { useTheme } from 'vuetify'

const STORAGE_KEY = 'gymbro-theme-mode'

export function useThemeMode() {
  const theme = useTheme()

  const isDark = computed(() => theme.global.name.value === 'gymBroDark')

  function toggle(): void {
    const next = isDark.value ? 'gymBro' : 'gymBroDark'
    theme.global.name.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next === 'gymBroDark' ? 'dark' : 'light')
    } catch {
      // localStorage unavailable — theme still switches for this session
    }
  }

  return { isDark, toggle }
}
