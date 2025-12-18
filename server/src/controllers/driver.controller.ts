import { Request, Response } from 'express'
import { firebase } from '../config/database.js'
import { z } from 'zod'
import { syncDriverChanges } from '../utils/denormalization-sync.js'

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
    const { operatorId, isActive } = req.query

    let query = firebase
      .from('drivers')
      .select(`
        *,
        operators:operator_id(id, name, code),
        driver_operators(
          operator_id,
          is_primary,
          operators:operator_id(id, name, code)
        )
      `)
      .order('created_at', { ascending: false })

    if (operatorId) {
      // Filter by operator through junction table or primary operator
      // First, get driver IDs from junction table
      const { data: junctionDrivers } = await firebase
        .from('driver_operators')
        .select('driver_id')
        .eq('operator_id', operatorId as string)
      
      const junctionDriverIds = junctionDrivers?.map((d: any) => d.driver_id) || []
      
      // Get driver IDs that have this operator as primary
      const { data: primaryDrivers } = await firebase
        .from('drivers')
        .select('id')
        .eq('operator_id', operatorId as string)
      
      const primaryDriverIds = primaryDrivers?.map((d: any) => d.id) || []
      
      // Combine all driver IDs and filter
      const allDriverIds = [...new Set([...primaryDriverIds, ...junctionDriverIds])]
      
      if (allDriverIds.length > 0) {
        query = query.in('id', allDriverIds)
      } else {
        // No drivers found, return empty result
        query = query.eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent ID to return empty
      }
    }
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    const drivers = data.map((driver: any) => {
      // Get primary operator from operator_id (backward compatibility)
      const primaryOperator = driver.operators ? {
        id: driver.operators.id,
        name: driver.operators.name,
        code: driver.operators.code,
      } : undefined

      // Get all operators from junction table
      const allOperators = driver.driver_operators?.map((do_rel: any) => ({
        id: do_rel.operators?.id,
        name: do_rel.operators?.name,
        code: do_rel.operators?.code,
        isPrimary: do_rel.is_primary,
      })).filter((op: any) => op.id) || []

      // If no operators from junction table, use primary operator
      const operators = allOperators.length > 0 ? allOperators : (primaryOperator ? [primaryOperator] : [])

      return {
        id: driver.id,
        operatorId: driver.operator_id, // Keep for backward compatibility
        operator: primaryOperator, // Keep for backward compatibility
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

    return res.json(drivers)
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return res.status(500).json({ error: 'Failed to fetch drivers' })
  }
}

export const getDriverById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Get driver with primary operator
    const { data: driverData, error: driverError } = await firebase
      .from('drivers')
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .eq('id', id)
      .single()

    if (driverError) throw driverError
    if (!driverData) {
      return res.status(404).json({ error: 'Driver not found' })
    }

    // Get all operators from junction table
    const { data: junctionData, error: junctionError } = await firebase
      .from('driver_operators')
      .select(`
        operator_id,
        is_primary,
        operators:operator_id(id, name, code)
      `)
      .eq('driver_id', id)

    if (junctionError) throw junctionError

    const primaryOperator = driverData.operators ? {
      id: driverData.operators.id,
      name: driverData.operators.name,
      code: driverData.operators.code,
    } : undefined

    const allOperators = junctionData?.map((do_rel: any) => ({
      id: do_rel.operators?.id,
      name: do_rel.operators?.name,
      code: do_rel.operators?.code,
      isPrimary: do_rel.is_primary,
    })).filter((op: any) => op.id) || []

    const operators = allOperators.length > 0 ? allOperators : (primaryOperator ? [primaryOperator] : [])

    return res.json({
      id: driverData.id,
      operatorId: driverData.operator_id, // Keep for backward compatibility
      operator: primaryOperator, // Keep for backward compatibility
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
  } catch (error) {
    console.error('Error fetching driver:', error)
    return res.status(500).json({ error: 'Failed to fetch driver' })
  }
}

export const createDriver = async (req: Request, res: Response) => {
  try {
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
    const { data: driverData, error: driverError } = await firebase
      .from('drivers')
      .insert({
        operator_id: primaryOperatorId,
        full_name: fullName,
        id_number: idNumber,
        phone: phone || null,
        province: province || null,
        district: district || null,
        address: address || null,
        license_number: licenseNumber,
        license_class: licenseClass,
        license_expiry_date: licenseExpiryDate,
        image_url: imageUrl || null,
        is_active: true,
      })
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .single()

    if (driverError) throw driverError

    // Create junction records for all operators
    const junctionRecords = operatorIds.map((opId, index) => ({
      driver_id: driverData.id,
      operator_id: opId,
      is_primary: index === 0, // First one is primary
    }))

    const { error: junctionError } = await firebase
      .from('driver_operators')
      .insert(junctionRecords)

    if (junctionError) throw junctionError

    // Get all operators for response
    const { data: junctionData } = await firebase
      .from('driver_operators')
      .select(`
        operator_id,
        is_primary,
        operators:operator_id(id, name, code)
      `)
      .eq('driver_id', driverData.id)

    const allOperators = junctionData?.map((do_rel: any) => ({
      id: do_rel.operators?.id,
      name: do_rel.operators?.name,
      code: do_rel.operators?.code,
      isPrimary: do_rel.is_primary,
    })).filter((op: any) => op.id) || []

    const primaryOperator = driverData.operators ? {
      id: driverData.operators.id,
      name: driverData.operators.name,
      code: driverData.operators.code,
    } : undefined

    return res.status(201).json({
      id: driverData.id,
      operatorId: driverData.operator_id, // Keep for backward compatibility
      operator: primaryOperator, // Keep for backward compatibility
      operatorIds: allOperators.map((op: any) => op.id),
      operators: allOperators,
      fullName: driverData.full_name,
      idNumber: driverData.id_number,
      phone: driverData.phone,
      email: driverData.email,
      province: driverData.province,
      district: driverData.district,
      address: driverData.address,
      licenseNumber: driverData.license_number,
      licenseClass: driverData.license_class,
      licenseIssueDate: driverData.license_issue_date,
      licenseExpiryDate: driverData.license_expiry_date,
      imageUrl: driverData.image_url,
      isActive: driverData.is_active,
      createdAt: driverData.created_at,
      updatedAt: driverData.updated_at,
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
    const { id } = req.params
    const validated = driverSchema.partial().parse(req.body)

    const updateData: any = {}
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
      const primaryOperatorId = validated.operatorIds[0]
      updateData.operator_id = primaryOperatorId

      // Delete existing junction records
      await firebase
        .from('driver_operators')
        .delete()
        .eq('driver_id', id)

      // Create new junction records
      const junctionRecords = validated.operatorIds.map((opId, index) => ({
        driver_id: id,
        operator_id: opId,
        is_primary: index === 0,
      }))

      const { error: junctionError } = await firebase
        .from('driver_operators')
        .insert(junctionRecords)

      if (junctionError) throw junctionError
    }

    const { data, error } = await firebase
      .from('drivers')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        operators:operator_id(id, name, code)
      `)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Driver not found' })
    }

    // Sync denormalized data to dispatch_records if full_name changed
    if (updateData.full_name) {
      // Run sync in background (non-blocking)
      syncDriverChanges(id, data.full_name).catch((err) => {
        console.error('[Driver Update] Failed to sync denormalized data:', err)
      })
    }

    // Get all operators from junction table
    const { data: junctionData } = await firebase
      .from('driver_operators')
      .select(`
        operator_id,
        is_primary,
        operators:operator_id(id, name, code)
      `)
      .eq('driver_id', id)

    const allOperators = junctionData?.map((do_rel: any) => ({
      id: do_rel.operators?.id,
      name: do_rel.operators?.name,
      code: do_rel.operators?.code,
      isPrimary: do_rel.is_primary,
    })).filter((op: any) => op.id) || []

    const primaryOperator = data.operators ? {
      id: data.operators.id,
      name: data.operators.name,
      code: data.operators.code,
    } : undefined

    return res.json({
      id: data.id,
      operatorId: data.operator_id, // Keep for backward compatibility
      operator: primaryOperator, // Keep for backward compatibility
      operatorIds: allOperators.map((op: any) => op.id),
      operators: allOperators,
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
    const { id } = req.params

    const { error } = await firebase
      .from('drivers')
      .delete()
      .eq('id', id)

    if (error) throw error

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting driver:', error)
    return res.status(500).json({ error: 'Failed to delete driver' })
  }
}
