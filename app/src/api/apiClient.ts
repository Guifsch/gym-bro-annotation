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
  _timeoutTimer?: ReturnType<typeof setTimeout>;
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

/** Resolves `value` after `ms` no matter what — used to put a hard ceiling on operations whose
 * underlying promise (native module, flaky connection) might never settle on its own. */
function withHardTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  // Belt-and-suspenders alongside axios' own `timeout`: React Native's networking layer has known
  // cases where the native XHR timer never fires even though the connection is genuinely dead
  // (switching wifi/cellular mid-request, gym wifi captive portals, phone locking mid-request).
  // AbortController is driven by a plain JS setTimeout instead, so it fires regardless of what the
  // native layer is doing, guaranteeing every request eventually settles.
  const controller = new AbortController();
  config.signal = controller.signal;
  (config as RetryableRequestConfig)._timeoutTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return config;
});

function clearRequestTimer(config: unknown): void {
  const timer = (config as RetryableRequestConfig | undefined)?._timeoutTimer;
  if (timer) clearTimeout(timer);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const response = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken }, { timeout: REQUEST_TIMEOUT_MS });
    const newAccessToken = response.data.accessToken as string;
    setAccessToken(newAccessToken);
    return newAccessToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    clearRequestTimer(response.config);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    clearRequestTimer(originalRequest);

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    // Hard ceiling on top of refreshAccessToken()'s own timeouts: this promise is a mutex shared by
    // every in-flight request that hits a 401, so if it ever failed to settle, the whole app would
    // wait on it forever — exactly the "everything hangs until I force-quit" failure mode.
    refreshPromise ??= withHardTimeout(refreshAccessToken(), REQUEST_TIMEOUT_MS + 5_000, null).finally(() => {
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
