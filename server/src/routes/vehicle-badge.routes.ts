import { Router } from 'express'
import {
  getAllVehicleBadges,
  getVehicleBadgeById,
  getVehicleBadgeStats,
} from '../controllers/vehicle-badge.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/stats', getVehicleBadgeStats)
router.get('/', getAllVehicleBadges)
router.get('/:id', getVehicleBadgeById)

export default router
