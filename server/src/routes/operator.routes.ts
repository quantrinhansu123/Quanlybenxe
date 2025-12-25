import { Router, Request, Response } from 'express'
import {
  getAllOperators,
  getLegacyOperators,
  getOperatorById,
  createOperator,
  updateOperator,
  deleteOperator,
  updateLegacyOperator,
  deleteLegacyOperator,
} from '../controllers/operator.controller.js'
import { authenticate } from '../middleware/auth.js'
import {
  syncOperatorsFromSheets,
  getOperatorSyncStatus,
} from '../services/operator-sync.service.js'

const router = Router()

router.use(authenticate)

// Sync status endpoint
router.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const status = getOperatorSyncStatus()
    res.json(status)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Manual sync trigger endpoint
router.post('/sync/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await syncOperatorsFromSheets()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/', getAllOperators)
router.get('/legacy', getLegacyOperators)
router.get('/:id', getOperatorById)
router.post('/', createOperator)
router.put('/:id', updateOperator)
router.delete('/:id', deleteOperator)

// Legacy (RTDB) operator routes
router.put('/legacy/:id', updateLegacyOperator)
router.delete('/legacy/:id', deleteLegacyOperator)

export default router

