import { getBackendUrl } from './backendConfig'
import { adminToken } from './adminAuth'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (adminToken.value) {
    headers['Authorization'] = `Bearer ${adminToken.value}`
  }

  const res = await fetch(`${getBackendUrl()}/api${path}`, {
    headers,
    ...options
  })

  if (res.status === 401 && adminToken.value) {
    // Sessão de Admin expirou ou é inválida - limpa localmente
    adminToken.value = null
    localStorage.removeItem('petrochamp_admin_token')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error(`[API Error ${res.status}] em ${path}:`, body)
    throw new Error(body.error || `Erro ${res.status} em ${path}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
}
