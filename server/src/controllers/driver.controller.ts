import { Request, Response } from 'express'
import { db } from '../db/drizzle.js'
import { drivers, operators, driverOperators } from '../db/schema/index.js'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { syncDriverChanges } from '../utils/denormalization-sync.js'
import { cachedData } from '../services/cached-data.service.js'

const driverSchema = z.object({
  operatorIds: z.array(z.string().min(1, 'Invalid operator ID')).min(1, 'At least one operator is required'),
  fullName: z.string().min(1, 'Full name is required'),
  idNumber: z.string().min(1, 'ID number is required'),
  phone: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseClass: z.string().min(1, 'License class is required'),
  licenseExpiryDate: z.string().min(1, 'License expiry date is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
})

export const getAllDrivers = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { operatorId, isActive } = req.query

    // Use cached drivers and operators (parallel fetch)
    let [driversData, operatorsMap] = await Promise.all([
      cachedData.getAllDrivers(),
      cachedData.getOperatorsMap(),
    ])

    // Filter by isActive if specified
    if (isActive !== undefined) {
      const active = isActive === 'true'
      driversData = driversData.filter((d: any) => d.is_active === active)
    }

    // Load junction table for multi-operator relationships
    const junctionData = await db.select().from(driverOperators)

    // DEBUG LOG - remove after fixing
    console.log('[getAllDrivers] Junction data count:', junctionData?.length || 0)
    console.log('[getAllDrivers] Junction data sample:', junctionData?.slice(0, 2))

    // Create a map of driver_id -> operator relationships
    const driverOperatorsMap = new Map<string, any[]>()
    ;(junctionData || []).forEach((junction: any) => {
      const list = driverOperatorsMap.get(junction.driverId) || []
      list.push(junction)
      driverOperatorsMap.set(junction.driverId, list)
    })

    // DEBUG LOG
    console.log('[getAllDrivers] driverOperatorsMap keys:', Array.from(driverOperatorsMap.keys()))

    // Map drivers with operator info
    let drivers = (driversData || []).map((driver: any) => {
      // Get primary operator from operator_id
      const primaryOperatorData = driver.operator_id ? operatorsMap.get(driver.operator_id) as any : null
      const primaryOperator = primaryOperatorData ? {
        id: primaryOperatorData.id,
        name: primaryOperatorData.name,
        code: primaryOperatorData.code,
      } : undefined

      // Get all operators from junction table
      const junctionRecords = driverOperatorsMap.get(driver.id) || []
      const allOperators = junctionRecords.map((junction: any) => {
        const opData = operatorsMap.get(junction.operatorId) as any
        return opData ? {
          id: opData.id,
          name: opData.name,
          code: opData.code,
          isPrimary: junction.isPrimary,
        } : null
      }).filter((op): op is { id: string; name: string; code: string; isPrimary: boolean } => op !== null)

      // Merge operators: use junction table if available, otherwise use primary
      const operators = allOperators.length > 0 ? allOperators : (primaryOperator ? [{ ...primaryOperator, isPrimary: true }] : [])

      return {
        id: driver.id,
        operatorId: driver.operator_id,
        operator: primaryOperator,
        operatorIds: operators.map((op: any) => op.id),
        operators: operators,
        fullName: driver.full_name,
        idNumber: driver.id_number,
        phone: driver.phone,
        province: driver.province,
        district: driver.district,
        address: driver.address,
        licenseNumber: driver.license_number,
        licenseClass: driver.license_class,
        licenseExpiryDate: driver.license_expiry_date,
        imageUrl: driver.image_url,
        isActive: driver.is_active,
        createdAt: driver.created_at,
        updatedAt: driver.updated_at,
      }
    })

    // Filter by operatorId if provided
    if (operatorId) {
      const opId = operatorId as string
      drivers = drivers.filter((driver: any) => {
        // Check direct operator_id
        if (driver.operatorId === opId) return true
        // Check junction table operators
        if (driver.operatorIds.includes(opId)) return true
        return false
      })
    }

    return res.json(drivers)
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return res.status(500).json({ error: 'Failed to fetch drivers' })
  }
}

