/**
 * Driver Controller
 * Handles HTTP requests for driver operations
 */

import { Request, Response } from 'express'
import { firebase } from '../../../config/database.js'
import { syncDriverChanges } from '../../../utils/denormalization-sync.js'
import { validateCreateDriver, validateUpdateDriver } from '../fleet-validation.js'

interface OperatorInfo {
  id: string
  name: string
  code: string
}

/**
 * Fetch junction table data for operators (manual join for Firebase RTDB)
 */
async function fetchDriverOperators(driverId: string) {
  // Get junction records
  const { data: junctionData, error } = await firebase
    .from('driver_operators')
    .select('*')
    .eq('driver_id', driverId)

  if (error) throw error
  if (!junctionData || junctionData.length === 0) return []

  // Get all operators for manual join
  const { data: operatorsData } = await firebase
    .from('operators')
    .select('id, name, code')

  const operatorsMap = new Map<string, OperatorInfo>((operatorsData || []).map((op: any) => [op.id, op]))

  // Manual join
  return junctionData.map((junction: any) => {
    const op = operatorsMap.get(junction.operator_id)
    return {
      operator_id: junction.operator_id,
      is_primary: junction.is_primary,
      operators: op ? { id: op.id, name: op.name, code: op.code } : null,
    }
  }).filter((j: any) => j.operators !== null)
}

/**
 * Update driver-operator junction records
 */
async function updateDriverOperators(driverId: string, operatorIds: string[]): Promise<void> {
  // Delete existing junction records
  await firebase.from('driver_operators').delete().eq('driver_id', driverId)

  // Create new junction records
  const junctionRecords = operatorIds.map((opId, index) => ({
    driver_id: driverId,
    operator_id: opId,
    is_primary: index === 0,
  }))

  const { error } = await firebase.from('driver_operators').insert(junctionRecords)
  if (error) throw error
}

// ========== Controller Handlers ==========

export const getAllDrivers = async (req: Request, res: Response) => {
  try {
    const { operatorId, isActive } = req.query

    // Load all drivers (without join - Firebase RTDB doesn't support joins)
    let driversQuery = firebase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false })

    if (isActive !== undefined) {
      driversQuery = driversQuery.eq('is_active', isActive === 'true')
    }

    const { data: driversData, error: driversError } = await driversQuery
    if (driversError) throw driversError

    // Load all operators for manual join
    const { data: operatorsData } = await firebase
      .from('operators')
      .select('id, name, code')

    const operatorsMap = new Map((operatorsData || []).map((op: any) => [op.id, op]))

    // Load all junction records for manual join
    const { data: junctionData } = await firebase
      .from('driver_operators')
      .select('*')

    // Create driver_id -> operators map
    const driverOperatorsMap = new Map<string, any[]>()
    ;(junctionData || []).forEach((junction: any) => {
      const list = driverOperatorsMap.get(junction.driver_id) || []
      list.push(junction)
      driverOperatorsMap.set(junction.driver_id, list)
    })

    // Map drivers with operator info
    let drivers = (driversData || []).map((driver: any) => {
      // Get primary operator
      const primaryOperatorData = driver.operator_id ? operatorsMap.get(driver.operator_id) as any : null
      const primaryOperator = primaryOperatorData ? {
        id: primaryOperatorData.id,
        name: primaryOperatorData.name,
        code: primaryOperatorData.code,
      } : undefined

      // Get all operators from junction table
      const junctionRecords = driverOperatorsMap.get(driver.id) || []
      const allOperators = junctionRecords.map((junction: any) => {
        const opData = operatorsMap.get(junction.operator_id) as any
        return opData ? {
          id: opData.id,
          name: opData.name,
          code: opData.code,
          isPrimary: junction.is_primary,
        } : null
      }).filter((op: any) => op !== null)

      // Use junction operators if available, otherwise fallback to primary
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
        if (driver.operatorId === opId) return true
        if (driver.operatorIds.includes(opId)) return true
        return false
      })
    }

    return res.json(drivers)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error fetching drivers:', error)
    return res.status(500).json({ error: err.message || 'Failed to fetch drivers' })
  }
}

export const getDriverById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Get driver without join
    const { data: driverData, error: driverError } = await firebase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single()

    if (driverError) throw driverError
    if (!driverData) return res.status(404).json({ error: 'Driver not found' })

    // Manual join: fetch primary operator
    let primaryOperator: { id: string; name: string; code: string } | undefined
    if (driverData.operator_id) {
      const { data: opData } = await firebase
        .from('operators')
        .select('id, name, code')
        .eq('id', driverData.operator_id)
        .single()
      if (opData) {
        primaryOperator = { id: opData.id, name: opData.name, code: opData.code }
      }
    }

    // Get junction operators
    const junctionData = await fetchDriverOperators(id)
    const allOperators = junctionData.map((j: any) => ({
      id: j.operators.id,
      name: j.operators.name,
      code: j.operators.code,
      isPrimary: j.is_primary,
    }))

    const operators = allOperators.length > 0 ? allOperators : (primaryOperator ? [{ ...primaryOperator, isPrimary: true }] : [])

    return res.json({
      id: driverData.id,
      operatorId: driverData.operator_id,
      operator: primaryOperator,
      operatorIds: operators.map((op: any) => op.id),
      operators: operators,
      fullName: driverData.full_name,
      idNumber: driverData.id_number,
      phone: driverData.phone,
      province: driverData.province,
      district: driverData.district,
      address: driverData.address,
      licenseNumber: driverData.license_number,
      licenseClass: driverData.license_class,
      licenseExpiryDate: driverData.license_expiry_date,
      imageUrl: driverData.image_url,
      isActive: driverData.is_active,
      createdAt: driverData.created_at,
      updatedAt: driverData.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error fetching driver:', error)
    return res.status(500).json({ error: err.message || 'Failed to fetch driver' })
  }
}

