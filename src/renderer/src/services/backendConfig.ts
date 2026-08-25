let overrideUrl: string | null = null

export function setBackendHost(hostAndPort: string): void {
  overrideUrl = hostAndPort.startsWith('http') ? hostAndPort : `http://${hostAndPort}`
}

export function getBackendUrl(): string {
  if (overrideUrl) return overrideUrl

  // NOVO — build dedicada do Admin Cloud (servida estaticamente fora do
  // Electron, ex: Hostinger). Definida em tempo de build via
  // VITE_CLOUD_API_URL (ver .env.admin-cloud). Nunca afeta a app Electron
  // normal, porque essa variável simplesmente não existe nesse build.
  const cloudApiUrl = import.meta.env.VITE_CLOUD_API_URL as string | undefined
  if (cloudApiUrl) return cloudApiUrl

  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const { hostname, port, origin } = window.location

    // Electron em dev: o Vite dev server serve a app em localhost:5173,
    // mas o backend está sempre em localhost:4000 — nunca é a mesma origem.
    if (port === '5173' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return 'http://localhost:4000'
    }

    // Servido pelo próprio backend (produção local, ou túnel Cloudflare
    // remoto) — aí sim a app e a API partilham a mesma origem.
    return origin
  }

  return 'http://localhost:4000'
}
