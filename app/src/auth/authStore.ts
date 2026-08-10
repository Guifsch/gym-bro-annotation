import { create } from 'zustand';

import { setOnSessionExpired } from '@/api/apiClient';

import * as authApi from './authApi';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from './secureStore';
import { clearAccessToken, setAccessToken } from './tokenMemory';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: authApi.AuthUser | null;
  bootstrap: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  updateProfile: (params: { name?: string; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  function clearSessionLocally() {
    clearAccessToken();
    void clearRefreshToken();
    set({ status: 'anonymous', user: null });
  }

  setOnSessionExpired(clearSessionLocally);

  return {
    status: 'idle',
    user: null,

    bootstrap: async () => {
      if (get().status === 'loading') return;
      set({ status: 'loading' });

      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        set({ status: 'anonymous', user: null });
        return;
      }

      try {
        const { user, accessToken } = await authApi.refreshSession(refreshToken);
        setAccessToken(accessToken);
        set({ status: 'authenticated', user });
      } catch {
        await clearRefreshToken();
        set({ status: 'anonymous', user: null });
      }
    },

    loginWithPassword: async (email, password) => {
      const { user, accessToken, refreshToken } = await authApi.login({ email, password });
      setAccessToken(accessToken);
      await setRefreshToken(refreshToken);
      set({ status: 'authenticated', user });
    },

    confirmRegistration: async (email, code) => {
      const { user, accessToken, refreshToken } = await authApi.registerConfirm({ email, code });
      setAccessToken(accessToken);
      await setRefreshToken(refreshToken);
      set({ status: 'authenticated', user });
    },

    updateProfile: async (params) => {
      const user = await authApi.updateProfile(params);
      set({ user });
    },

    logout: async () => {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // best-effort server-side logout; local session is cleared regardless
        }
      }
      clearSessionLocally();
    },
  };
});
