/**
 * Vehicle Service
 * Business logic layer for Vehicle entity
 */

import { VehicleAPI } from '../../../shared/mappers/entity-mappers.js'
import { AlreadyExistsError, ValidationError } from '../../../shared/errors/app-error.js'
import { vehicleRepository, VehicleRepository } from '../repositories/vehicle.repository.js'

export interface CreateVehicleDTO {
  plateNumber: string
  vehicleTypeId?: string
  operatorId?: string
  seatCapacity: number
  bedCapacity?: number
  chassisNumber?: string
  engineNumber?: string
  imageUrl?: string
  insuranceExpiryDate?: string
  inspectionExpiryDate?: string
  cargoLength?: number
  cargoWidth?: number
  cargoHeight?: number
  gpsProvider?: string
  gpsUsername?: string
  gpsPassword?: string
  province?: string
  notes?: string
  isActive?: boolean
}

export interface UpdateVehicleDTO extends Partial<CreateVehicleDTO> {}

export interface VehicleFilters {
  operatorId?: string
  isActive?: boolean
}

export class VehicleService {
  constructor(private repository: VehicleRepository) {}

  /**
   * Get all vehicles with optional filters
   */
  async getAll(filters?: VehicleFilters): Promise<VehicleAPI[]> {
    let vehicles = await this.repository.findAllWithRelations()

    if (filters?.operatorId) {
      vehicles = vehicles.filter((v) => v.operatorId === filters.operatorId)
    }
    if (filters?.isActive !== undefined) {
      vehicles = vehicles.filter((v) => v.isActive === filters.isActive)
    }

    return vehicles
  }

  /**
   * Get vehicle by ID with relations
   */
  async getById(id: string): Promise<VehicleAPI> {
    const vehicle = await this.repository.findByIdWithRelations(id)
    if (!vehicle) {
      throw new ValidationError(`Vehicle with ID '${id}' not found`)
    }
    return vehicle
  }

  /**
   * Create a new vehicle
   */
  async create(data: CreateVehicleDTO): Promise<VehicleAPI> {
    // Validate required fields
    if (!data.plateNumber?.trim()) {
      throw new ValidationError('Plate number is required')
    }
    if (data.seatCapacity === undefined || data.seatCapacity < 0) {
      throw new ValidationError('Valid seat capacity is required')
    }

    // Check for duplicate plate number
    const plateExists = await this.repository.plateNumberExists(data.plateNumber)
    if (plateExists) {
      throw new AlreadyExistsError('Vehicle', 'plateNumber', data.plateNumber)
    }

    return this.repository.create({
      ...data,
      isActive: data.isActive ?? true,
    })
  }

  /**
   * Update a vehicle
   */
  async update(id: string, data: UpdateVehicleDTO): Promise<VehicleAPI> {
    // Ensure vehicle exists
    await this.getById(id)

    // Check for duplicate plate number if updating
    if (data.plateNumber) {
      const plateExists = await this.repository.plateNumberExists(data.plateNumber, id)
      if (plateExists) {
        throw new AlreadyExistsError('Vehicle', 'plateNumber', data.plateNumber)
      }
    }

    await this.repository.updateById(id, data)
    return this.getById(id)
  }

  /**
   * Delete a vehicle
   */
  async delete(id: string): Promise<void> {
    await this.repository.deleteById(id)
  }

  /**
   * Toggle vehicle active status
   */
  async toggleActive(id: string): Promise<VehicleAPI> {
    const vehicle = await this.getById(id)
    await this.repository.updateById(id, { isActive: !vehicle.isActive })
    return this.getById(id)
  }

  /**
   * Get vehicles by operator
   */
  async getByOperator(operatorId: string): Promise<VehicleAPI[]> {
    return this.repository.findByOperatorId(operatorId)
  }
}

// Export singleton instance
export const vehicleService = new VehicleService(vehicleRepository)
