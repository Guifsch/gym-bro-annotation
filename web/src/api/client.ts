const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  issues?: unknown

  constructor(message: string, status: number, issues?: unknown) {
    super(message)
    this.status = status
    this.issues = issues
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  raw?: { data: Blob | File; contentType: string }
  /** Skip the silent-refresh-and-retry dance — used by auth mutations (login/register/etc). */
  skipAuthRetry?: boolean
}

let unauthorizedHandler: (() => void) | null = null

/** Called once during app bootstrap so the API client can clear the session on a hard 401. */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

let refreshPromise: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function buildInit(options: RequestOptions): RequestInit {
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'include' }

  if (options.raw) {
    init.headers = { 'Content-Type': options.raw.contentType }
    init.body = options.raw.data
  } else if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }

  return init
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = 'Erro inesperado. Tente novamente.'
  let issues: unknown
  try {
    const data = await response.json()
    if (typeof data?.error === 'string') message = data.error
    issues = data?.issues
  } catch {
    // response had no JSON body
  }
  return new ApiError(message, response.status, issues)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init = buildInit(options)
  let response = await fetch(`${API_URL}${path}`, init)

  if (response.status === 401 && !options.skipAuthRetry && path !== '/api/auth/refresh') {
    const refreshed = await refreshSession()
    if (refreshed) {
      response = await fetch(`${API_URL}${path}`, init)
    } else {
      unauthorizedHandler?.()
    }
  }

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.()
    throw await toApiError(response)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Like {@link apiRequest}, but for endpoints that return a binary body (e.g. an image) instead of JSON. */
export async function apiRequestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const init = buildInit(options)
  let response = await fetch(`${API_URL}${path}`, init)

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshSession()
    if (refreshed) {
      response = await fetch(`${API_URL}${path}`, init)
    } else {
      unauthorizedHandler?.()
    }
  }

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.()
    throw await toApiError(response)
  }

  return response.blob()
}
