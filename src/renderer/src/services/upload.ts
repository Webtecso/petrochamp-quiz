import { getBackendUrl } from './backendConfig'

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`${getBackendUrl()}/api/upload`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) {
    throw new Error('Falha ao enviar imagem')
  }
  const data = await res.json()
  return `${getBackendUrl()}${data.url}`
}
