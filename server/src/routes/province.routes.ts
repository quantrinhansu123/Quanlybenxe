import { Router } from 'express'
import {
  getProvincesV1,
  getProvincesV2,
  getDistrictsByProvinceV1,
  getWardsByProvinceV2,
} from '../controllers/province.controller.js'

const router = Router()

// Public routes (no authentication required for provinces API)
router.get('/v1', getProvincesV1)
router.get('/v2', getProvincesV2)
router.get('/v1/:code/districts', getDistrictsByProvinceV1)
router.get('/v2/:code/wards', getWardsByProvinceV2)

export default router

