import { apiRequest } from './client'
import type { AuthUser } from '../types/auth'

export function registerRequest(params: { name: string; email: string; password: string }) {
  return apiRequest<{ message: string }>('/api/auth/register-request', {
    method: 'POST',
    body: params,
    skipAuthRetry: true,
  })
}

export function registerConfirm(params: { email: string; code: string }) {
  return apiRequest<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: params,
    skipAuthRetry: true,
  })
}

export function login(params: { email: string; password: string }) {
  return apiRequest<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: params,
    skipAuthRetry: true,
  })
}

export function forgotPassword(params: { email: string }) {
  return apiRequest<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: params,
    skipAuthRetry: true,
  })
}

export function resetPassword(params: { email: string; code: string; password: string }) {
  return apiRequest<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: params,
    skipAuthRetry: true,
  })
}

export function me() {
  return apiRequest<{ user: AuthUser }>('/api/auth/me')
}

export function updateProfile(params: { name?: string; email?: string }) {
  return apiRequest<{ user: AuthUser }>('/api/auth/me', { method: 'PATCH', body: params })
}

export function changePassword(params: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ message: string }>('/api/auth/change-password', { method: 'POST', body: params })
}

export function logout() {
  return apiRequest<{ message: string }>('/api/auth/logout', { method: 'POST', skipAuthRetry: true })
}
