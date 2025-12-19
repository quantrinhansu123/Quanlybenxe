import { Router } from 'express'
import {
  getAllVehicleBadges,
  getVehicleBadgeById,
  getVehicleBadgeByPlateNumber,
  getVehicleBadgeStats,
} from '../controllers/vehicle-badge.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/stats', getVehicleBadgeStats)
router.get('/by-plate/:plateNumber', getVehicleBadgeByPlateNumber)
router.get('/', getAllVehicleBadges)
router.get('/:id', getVehicleBadgeById)

export default router
