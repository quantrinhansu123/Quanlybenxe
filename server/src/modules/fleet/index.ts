/**
 * Fleet Module
 * Public exports for Vehicle, Driver, VehicleType management
 */

// Repositories
export { vehicleRepository, VehicleRepository } from './repositories/vehicle.repository.js'
export { driverRepository, DriverRepository } from './repositories/driver.repository.js'
export { vehicleTypeRepository, VehicleTypeRepository } from './repositories/vehicle-type.repository.js'

// Services
export { vehicleService, VehicleService, CreateVehicleDTO, UpdateVehicleDTO, VehicleFilters } from './services/vehicle.service.js'
export { driverService, DriverService, CreateDriverDTO, UpdateDriverDTO, DriverFilters } from './services/driver.service.js'