export const createDriver = async (req: Request, res: Response) => {
  try {
    const validated = validateCreateDriver(req.body)
    const primaryOperatorId = validated.operatorIds[0]

    // Create driver without join
    const { data: driverData, error: driverError } = await firebase
      .from('drivers')
      .insert({
        operator_id: primaryOperatorId,
        full_name: validated.fullName,
        id_number: validated.idNumber,
        phone: validated.phone || null,
        province: validated.province || null,
        district: validated.district || null,
        address: validated.address || null,
        license_number: validated.licenseNumber,
        license_class: validated.licenseClass,
        license_expiry_date: validated.licenseExpiryDate,
        image_url: validated.imageUrl || null,
        is_active: true,
      })
      .select('*')
      .single()

    if (driverError) throw driverError

    // Create junction records
    await updateDriverOperators(driverData.id, validated.operatorIds)

    // Manual join: fetch primary operator
    let primaryOperator: { id: string; name: string; code: string } | undefined
    if (driverData.operator_id) {
      const { data: opData } = await firebase
        .from('operators')
        .select('id, name, code')
        .eq('id', driverData.operator_id)
        .single()
      if (opData) {
        primaryOperator = { id: opData.id, name: opData.name, code: opData.code }
      }
    }

    // Get junction operators
    const junctionData = await fetchDriverOperators(driverData.id)
    const allOperators = junctionData.map((j: any) => ({
      id: j.operators.id,
      name: j.operators.name,
      code: j.operators.code,
      isPrimary: j.is_primary,
    }))

    const operators = allOperators.length > 0 ? allOperators : (primaryOperator ? [{ ...primaryOperator, isPrimary: true }] : [])

    return res.status(201).json({
      id: driverData.id,
      operatorId: driverData.operator_id,
      operator: primaryOperator,
      operatorIds: operators.map((op: any) => op.id),
      operators: operators,
      fullName: driverData.full_name,
      idNumber: driverData.id_number,
      phone: driverData.phone,
      province: driverData.province,
      district: driverData.district,
      address: driverData.address,
      licenseNumber: driverData.license_number,
      licenseClass: driverData.license_class,
      licenseExpiryDate: driverData.license_expiry_date,
      imageUrl: driverData.image_url,
      isActive: driverData.is_active,
      createdAt: driverData.created_at,
      updatedAt: driverData.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { code?: string; name?: string; errors?: Array<{ message: string }>; message?: string }
    console.error('Error creating driver:', error)
    if (err.code === '23505') return res.status(400).json({ error: 'Driver with this ID number or license already exists' })
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message })
    return res.status(500).json({ error: err.message || 'Failed to create driver' })
  }
}

export const updateDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = validateUpdateDriver(req.body)

    const updateData: Record<string, unknown> = {}
    if (validated.fullName) updateData.full_name = validated.fullName
    if (validated.idNumber) updateData.id_number = validated.idNumber
    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.province !== undefined) updateData.province = validated.province || null
    if (validated.district !== undefined) updateData.district = validated.district || null
    if (validated.address !== undefined) updateData.address = validated.address || null
    if (validated.licenseNumber) updateData.license_number = validated.licenseNumber
    if (validated.licenseClass) updateData.license_class = validated.licenseClass
    if (validated.licenseExpiryDate) updateData.license_expiry_date = validated.licenseExpiryDate
    if (validated.imageUrl !== undefined) updateData.image_url = validated.imageUrl || null

    // Update operators if provided
    if (validated.operatorIds && validated.operatorIds.length > 0) {
      updateData.operator_id = validated.operatorIds[0]
      await updateDriverOperators(id, validated.operatorIds)
    }

    // Update driver without join
    const { data, error } = await firebase
      .from('drivers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Driver not found' })

    // Sync denormalized data if full_name changed
    if (updateData.full_name) {
      syncDriverChanges(id, data.full_name).catch((err) => {
        console.error('[Driver Update] Failed to sync denormalized data:', err)
      })
    }

    // Manual join: fetch primary operator
    let primaryOperator: { id: string; name: string; code: string } | undefined
    if (data.operator_id) {
      const { data: opData } = await firebase
        .from('operators')
        .select('id, name, code')
        .eq('id', data.operator_id)
        .single()
      if (opData) {
        primaryOperator = { id: opData.id, name: opData.name, code: opData.code }
      }
    }

    // Get junction operators
    const junctionData = await fetchDriverOperators(id)
    const allOperators = junctionData.map((j: any) => ({
      id: j.operators.id,
      name: j.operators.name,
      code: j.operators.code,
      isPrimary: j.is_primary,
    }))

    const operators = allOperators.length > 0 ? allOperators : (primaryOperator ? [{ ...primaryOperator, isPrimary: true }] : [])

    return res.json({
      id: data.id,
      operatorId: data.operator_id,
      operator: primaryOperator,
      operatorIds: operators.map((op: any) => op.id),
      operators: operators,
      fullName: data.full_name,
      idNumber: data.id_number,
      phone: data.phone,
      province: data.province,
      district: data.district,
      address: data.address,
      licenseNumber: data.license_number,
      licenseClass: data.license_class,
      licenseExpiryDate: data.license_expiry_date,
      imageUrl: data.image_url,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { name?: string; errors?: Array<{ message: string }>; message?: string }
    console.error('Error updating driver:', error)
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message })
    return res.status(500).json({ error: err.message || 'Failed to update driver' })
  }
}

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await firebase.from('drivers').delete().eq('id', id)
    if (error) throw error

    return res.status(204).send()
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting driver:', error)
    return res.status(500).json({ error: err.message || 'Failed to delete driver' })
  }
}
