/**
 * Driver Controller
 * Handles HTTP requests for driver operations
 */

import { Request, Response } from 'express'
import { firebase } from '../../../config/database.js'
import { syncDriverChanges } from '../../../utils/denormalization-sync.js'
import { validateCreateDriver, validateUpdateDriver } from '../fleet-validation.js'
import { mapDriverToAPI, mapDriverWithOperators } from '../fleet-mappers.js'
import type { DriverDBRecord } from '../fleet-types.js'

/**
 * Fetch junction table data for operators
 */
async function fetchDriverOperators(driverId: string) {
  const { data, error } = await firebase
    .from('driver_operators')
    .select('operator_id, is_primary, operators:operator_id(id, name, code)')
    .eq('driver_id', driverId)

  if (error) throw error
  return data || []
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

    let query = firebase
      .from('drivers')
      .select('*, operators:operator_id(id, name, code), driver_operators(operator_id, is_primary, operators:operator_id(id, name, code))')
      .order('created_at', { ascending: false })

    // Filter by operator
    if (operatorId) {
      const [{ data: junctionDrivers }, { data: primaryDrivers }] = await Promise.all([
        firebase.from('driver_operators').select('driver_id').eq('operator_id', operatorId as string),
        firebase.from('drivers').select('id').eq('operator_id', operatorId as string),
      ])

      const junctionDriverIds = junctionDrivers?.map((d: { driver_id: string }) => d.driver_id) || []
      const primaryDriverIds = primaryDrivers?.map((d: { id: string }) => d.id) || []
      const allDriverIds = [...new Set([...primaryDriverIds, ...junctionDriverIds])]

      if (allDriverIds.length > 0) {
        query = query.in('id', allDriverIds)
      } else {
        return res.json([]) // No drivers found
      }
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query
    if (error) throw error

    const drivers = data.map((driver: DriverDBRecord) => mapDriverToAPI(driver))
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

    const { data: driverData, error: driverError } = await firebase
      .from('drivers')
      .select('*, operators:operator_id(id, name, code)')
      .eq('id', id)
      .single()

    if (driverError) throw driverError
    if (!driverData) return res.status(404).json({ error: 'Driver not found' })

    const junctionData = await fetchDriverOperators(id)
    return res.json(mapDriverWithOperators(driverData, junctionData))
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
      .select('*, operators:operator_id(id, name, code)')
      .single()

    if (driverError) throw driverError

    // Create junction records
    await updateDriverOperators(driverData.id, validated.operatorIds)

    const junctionData = await fetchDriverOperators(driverData.id)
    return res.status(201).json(mapDriverWithOperators(driverData, junctionData))
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

    const { data, error } = await firebase
      .from('drivers')
      .update(updateData)
      .eq('id', id)
      .select('*, operators:operator_id(id, name, code)')
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Driver not found' })

    // Sync denormalized data if full_name changed
    if (updateData.full_name) {
      syncDriverChanges(id, data.full_name).catch((err) => {
        console.error('[Driver Update] Failed to sync denormalized data:', err)
      })
    }

    const junctionData = await fetchDriverOperators(id)
    return res.json(mapDriverWithOperators(data, junctionData))
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