export const getDriverById = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    // Get driver
    const driverData = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1)

    if (!driverData || driverData.length === 0) {
      return res.status(404).json({ error: 'Driver not found' })
    }

    const driver = driverData[0]

    // Manual join: Fetch primary operator
    let primaryOperator: { id: string; name: string; code: string } | undefined
    if (driver.operatorId) {
      const operatorData = await db
        .select({ id: operators.id, name: operators.name, code: operators.code })
        .from(operators)
        .where(eq(operators.id, driver.operatorId))
        .limit(1)

      if (operatorData && operatorData.length > 0) {
        primaryOperator = {
          id: operatorData[0].id,
          name: operatorData[0].name,
          code: operatorData[0].code,
        }
      }
    }

    // Manual join: Get all operators from junction table
    const junctionData = await db
      .select()
      .from(driverOperators)
      .where(eq(driverOperators.driverId, id))

    // Fetch all operators for junction records
    let allOperators: Array<{ id: string; name: string; code: string; isPrimary: boolean }> = []
    if (junctionData && junctionData.length > 0) {
      const operatorsData = await db
        .select({ id: operators.id, name: operators.name, code: operators.code })
        .from(operators)

      if (operatorsData) {
        const operatorsMap = new Map(operatorsData.map((op: any) => [op.id, op]))
        allOperators = junctionData
          .map((j: any) => {
            const op = operatorsMap.get(j.operatorId) as any
            return op ? {
              id: op.id,
              name: op.name,
              code: op.code,
              isPrimary: j.isPrimary,
            } : null
          })
          .filter((op): op is { id: string; name: string; code: string; isPrimary: boolean } => op !== null)
      }
    }

    const operatorsList = allOperators.length > 0 ? allOperators : (primaryOperator ? [{ ...primaryOperator, isPrimary: true }] : [])

    return res.json({
      id: driver.id,
      operatorId: driver.operatorId, // Keep for backward compatibility
      operator: primaryOperator, // Keep for backward compatibility
      operatorIds: operatorsList.map((op: any) => op.id),
      operators: operatorsList,
      fullName: driver.fullName,
      idNumber: driver.idNumber,
      phone: driver.phone,
      province: driver.province,
      district: driver.district,
      address: driver.address,
      licenseNumber: driver.licenseNumber,
      licenseClass: driver.licenseClass,
      licenseExpiryDate: driver.licenseExpiryDate,
      imageUrl: driver.imageUrl,
      isActive: driver.isActive,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching driver:', error)
    return res.status(500).json({ error: 'Failed to fetch driver' })
  }
}

export const createDriver = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const validated = driverSchema.parse(req.body)
    const {
      operatorIds,
      fullName,
      idNumber,
      phone,
      province,
      district,
      address,
      licenseNumber,
      licenseClass,
      licenseExpiryDate,
      imageUrl,
    } = validated

    // Use first operator as primary (for backward compatibility)
    const primaryOperatorId = operatorIds[0]

    // Create driver with primary operator
    const driverData = await db
      .insert(drivers)
      .values({
        operatorId: primaryOperatorId,
        fullName,
        idNumber,
        phone: phone || null,
        province: province || null,
        district: district || null,
        address: address || null,
        licenseNumber,
        licenseClass,
        licenseExpiryDate,
        imageUrl: imageUrl || null,
        isActive: true,
      })
      .returning()

    if (!driverData || driverData.length === 0) {
      throw new Error('Failed to create driver')
    }

    const newDriver = driverData[0]

    // Create junction records for all operators
    const junctionRecords = operatorIds.map((opId, index) => ({
      driverId: newDriver.id,
      operatorId: opId,
      isPrimary: index === 0, // First one is primary
    }))

    await db.insert(driverOperators).values(junctionRecords)

    // Manual join: Fetch primary operator
    let primaryOperator: { id: string; name: string; code: string } | undefined
    if (newDriver.operatorId) {
      const operatorData = await db
        .select({ id: operators.id, name: operators.name, code: operators.code })
        .from(operators)
        .where(eq(operators.id, newDriver.operatorId))
        .limit(1)

      if (operatorData && operatorData.length > 0) {
        primaryOperator = {
          id: operatorData[0].id,
          name: operatorData[0].name,
          code: operatorData[0].code,
        }
      }
    }

    // Manual join: Get all operators from junction table
    const junctionData = await db
      .select()
      .from(driverOperators)
      .where(eq(driverOperators.driverId, newDriver.id))

    // Fetch all operators for junction records
    let allOperators: Array<{ id: string; name: string; code: string; isPrimary: boolean }> = []
    if (junctionData && junctionData.length > 0) {
      const operatorsData = await db
        .select({ id: operators.id, name: operators.name, code: operators.code })
        .from(operators)

      if (operatorsData) {
        const operatorsMap = new Map(operatorsData.map((op: any) => [op.id, op]))
        allOperators = junctionData
          .map((j: any) => {
            const op = operatorsMap.get(j.operatorId) as any
            return op ? {
              id: op.id,
              name: op.name,
              code: op.code,
              isPrimary: j.isPrimary,
            } : null
          })
          .filter((op): op is { id: string; name: string; code: string; isPrimary: boolean } => op !== null)
      }
    }

    // Invalidate driver cache after create
    cachedData.invalidateDrivers()

    return res.status(201).json({
      id: newDriver.id,
      operatorId: newDriver.operatorId, // Keep for backward compatibility
      operator: primaryOperator, // Keep for backward compatibility
      operatorIds: allOperators.map((op: any) => op.id),
      operators: allOperators,
      fullName: newDriver.fullName,
      idNumber: newDriver.idNumber,
      phone: newDriver.phone,
      province: newDriver.province,
      district: newDriver.district,
      address: newDriver.address,
      licenseNumber: newDriver.licenseNumber,
      licenseClass: newDriver.licenseClass,
      licenseExpiryDate: newDriver.licenseExpiryDate,
      imageUrl: newDriver.imageUrl,
      isActive: newDriver.isActive,
      createdAt: newDriver.createdAt,
      updatedAt: newDriver.updatedAt,
    })
  } catch (error: any) {
    console.error('Error creating driver:', error)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Driver with this ID number or license already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create driver' })
  }
}

