import { Router } from 'express'
import {
  getAllOperators,
  getOperatorById,
  createOperator,
  updateOperator,
  deleteOperator,
} from '../controllers/operator.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', getAllOperators)
router.get('/:id', getOperatorById)
router.post('/', createOperator)
router.put('/:id', updateOperator)
router.delete('/:id', deleteOperator)

export default router

