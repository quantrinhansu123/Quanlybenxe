import { Router, Request, Response } from 'express'
import {
  getAllVehicleBadges,
  getVehicleBadgeById,
  getVehicleBadgeByPlateNumber,
  getVehicleBadgeStats,
  createVehicleBadge,
  updateVehicleBadge,
  deleteVehicleBadge,
} from '../controllers/vehicle-badge.controller.js'
import { authenticate } from '../middleware/auth.js'
import { getBadgeSyncStatus, syncBadgesFromSheets } from '../services/badge-sync.service.js'

const router = Router()

router.use(authenticate)

// Sync status and trigger endpoints
router.get('/sync/status', (_req: Request, res: Response) => {
  const status = getBadgeSyncStatus()
  res.json(status)
})

router.post('/sync/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await syncBadgesFromSheets()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/stats', getVehicleBadgeStats)
router.get('/by-plate/:plateNumber', getVehicleBadgeByPlateNumber)
router.get('/', getAllVehicleBadges)
router.get('/:id', getVehicleBadgeById)
router.post('/', createVehicleBadge)
router.put('/:id', updateVehicleBadge)
router.delete('/:id', deleteVehicleBadge)

export default router
