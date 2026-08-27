import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'
import { emitConfigUpdated } from '../socket/configEvents'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 80 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
      cb(new Error('Só são aceites imagens PNG ou JPEG (exportadas do PowerPoint como imagens).'))
      return
    }
    cb(null, true)
  }
})

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'presentations')

function extractOrder(filename: string, fallbackIndex: number): number {
  const match = filename.match(/(\d+)(?=\.[^.]*$)/)
  if (match) return Number(match[1])
  return 100000 + fallbackIndex
}

// GET /api/presentation-documents
router.get('/', async (req, res) => {
  try {
    const { phaseId, duplaId, teamId } = req.query as {
      phaseId?: string
      duplaId?: string
      teamId?: string
    }

    const where: any = { deletedAt: null } // NOVO
    if (phaseId) where.phaseId = phaseId
    if (duplaId) where.duplaId = duplaId
    if (teamId) where.teamId = teamId

    const docs = await prisma.presentationDocument.findMany({
      where,
      include: {
        slides: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return res.json(docs)
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao carregar os documentos.' })
  }
})

// POST /api/presentation-documents
router.post('/', requireAdmin, upload.array('files'), async (req, res) => {
  try {
    const { duplaId, teamId } = req.body as { duplaId?: string; teamId?: string }
    const files = req.files as Express.Multer.File[] | undefined

    if (!duplaId || !teamId || !files || !files.length) {
      return res
        .status(400)
        .json({ error: 'duplaId, teamId e pelo menos uma imagem são obrigatórios.' })
    }

    const dupla = await prisma.presentationDupla.findUnique({ where: { id: duplaId } })
    if (!dupla || (dupla.teamAId !== teamId && dupla.teamBId !== teamId)) {
      return res.status(400).json({ error: 'Esta equipa não pertence a esta dupla.' })
    }

    const ordersRaw = req.body.orders as string | string[] | undefined
    let explicitOrders: number[] | null = null
    if (ordersRaw) {
      const arr = Array.isArray(ordersRaw) ? ordersRaw : [ordersRaw]
      if (arr.length === files.length) {
        explicitOrders = arr.map(Number)
      }
    }

    const indexed = files.map((file, i) => ({
      file,
      order: explicitOrders ? explicitOrders[i] : extractOrder(file.originalname, i)
    }))
    indexed.sort((a, b) => a.order - b.order)

    const folder = path.join(UPLOADS_ROOT, dupla.phaseId, teamId)
    await fs.mkdir(folder, { recursive: true })

    const existing = await prisma.presentationDocument.findUnique({
      where: { duplaId_teamId: { duplaId, teamId } },
      include: { slides: true }
    })

    if (existing) {
      // Ficheiros físicos: continuam a ser apagados do disco imediatamente
      // — isso é local a esta máquina, não precisa (nem faz sentido)
      // sincronizar entre admin local e admin cloud.
      for (const slide of existing.slides) {
        await fs.unlink(path.join(__dirname, '..', '..', slide.imageUrl)).catch(() => {})
      }
      await prisma.presentationSlide.deleteMany({ where: { documentId: existing.id } })
    }

    const doc = await prisma.presentationDocument.upsert({
      where: { duplaId_teamId: { duplaId, teamId } },
      update: { deletedAt: null },
      create: { phaseId: dupla.phaseId, duplaId, teamId }
    })

    let order = 1
    for (const { file } of indexed) {
      const safeName = `${Date.now()}-${order}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      await fs.writeFile(path.join(folder, safeName), file.buffer)
      const imageUrl = `/uploads/presentations/${dupla.phaseId}/${teamId}/${safeName}`

      await prisma.presentationSlide.create({
        data: { documentId: doc.id, order, imageUrl }
      })
      order += 1
    }

    const full = await prisma.presentationDocument.findUnique({
      where: { id: doc.id },
      include: { slides: { orderBy: { order: 'asc' } } }
    })

    emitConfigUpdated('presentation')
    return res.status(201).json(full)
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Falha ao enviar as imagens.' })
  }
})

// DELETE /api/presentation-documents/:id
// CORRIGIDO — soft delete no registo (ver nota em questions.ts); os
// ficheiros físicos das slides continuam a ser apagados do disco de
// imediato, já que isso é local e não passa pelo sync.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const doc = await prisma.presentationDocument.findUnique({
      where: { id },
      include: { slides: true }
    })

    if (!doc) {
      return res.status(404).json({ error: 'Documento não encontrado.' })
    }

    for (const slide of doc.slides) {
      await fs.unlink(path.join(__dirname, '..', '..', slide.imageUrl)).catch(() => {})
    }

    await prisma.presentationDocument.update({ where: { id }, data: { deletedAt: new Date() } })
    emitConfigUpdated('presentation')

    return res.status(204).send()
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao eliminar o documento.' })
  }
})

export default router
