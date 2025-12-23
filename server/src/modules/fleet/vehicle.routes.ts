/**
 * Vehicle Routes
 * API endpoints for vehicle operations
 */

import { Router, Request, Response } from 'express'
import { authenticate } from '../../middleware/auth.js'
import {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleDocumentAuditLogs,
  getAllDocumentAuditLogs,
} from './controllers/vehicle.controller.js'
import { getVehicleSyncStatus, syncVehiclesFromSheets } from '../../services/vehicle-sync.service.js'

const router = Router()

// Apply authentication to all routes
router.use(authenticate)

// Sync status and trigger endpoints
router.get('/sync/status', (_req: Request, res: Response) => {
  const status = getVehicleSyncStatus()
  res.json(status)
})

router.post('/sync/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await syncVehiclesFromSheets()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Vehicle CRUD
router.get('/', getAllVehicles)
router.get('/document-audit-logs/all', getAllDocumentAuditLogs)
router.get('/:id/document-audit-logs', getVehicleDocumentAuditLogs)
router.get('/:id', getVehicleById)
router.post('/', createVehicle)
router.put('/:id', updateVehicle)
router.delete('/:id', deleteVehicle)

export default router
