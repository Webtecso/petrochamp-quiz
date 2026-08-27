import { Router } from 'express'
import { getNetworkInfo } from '../services/networkInfo'

const router = Router()

// GET /api/network-info
// Devolve o IP da máquina na rede local e a URL completa do portal de jurados
router.get('/', (_req, res) => {
  const { ip, port } = getNetworkInfo()
  const portalUrl = ip ? `http://${ip}:${port}/portal/jurados.html` : null
  res.json({ ip, port, portalUrl })
})

export default router
