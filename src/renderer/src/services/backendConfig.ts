let overrideUrl: string | null = null

export function setBackendHost(hostAndPort: string): void {
  overrideUrl = hostAndPort.startsWith('http') ? hostAndPort : `http://${hostAndPort}`
}

export function getBackendUrl(): string {
  return overrideUrl ?? 'http://localhost:4000'
}
