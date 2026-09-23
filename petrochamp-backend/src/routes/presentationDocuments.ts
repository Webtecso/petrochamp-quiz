import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'
import { emitConfigUpdated } from '../socket/configEvents'

const router = Router()

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(UPLOADS_TMP, { recursive: true })
        .then(() => cb(null, UPLOADS_TMP))
        .catch((e) => cb(e as Error, UPLOADS_TMP))
    },
    filename: (_req, _file, cb) =>
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + '.tmp')
  }),
  limits: { fileSize: 250 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isPptx = file.mimetype === PPTX_MIME || file.originalname.toLowerCase().endsWith('.pptx')
    if (!isPptx) {
      cb(new Error('Só são aceites ficheiros .pptx.'))
      return
    }
    cb(null, true)
  }
})

const UPLOADS_BASE_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads')
const UPLOADS_ROOT = path.join(UPLOADS_BASE_DIR, 'presentations')
const UPLOADS_TMP = path.join(UPLOADS_ROOT, '_tmp')

// GET /api/presentation-documents
router.get('/', async (req, res) => {
  try {
    const { phaseId, duplaId, teamId } = req.query as {
      phaseId?: string
      duplaId?: string
      teamId?: string
    }

    const where: any = { deletedAt: null }
    if (phaseId) where.phaseId = phaseId
    if (duplaId) where.duplaId = duplaId
    if (teamId) where.teamId = teamId

    const docs = await prisma.presentationDocument.findMany({ where })

    return res.json(docs)
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao carregar os documentos.' })
  }
})

// POST /api/presentation-documents
router.post('/', requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Ficheiro demasiado grande (maximo 250 MB).' })
    }
    return res.status(400).json({ error: err.message || 'Falha ao receber o ficheiro.' })
  })
}, async (req, res) => {
  try {
    const { duplaId, teamId } = req.body as { duplaId?: string; teamId?: string }
    const file = req.file

    if (!duplaId || !teamId || !file) {
      if (file) await fs.unlink(file.path).catch(() => {})
      return res.status(400).json({ error: 'duplaId, teamId e um ficheiro .pptx são obrigatórios.' })
    }

    const dupla = await prisma.presentationDupla.findUnique({ where: { id: duplaId } })
    if (!dupla || (dupla.teamAId !== teamId && dupla.teamBId !== teamId)) {
      await fs.unlink(file.path).catch(() => {})
      return res.status(400).json({ error: 'Esta equipa não pertence a esta dupla.' })
    }

    const folder = path.join(UPLOADS_ROOT, dupla.phaseId, teamId)
    await fs.mkdir(folder, { recursive: true })

    const existing = await prisma.presentationDocument.findUnique({
      where: { duplaId_teamId: { duplaId, teamId } }
    })

    if (existing?.fileUrl) {
      // Ficheiro físico anterior: continua a ser apagado do disco imediatamente
      // - isso é local a esta máquina, não precisa (nem faz sentido)
      // sincronizar entre admin local e admin cloud.
      await fs.unlink(path.join(UPLOADS_BASE_DIR, existing.fileUrl.replace(/^\/uploads\//, ''))).catch(() => {})
    }

    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await fs.rename(file.path, path.join(folder, safeName)).catch(async () => {
      await fs.copyFile(file.path, path.join(folder, safeName))
      await fs.unlink(file.path).catch(() => {})
    })
    const fileUrl = `/uploads/presentations/${dupla.phaseId}/${teamId}/${safeName}`

    const doc = await prisma.presentationDocument.upsert({
      where: { duplaId_teamId: { duplaId, teamId } },
      update: { deletedAt: null, fileUrl, fileName: file.originalname },
      create: { phaseId: dupla.phaseId, duplaId, teamId, fileUrl, fileName: file.originalname }
    })

    emitConfigUpdated('presentation')
    return res.status(201).json(doc)
  } catch (error: any) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {})
    return res.status(400).json({ error: error?.message || 'Falha ao enviar o ficheiro.' })
  }
})

// DELETE /api/presentation-documents/:id
// Soft delete no registo (ver nota em questions.ts); o ficheiro físico
// continua a ser apagado do disco de imediato, já que isso é local e
// não passa pelo sync.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const doc = await prisma.presentationDocument.findUnique({ where: { id } })

    if (!doc) {
      return res.status(404).json({ error: 'Documento não encontrado.' })
    }

    if (doc.fileUrl) {
      await fs.unlink(path.join(UPLOADS_BASE_DIR, doc.fileUrl.replace(/^\/uploads\//, ''))).catch(() => {})
    }

    await prisma.presentationDocument.update({ where: { id }, data: { deletedAt: new Date() } })
    emitConfigUpdated('presentation')

    return res.status(204).send()
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao eliminar o documento.' })
  }
})

export default router