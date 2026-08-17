import axios, { AxiosError, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

import { clearRefreshToken, getRefreshToken } from '@/auth/secureStore';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/auth/tokenMemory';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

// Generous on purpose — the Render free tier can take dozens of seconds to wake a sleeping dyno
// (see pingHealth()), so this must not fire during a legitimate cold start. It exists purely so a
// genuinely broken connection (wrong URL, unreachable host, blocked port) fails with a visible
// error after a while instead of leaving the UI stuck on an infinite spinner forever.
const REQUEST_TIMEOUT_MS = 30_000;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// eslint-disable-next-line import/no-named-as-default-member -- axios.create is the correct default-export API, not the named export
export const apiClient = axios.create({ baseURL: API_URL, timeout: REQUEST_TIMEOUT_MS });

let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(callback: () => void): void {
  onSessionExpired = callback;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.error === 'string') {
    return err.response.data.error;
  }
  return fallback;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken }, { timeout: REQUEST_TIMEOUT_MS });
    const newAccessToken = response.data.accessToken as string;
    setAccessToken(newAccessToken);
    return newAccessToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      clearAccessToken();
      await clearRefreshToken();
      onSessionExpired?.();
      return Promise.reject(error);
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return apiClient(originalRequest);
  }
);
