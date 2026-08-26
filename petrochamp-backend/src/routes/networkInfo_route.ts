import { Router } from 'express'
import { getNetworkInfo } from '../services/networkInfo'

const router = Router()

// GET /api/network-info
// Devolve o IP da máquina na rede local (Wi-Fi/Ethernet) e a URL
// completa do portal de jurados, prontos a mostrar/gerar QR code no
// frontend. Se não houver nenhuma rede local disponível (ex: máquina só
// com internet por dados móveis, sem Wi-Fi/Ethernet ativos), ip vem null
// e portalUrl também — o frontend deve tratar esse caso com uma
// mensagem, não assumir que a rota falhou.
router.get('/', (_req, res) => {
  const { ip, port } = getNetworkInfo()
  const portalUrl = ip ? `http://${ip}:${port}/portal/jurados.html` : null
  res.json({ ip, port, portalUrl })
})

export default router
