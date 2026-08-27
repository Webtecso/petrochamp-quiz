import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

const CLOUD_API_URL = process.env.CLOUD_API_URL

const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const isSyncedName = file.originalname.includes('-') && file.originalname.length > 20
    const filename = isSyncedName ? file.originalname : `${randomUUID()}${ext}`
    cb(null, filename)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Apenas imagens são permitidas'))
  }
})

const router = Router()

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhuma imagem enviada' })
    return
  }

  const filename = req.file.filename
  const relativeUrl = `/uploads/${filename}`

  if (CLOUD_API_URL) {
    forwardImageToCloud(req.file.path, filename).catch((err) => {
      console.warn('[Upload] Retransmissão em tempo real falhou (sincronizará no ciclo de sync):', err.message)
    })
  }

  res.status(201).json({ url: relativeUrl })
})

router.post('/sync-file', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Ficheiro não recebido' })
    return
  }
  res.status(200).json({ success: true, filename: req.file.filename })
})

async function forwardImageToCloud(filePath: string, filename: string) {
  if (!fs.existsSync(filePath)) return
  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer])
  const formData = new FormData()
  formData.append('image', blob, filename)

  await fetch(`${CLOUD_API_URL}/api/upload/sync-file`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(10000)
  })
}

export default router
