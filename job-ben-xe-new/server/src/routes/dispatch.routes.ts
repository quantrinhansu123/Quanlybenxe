import { Router } from 'express'
import {
  getAllDispatchRecords,
  getDispatchRecordById,
  createDispatchRecord,
  recordPassengerDrop,
  issuePermit,
  processPayment,
  issueDepartureOrder,
  recordExit,
} from '../controllers/dispatch.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', getAllDispatchRecords)
router.get('/:id', getDispatchRecordById)
router.post('/', createDispatchRecord)
router.post('/:id/passenger-drop', recordPassengerDrop)
router.post('/:id/permit', issuePermit)
router.post('/:id/payment', processPayment)
router.post('/:id/departure-order', issueDepartureOrder)
router.post('/:id/exit', recordExit)

export default router
