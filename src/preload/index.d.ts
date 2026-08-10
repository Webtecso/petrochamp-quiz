import { ElectronAPI } from '@electron-toolkit/preload'

export interface CampeonatoApi {
  sendState: (state: unknown) => void
  onStateUpdate: (callback: (state: unknown) => void) => () => void
  requestState: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CampeonatoApi
  }
}
