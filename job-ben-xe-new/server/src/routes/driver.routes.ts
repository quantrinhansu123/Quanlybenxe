import { Router } from 'express'
import {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
} from '../controllers/driver.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', getAllDrivers)
router.get('/:id', getDriverById)
router.post('/', createDriver)
router.put('/:id', updateDriver)
router.delete('/:id', deleteDriver)

export default router

