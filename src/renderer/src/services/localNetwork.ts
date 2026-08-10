interface ElectronApi {
  getLocalNetworkIp?: () => string | null
}

export function getLocalNetworkIp(): string {
  const api = (window as unknown as { api?: ElectronApi }).api
  return api?.getLocalNetworkIp?.() ?? 'localhost'
}
