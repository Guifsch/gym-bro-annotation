import { apiClient } from '@/api/apiClient';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface SessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function registerRequest(params: { name: string; email: string; password: string }): Promise<void> {
  await apiClient.post('/api/auth/register-request', params);
}

export async function registerConfirm(params: { email: string; code: string }): Promise<SessionResponse> {
  const { data } = await apiClient.post<SessionResponse>('/api/auth/register', params);
  return data;
}

export async function login(params: { email: string; password: string }): Promise<SessionResponse> {
  const { data } = await apiClient.post<SessionResponse>('/api/auth/login', params);
  return data;
}

export async function refreshSession(refreshToken: string): Promise<{ user: AuthUser; accessToken: string }> {
  const { data } = await apiClient.post('/api/auth/refresh', { refreshToken });
  return data;
}

export async function forgotPassword(params: { email: string }): Promise<void> {
  await apiClient.post('/api/auth/forgot-password', params);
}

export async function resetPassword(params: { email: string; code: string; password: string }): Promise<void> {
  await apiClient.post('/api/auth/reset-password', params);
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/api/auth/logout', { refreshToken });
}

export async function updateProfile(params: { name?: string; email?: string }): Promise<AuthUser> {
  const { data } = await apiClient.patch<{ user: AuthUser }>('/api/auth/me', params);
  return data.user;
}

export async function changePassword(params: { currentPassword: string; newPassword: string }): Promise<void> {
  await apiClient.post('/api/auth/change-password', params);
}
