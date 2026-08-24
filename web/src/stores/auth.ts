import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import type { AuthUser } from '../types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const isSessionResolved = ref(false)
  const isLogged = computed(() => user.value !== null)

  async function bootstrap(): Promise<void> {
    try {
      const response = await authApi.me()
      user.value = response.user
    } catch {
      user.value = null
    } finally {
      isSessionResolved.value = true
    }
  }

  function setUser(next: AuthUser | null): void {
    user.value = next
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // cookies are cleared server-side best-effort; local state clears regardless
    }
    user.value = null
  }

  setUnauthorizedHandler(() => {
    user.value = null
  })

  return { user, isLogged, isSessionResolved, bootstrap, setUser, logout }
})
