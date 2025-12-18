/**
 * Driver Routes
 * API endpoints for driver operations
 */

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
} from './controllers/driver.controller.js'

const router = Router()

// Apply authentication to all routes
router.use(authenticate)

// Driver CRUD
router.get('/', getAllDrivers)
router.get('/:id', getDriverById)
router.post('/', createDriver)
router.put('/:id', updateDriver)
router.delete('/:id', deleteDriver)

export default router
