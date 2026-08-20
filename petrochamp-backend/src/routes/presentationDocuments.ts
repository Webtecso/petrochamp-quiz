import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'

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

router.get('/', async (req, res) => {
  const { phaseId, duplaId, teamId } = req.query as { phaseId?: string; duplaId?: string; teamId?: string }
  const docs = await prisma.presentationDocument.findMany({
    where: {
      phaseId: phaseId ? Number(phaseId) : undefined,
      duplaId: duplaId ? Number(duplaId) : undefined,
      teamId: teamId || undefined
    },
    include: { slides: { orderBy: { order: 'asc' } } }
  })
  res.json(docs)
})

router.post('/', requireAdmin, upload.array('files'), async (req, res) => {
  try {
    const { duplaId, teamId } = req.body as { duplaId?: string; teamId?: string }
    const files = req.files as Express.Multer.File[] | undefined
    if (!duplaId || !teamId || !files || !files.length) {
      res.status(400).json({ error: 'duplaId, teamId e pelo menos uma imagem são obrigatórios' })
      return
    }

    const dupla = await prisma.presentationDupla.findUnique({ where: { id: Number(duplaId) } })
    if (!dupla || (dupla.teamAId !== teamId && dupla.teamBId !== teamId)) {
      res.status(400).json({ error: 'Esta equipa não pertence a esta dupla.' })
      return
    }

    const ordersRaw = req.body.orders as string | string[] | undefined
    let explicitOrders: number[] | null = null
    if (ordersRaw) {
      const arr = Array.isArray(ordersRaw) ? ordersRaw : [ordersRaw]
      if (arr.length === files.length) explicitOrders = arr.map(Number)
    }

    const indexed = files.map((file, i) => ({
      file,
      order: explicitOrders ? explicitOrders[i] : extractOrder(file.originalname, i)
    }))
    indexed.sort((a, b) => a.order - b.order)

    const folder = path.join(UPLOADS_ROOT, String(dupla.phaseId), teamId)
    await fs.mkdir(folder, { recursive: true })

    const existing = await prisma.presentationDocument.findUnique({
      where: { duplaId_teamId: { duplaId: Number(duplaId), teamId } },
      include: { slides: true }
    })
    if (existing) {
      for (const slide of existing.slides) {
        await fs.unlink(path.join(__dirname, '..', '..', slide.imageUrl)).catch(() => {})
      }
      await prisma.presentationSlide.deleteMany({ where: { documentId: existing.id } })
    }

    const doc = await prisma.presentationDocument.upsert({
      where: { duplaId_teamId: { duplaId: Number(duplaId), teamId } },
      update: {},
      create: { phaseId: dupla.phaseId, duplaId: Number(duplaId), teamId }
    })

    let order = 1
    for (const { file } of indexed) {
      const safeName = `${Date.now()}-${order}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      await fs.writeFile(path.join(folder, safeName), file.buffer)
      const imageUrl = `/uploads/presentations/${dupla.phaseId}/${teamId}/${safeName}`
      await prisma.presentationSlide.create({ data: { documentId: doc.id, order, imageUrl } })
      order += 1
    }

    const full = await prisma.presentationDocument.findUnique({
      where: { id: doc.id },
      include: { slides: { orderBy: { order: 'asc' } } }
    })
    res.status(201).json(full)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Falha ao enviar as imagens.' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const doc = await prisma.presentationDocument.findUnique({ where: { id }, include: { slides: true } })
    if (doc) {
      for (const slide of doc.slides) {
        await fs.unlink(path.join(__dirname, '..', '..', slide.imageUrl)).catch(() => {})
      }
    }
    await prisma.presentationDocument.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Documento não encontrado' })
  }
})

export default router
