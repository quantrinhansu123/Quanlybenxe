import { Router, Request, Response } from 'express'
import {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  getLegacyRoutes,
} from '../controllers/route.controller.js'
import { authenticate } from '../middleware/auth.js'
import { getRouteSyncStatus, syncRoutesFromSheets } from '../services/route-sync.service.js'

const router = Router()

router.use(authenticate)

// Sync status and trigger endpoints
router.get('/sync/status', (_req: Request, res: Response) => {
  const status = getRouteSyncStatus()
  res.json(status)
})

router.post('/sync/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await syncRoutesFromSheets()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', getAllRoutes)
router.get('/legacy', getLegacyRoutes)
router.get('/:id', getRouteById)
router.post('/', createRoute)
router.put('/:id', updateRoute)
router.delete('/:id', deleteRoute)

export default router

