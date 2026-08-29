import os from 'os'

// NOVO - deteta dinamicamente o IP da máquina na rede local (Wi-Fi ou
// Ethernet), para o portal dos jurados poder ser acedido por qualquer
// telemóvel/tablet ligado à mesma rede, sem depender de um IP fixo nem
// de internet (ao contrário do túnel Cloudflare, usado para o portal de
// votação pública). Funciona em qualquer PC sem configuração manual,
// porque lê os adaptadores de rede reais do sistema operativo em tempo
// real - muda automaticamente se a máquina mudar de rede.

const VIRTUAL_ADAPTER_PATTERN = /virtualbox|vmware|hyper-v|vethernet|loopback|docker|wsl/i
const PREFERRED_ADAPTER_PATTERN = /wi-?fi|wlan|ethernet|en0|eth0/i

export interface NetworkInfo {
  ip: string | null
  port: number
}

// Escolhe o "melhor" IPv4 não interno disponível: primeiro tenta um
// adaptador com nome reconhecível (Wi-Fi/Ethernet), evitando adaptadores
// virtuais conhecidos (VirtualBox, VMware, Hyper-V, WSL, etc. - comuns em
// PCs com essas ferramentas instaladas, e que geram IPs que não são
// alcançáveis por outros dispositivos da rede local). Se não encontrar
// nenhum com nome reconhecível, cai para o primeiro IPv4 não interno que
// encontrar, para nunca ficar sem sugestão nenhuma.
export function getLocalNetworkIp(): string | null {
  const interfaces = os.networkInterfaces()
  const candidates: { name: string; address: string }[] = []

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue
    if (VIRTUAL_ADAPTER_PATTERN.test(name)) continue
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        candidates.push({ name, address: addr.address })
      }
    }
  }

  if (candidates.length === 0) return null

  const preferred = candidates.find((c) => PREFERRED_ADAPTER_PATTERN.test(c.name))
  return (preferred ?? candidates[0]).address
}

export function getNetworkInfo(): NetworkInfo {
  const port = Number(process.env.PORT) || 4000
  return { ip: getLocalNetworkIp(), port }
}
