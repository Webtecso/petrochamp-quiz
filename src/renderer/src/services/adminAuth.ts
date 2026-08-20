import { ref } from 'vue'
import { getBackendUrl } from './backendConfig'

const STORAGE_KEY = 'petrochamp_admin_token'

export const adminToken = ref<string | null>(localStorage.getItem(STORAGE_KEY))

export function setAdminToken(token: string | null): void {
  adminToken.value = token
  if (token) {
    localStorage.setItem(STORAGE_KEY, token)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function isAdminLoggedIn(): boolean {
  return !!adminToken.value
}

// Wrapper para todas as chamadas fetch que precisam de sessão de Admin.
// Anexa o Bearer token automaticamente e trata 401 fazendo logout local.
export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers ?? {})
  if (adminToken.value) {
    headers.set('Authorization', `Bearer ${adminToken.value}`)
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${getBackendUrl()}${path}`, { ...options, headers })

  if (res.status === 401) {
    setAdminToken(null)
  }

  return res
}

export async function checkAdminConfigured(): Promise<boolean> {
  const res = await fetch(`${getBackendUrl()}/api/admin-auth/status`)
  const data = await res.json()
  return !!data.configured
}

export async function adminLogout(): Promise<void> {
  if (adminToken.value) {
    await adminFetch('/api/admin-auth/logout', {
      method: 'POST',
      body: JSON.stringify({ token: adminToken.value })
    }).catch(() => {})
  }
  setAdminToken(null)
}
