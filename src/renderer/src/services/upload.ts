import { getBackendUrl } from './backendConfig'

// ATUALIZADO — data.url deixou de ser um caminho relativo (ex:
// "/uploads/xxx.png") desde que o upload.ts do backend passou a devolver
// a imagem como Data URL base64 completo e autossuficiente (ex:
// "data:image/png;base64,...."), para não depender de um sistema de
// ficheiros partilhado entre o backend local e o admin cloud (ver
// correção anterior do bug de imagens partidas após sync).
//
// Concatenar getBackendUrl() + data.url, como se fazia antes, gerava um
// URL inválido do tipo "http://localhost:4000data:image/png;base64,...",
// o que fazia a imagem aparecer partida logo na pré-visualização do
// formulário (Admin → Perguntas, Apresentação, etc.), e esse valor
// quebrado acabava por ser gravado como imageUrl da pergunta — propagando
// o problema até à tela do Moderador e da Projeção, onde a pergunta com
// imagem simplesmente não aparecia.
//
// Agora devolve data.url tal como veio do backend — já é um URL completo,
// pronto a usar diretamente num <img :src="...">, sem nenhum prefixo.
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
  return data.url
}
