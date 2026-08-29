import { Router } from 'express'
import multer from 'multer'

// ATUALIZADO - deixou de gravar em disco (multer.diskStorage). Cada
// servidor (backend local e admin cloud) tinha a sua própria pasta
// uploads/, completamente separada uma da outra. O /api/sync só
// sincroniza os REGISTOS da base de dados (ex: o campo logoUrl da Team
// como texto "/uploads/abc123.png"), nunca copia os ficheiros físicos
// entre servidores - por isso, ao sincronizar, o outro lado recebia um
// caminho que apontava para um ficheiro que só existia no disco de
// origem, resultando em imagem partida. No Render (admin cloud) isto
// ainda era pior, porque o disco é efémero e perde os ficheiros a cada
// redeploy, mesmo sem sync.
//
// A partir de agora a imagem é convertida para base64 e devolvida como
// Data URL (ex: "data:image/png;base64,...."), para ser guardada
// diretamente no campo logoUrl da Team. Como o valor passa a viver
// dentro do próprio registo, ele sincroniza automaticamente com o resto
// dos dados - sem precisar de nenhum mecanismo extra para copiar
// ficheiros entre servidores.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Apenas imagens são permitidas'))
  }
})

const router = Router()

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhuma imagem enviada' })
    return
  }
  const base64 = req.file.buffer.toString('base64')
  const dataUrl = `data:${req.file.mimetype};base64,${base64}`
  res.status(201).json({ url: dataUrl })
})

export default router
