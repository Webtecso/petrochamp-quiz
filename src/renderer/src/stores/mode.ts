import { defineStore } from 'pinia'

export type DeviceMode = 'com-dispositivos' | 'sem-dispositivos'

export const useModeStore = defineStore('displayMode', {
  state: () => ({
    deviceMode: null as DeviceMode | null
  }),
  actions: {
    setDeviceMode(mode: DeviceMode) {
      this.deviceMode = mode
    }
  }
})
