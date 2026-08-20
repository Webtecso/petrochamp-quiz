import { Preferences } from '@capacitor/preferences'
import { setBackendHost } from './backendConfig'

const STORAGE_KEY = 'petrochamp_backend_host'

export async function loadSavedBackendHost(): Promise<string | null> {
  const { value } = await Preferences.get({ key: STORAGE_KEY })
  if (value) {
    setBackendHost(value)
  }
  return value
}

export async function saveBackendHost(hostAndPort: string): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: hostAndPort })
  setBackendHost(hostAndPort)
}

export async function clearBackendHost(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEY })
}
