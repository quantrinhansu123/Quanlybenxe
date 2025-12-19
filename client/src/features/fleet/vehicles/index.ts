// Vehicles Domain Public API

// API Services
export { vehicleApi, vehicleService } from './api'
export { vehicleTypeApi, vehicleTypeService } from './api'

// Components (re-exported from original location)
export { VehicleForm } from '@/components/vehicle/VehicleForm'
export { VehicleView } from '@/components/vehicle/VehicleView'

// Types
export type {
  Vehicle,
  VehicleInput,
  VehicleDocuments,
  DocumentInfo,
  VehicleType,
  VehicleTypeInput,
  VehicleFilters,
  VehicleFormMode,
} from './types'
