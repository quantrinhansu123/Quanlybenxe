/**
 * Vehicle Repository - Drizzle ORM Version
 * Handles all PostgreSQL operations for vehicle records via Supabase
 */
import { vehicles, operators, vehicleTypes } from '../../../db/schema'
import { DrizzleRepository, eq, and, desc } from '../../../shared/database/drizzle-repository'
import { VehicleAPI, mapVehicle } from '../../../shared/mappers/entity-mappers'

// Infer types from schema
type Vehicle = typeof vehicles.$inferSelect
type NewVehicle = typeof vehicles.$inferInsert

/**
 * Vehicle Repository class - extends DrizzleRepository for common CRUD
 */
class DrizzleVehicleRepository extends DrizzleRepository<
  typeof vehicles,
  Vehicle,
  NewVehicle
> {
  protected table = vehicles
  protected idColumn = vehicles.id

  /**
   * Find all vehicles with related data (vehicleType, operator)
   */
  async findAllWithRelations(): Promise<VehicleAPI[]> {
    const database = this.getDb()

    const results = await database
      .select({
        // Vehicle fields
        id: vehicles.id,
        plateNumber: vehicles.plateNumber,
        operatorId: vehicles.operatorId,
        vehicleTypeId: vehicles.vehicleTypeId,
        seatCount: vehicles.seatCount,
        brand: vehicles.brand,
        model: vehicles.model,
        yearOfManufacture: vehicles.yearOfManufacture,
        color: vehicles.color,
        chassisNumber: vehicles.chassisNumber,
        engineNumber: vehicles.engineNumber,
        roadWorthinessExpiry: vehicles.roadWorthinessExpiry,
        insuranceExpiry: vehicles.insuranceExpiry,
        isActive: vehicles.isActive,
        operationalStatus: vehicles.operationalStatus,
        operatorName: vehicles.operatorName,
        operatorCode: vehicles.operatorCode,
        metadata: vehicles.metadata,
        createdAt: vehicles.createdAt,
        updatedAt: vehicles.updatedAt,
        // Operator fields
        operatorFullName: operators.name,
        operatorCodeRel: operators.code,
        // VehicleType fields
        vehicleTypeName: vehicleTypes.name,
      })
      .from(vehicles)
      .leftJoin(operators, eq(vehicles.operatorId, operators.id))
      .leftJoin(vehicleTypes, eq(vehicles.vehicleTypeId, vehicleTypes.id))
      .orderBy(desc(vehicles.createdAt))

    return results.map((row) => {
      const operator = row.operatorFullName
        ? {
            id: row.operatorId!,
            name: row.operatorFullName,
            code: row.operatorCodeRel || '',
          }
        : undefined

      const vehicleType = row.vehicleTypeName
        ? {
            id: row.vehicleTypeId!,
            name: row.vehicleTypeName,
          }
        : undefined

      return mapVehicle(
        {
          id: row.id,
          plate_number: row.plateNumber,
          operator_id: row.operatorId ?? undefined,
          vehicle_type_id: row.vehicleTypeId ?? undefined,
          seat_capacity: row.seatCount || 0,
          bed_capacity: 0,
          chassis_number: row.chassisNumber ?? undefined,
          engine_number: row.engineNumber ?? undefined,
          image_url: undefined,
          insurance_expiry_date: row.insuranceExpiry ?? undefined,
          inspection_expiry_date: row.roadWorthinessExpiry ?? undefined,
          cargo_length: undefined,
          cargo_width: undefined,
          cargo_height: undefined,
          gps_provider: undefined,
          gps_username: undefined,
          gps_password: undefined,
          province: undefined,
          is_active: row.isActive,
          notes: undefined,
          created_at: row.createdAt.toISOString(),
          updated_at: row.updatedAt.toISOString(),
        } as any,
        vehicleType
          ? {
              id: vehicleType.id,
              name: vehicleType.name,
            }
          : null,
        operator
          ? {
              id: operator.id,
              name: operator.name,
              code: operator.code,
              is_active: true,
            }
          : null
      )
    })
  }

  /**
   * Find vehicle by ID with relations
   */
  async findByIdWithRelations(id: string): Promise<VehicleAPI | null> {
    const database = this.getDb()

    const results = await database
      .select({
        // Vehicle fields
        id: vehicles.id,
        plateNumber: vehicles.plateNumber,
        operatorId: vehicles.operatorId,
        vehicleTypeId: vehicles.vehicleTypeId,
        seatCount: vehicles.seatCount,
        brand: vehicles.brand,
        model: vehicles.model,
        yearOfManufacture: vehicles.yearOfManufacture,
        color: vehicles.color,
        chassisNumber: vehicles.chassisNumber,
        engineNumber: vehicles.engineNumber,
        roadWorthinessExpiry: vehicles.roadWorthinessExpiry,
        insuranceExpiry: vehicles.insuranceExpiry,
        isActive: vehicles.isActive,
        operationalStatus: vehicles.operationalStatus,
        operatorName: vehicles.operatorName,
        operatorCode: vehicles.operatorCode,
        metadata: vehicles.metadata,
        createdAt: vehicles.createdAt,
        updatedAt: vehicles.updatedAt,
        // Operator fields
        operatorFullName: operators.name,
        operatorCodeRel: operators.code,
        // VehicleType fields
        vehicleTypeName: vehicleTypes.name,
      })
      .from(vehicles)
      .leftJoin(operators, eq(vehicles.operatorId, operators.id))
      .leftJoin(vehicleTypes, eq(vehicles.vehicleTypeId, vehicleTypes.id))
      .where(eq(vehicles.id, id))
      .limit(1)

    if (results.length === 0) return null

    const row = results[0]
    const operator = row.operatorFullName
      ? {
          id: row.operatorId!,
          name: row.operatorFullName,
          code: row.operatorCodeRel || '',
        }
      : undefined

    const vehicleType = row.vehicleTypeName
      ? {
          id: row.vehicleTypeId!,
          name: row.vehicleTypeName,
        }
      : undefined

    return mapVehicle(
      {
        id: row.id,
        plate_number: row.plateNumber,
        operator_id: row.operatorId ?? undefined,
        vehicle_type_id: row.vehicleTypeId ?? undefined,
        seat_capacity: row.seatCount || 0,
        bed_capacity: 0,
        chassis_number: row.chassisNumber ?? undefined,
        engine_number: row.engineNumber ?? undefined,
        image_url: undefined,
        insurance_expiry_date: row.insuranceExpiry ?? undefined,
        inspection_expiry_date: row.roadWorthinessExpiry ?? undefined,
        cargo_length: undefined,
        cargo_width: undefined,
        cargo_height: undefined,
        gps_provider: undefined,
        gps_username: undefined,
        gps_password: undefined,
        province: undefined,
        is_active: row.isActive,
        notes: undefined,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      } as any,
      vehicleType
        ? {
            id: vehicleType.id,
            name: vehicleType.name,
          }
        : null,
      operator
        ? {
            id: operator.id,
            name: operator.name,
            code: operator.code,
            is_active: true,
          }
        : null
    )
  }

  /**
   * Find vehicles by operator ID
   */
  async findByOperatorId(operatorId: string): Promise<VehicleAPI[]> {
    const all = await this.findAllWithRelations()
    return all.filter((v) => v.operatorId === operatorId)
  }

  /**
   * Find vehicles by active status
   */
  async findByActiveStatus(isActive: boolean): Promise<VehicleAPI[]> {
    const all = await this.findAllWithRelations()
    return all.filter((v) => v.isActive === isActive)
  }

  /**
   * Find vehicle by plate number
   */
  async findByPlateNumber(plateNumber: string): Promise<VehicleAPI | null> {
    const database = this.getDb()

    const [result] = await database
      .select()
      .from(vehicles)
      .where(eq(vehicles.plateNumber, plateNumber))
      .limit(1)

    if (!result) return null

    return this.findByIdWithRelations(result.id)
  }

  /**
   * Check if plate number exists
   */
  async plateNumberExists(plateNumber: string, excludeId?: string): Promise<boolean> {
    const database = this.getDb()

    const conditions = [eq(vehicles.plateNumber, plateNumber)]
    if (excludeId) {
      conditions.push(eq(vehicles.id, excludeId))
    }

    const [result] = await database
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(excludeId ? and(...conditions) : conditions[0])
      .limit(1)

    if (excludeId) {
      return result === undefined
    }

    return result !== undefined
  }

  /**
   * Create vehicle with API data format
   */
  async createFromAPI(data: {
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
  }): Promise<VehicleAPI> {
    const database = this.getDb()

    const [vehicle] = await database
      .insert(vehicles)
      .values({
        plateNumber: data.plateNumber,
        vehicleTypeId: data.vehicleTypeId || null,
        operatorId: data.operatorId || null,
        seatCount: data.seatCapacity,
        chassisNumber: data.chassisNumber || null,
        engineNumber: data.engineNumber || null,
        insuranceExpiry: data.insuranceExpiryDate || null,
        roadWorthinessExpiry: data.inspectionExpiryDate || null,
        isActive: data.isActive ?? true,
      })
      .returning()

    const result = await this.findByIdWithRelations(vehicle.id)
    if (!result) {
      throw new Error('Failed to fetch created vehicle')
    }

    return result
  }

  /**
   * Update vehicle by ID with API data format
   */
  async updateById(
    id: string,
    data: {
      plateNumber?: string
      vehicleTypeId?: string
      operatorId?: string
      seatCapacity?: number
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
  ): Promise<void> {
    const database = this.getDb()

    const updateData: Partial<NewVehicle> = {}

    if (data.plateNumber !== undefined) updateData.plateNumber = data.plateNumber
    if (data.vehicleTypeId !== undefined) updateData.vehicleTypeId = data.vehicleTypeId || null
    if (data.operatorId !== undefined) updateData.operatorId = data.operatorId || null
    if (data.seatCapacity !== undefined) updateData.seatCount = data.seatCapacity
    if (data.chassisNumber !== undefined) updateData.chassisNumber = data.chassisNumber || null
    if (data.engineNumber !== undefined) updateData.engineNumber = data.engineNumber || null
    if (data.insuranceExpiryDate !== undefined)
      updateData.insuranceExpiry = data.insuranceExpiryDate || null
    if (data.inspectionExpiryDate !== undefined)
      updateData.roadWorthinessExpiry = data.inspectionExpiryDate || null
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    await database
      .update(vehicles)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(vehicles.id, id))
  }

  /**
   * Delete vehicle by ID (soft delete - set isActive to false)
   */
  async deleteById(id: string): Promise<void> {
    const database = this.getDb()

    await database.update(vehicles).set({ isActive: false }).where(eq(vehicles.id, id))
  }
}

// Export singleton instance
export const vehicleRepository = new DrizzleVehicleRepository()

// Re-export types
export type { Vehicle, NewVehicle, VehicleAPI }
export { DrizzleVehicleRepository as VehicleRepository }