export const updateDriver = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const validated = driverSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.fullName) updateData.fullName = validated.fullName
    if (validated.idNumber) updateData.idNumber = validated.idNumber
    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.province !== undefined) updateData.province = validated.province || null
    if (validated.district !== undefined) updateData.district = validated.district || null
    if (validated.address !== undefined) updateData.address = validated.address || null
    if (validated.licenseNumber) updateData.licenseNumber = validated.licenseNumber
    if (validated.licenseClass) updateData.licenseClass = validated.licenseClass
    if (validated.licenseExpiryDate) updateData.licenseExpiryDate = validated.licenseExpiryDate
    if (validated.imageUrl !== undefined) updateData.imageUrl = validated.imageUrl || null

    // Update operators if provided
    if (validated.operatorIds && validated.operatorIds.length > 0) {
      const primaryOperatorId = validated.operatorIds[0]
      updateData.operatorId = primaryOperatorId

      // Delete existing junction records
      await db
        .delete(driverOperators)
        .where(eq(driverOperators.driverId, id))

      // Create new junction records
      const junctionRecords = validated.operatorIds.map((opId, index) => ({
        driverId: id,
        operatorId: opId,
        isPrimary: index === 0,
      }))

      await db.insert(driverOperators).values(junctionRecords)
    }

    // Update driver data
    const data = await db
      .update(drivers)
      .set(updateData)
      .where(eq(drivers.id, id))
      .returning()

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Driver not found' })
    }

    const updatedDriver = data[0]

    // Sync denormalized data to dispatch_records if full_name changed
    if (updateData.fullName) {
      // Run sync in background (non-blocking)
      syncDriverChanges(id, updatedDriver.fullName).catch((err) => {
        console.error('[Driver Update] Failed to sync denormalized data:', err)
      })
    }

    // Manual join: Fetch primary operator
    let primaryOperator: { id: string; name: string; code: string } | undefined
    if (updatedDriver.operatorId) {
      const operatorData = await db
        .select({ id: operators.id, name: operators.name, code: operators.code })
        .from(operators)
        .where(eq(operators.id, updatedDriver.operatorId))
        .limit(1)

      if (operatorData && operatorData.length > 0) {
        primaryOperator = {
          id: operatorData[0].id,
          name: operatorData[0].name,
          code: operatorData[0].code,
        }
      }
    }

    // Manual join: Get all operators from junction table
    const junctionData = await db
      .select()
      .from(driverOperators)
      .where(eq(driverOperators.driverId, id))

    // Fetch all operators for junction records
    let allOperators: Array<{ id: string; name: string; code: string; isPrimary: boolean }> = []
    if (junctionData && junctionData.length > 0) {
      const operatorsData = await db
        .select({ id: operators.id, name: operators.name, code: operators.code })
        .from(operators)

      if (operatorsData) {
        const operatorsMap = new Map(operatorsData.map((op: any) => [op.id, op]))
        allOperators = junctionData
          .map((j: any) => {
            const op = operatorsMap.get(j.operatorId) as any
            return op ? {
              id: op.id,
              name: op.name,
              code: op.code,
              isPrimary: j.isPrimary,
            } : null
          })
          .filter((op): op is { id: string; name: string; code: string; isPrimary: boolean } => op !== null)
      }
    }

    // Invalidate driver cache after update
    cachedData.invalidateDrivers()

    return res.json({
      id: updatedDriver.id,
      operatorId: updatedDriver.operatorId, // Keep for backward compatibility
      operator: primaryOperator, // Keep for backward compatibility
      operatorIds: allOperators.map((op: any) => op.id),
      operators: allOperators,
      fullName: updatedDriver.fullName,
      idNumber: updatedDriver.idNumber,
      phone: updatedDriver.phone,
      province: updatedDriver.province,
      district: updatedDriver.district,
      address: updatedDriver.address,
      licenseNumber: updatedDriver.licenseNumber,
      licenseClass: updatedDriver.licenseClass,
      licenseExpiryDate: updatedDriver.licenseExpiryDate,
      imageUrl: updatedDriver.imageUrl,
      isActive: updatedDriver.isActive,
      createdAt: updatedDriver.createdAt,
      updatedAt: updatedDriver.updatedAt,
    })
  } catch (error: any) {
    console.error('Error updating driver:', error)
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update driver' })
  }
}

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    await db.delete(drivers).where(eq(drivers.id, id))

    // Invalidate driver cache after delete
    cachedData.invalidateDrivers()

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting driver:', error)
    return res.status(500).json({ error: 'Failed to delete driver' })
  }
}
