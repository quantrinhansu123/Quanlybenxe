import { Request, Response } from 'express'
import { db } from '../db/drizzle.js'
import { dispatchRecords } from '../db/schema/index.js'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth.js'
import { getCurrentVietnamTime, convertVietnamISOToUTCForStorage } from '../utils/timezone.js'
import {
  fetchDenormalizedData,
  buildDenormalizedFields,
  fetchUserName,
  fetchRouteData,
  buildRouteDenormalizedFields
} from '../utils/denormalization.js'

const dispatchSchema = z.object({
  vehicleId: z.string().min(1, 'Invalid vehicle ID'),
  driverId: z.string().min(1).optional(),  // Optional - bypass driver requirement
  scheduleId: z.string().min(1).optional(),
  routeId: z.string().min(1, 'Invalid route ID').optional(),
  entryTime: z.string().refine(
    (val) => {
      // Accept ISO 8601 format with or without timezone
      // Examples: "2024-12-25T14:30:00+07:00" or "2024-12-25T14:30:00Z" or "2024-12-25T14:30:00"
      const date = new Date(val)
      return !isNaN(date.getTime())
    },
    { message: 'Invalid entry time format' }
  ),
  notes: z.string().optional(),
  entryShiftId: z.string().min(1).optional(),
})

export const getAllDispatchRecords = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { status, vehicleId, driverId, routeId } = req.query

    // Build where conditions
    const conditions = []
    if (status) {
      conditions.push(eq(dispatchRecords.status, status as string))
    }
    if (vehicleId) {
      conditions.push(eq(dispatchRecords.vehicleId, vehicleId as string))
    }
    if (driverId) {
      conditions.push(eq(dispatchRecords.driverId, driverId as string))
    }
    if (routeId) {
      conditions.push(eq(dispatchRecords.routeId, routeId as string))
    }

    const records = await db
      .select()
      .from(dispatchRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dispatchRecords.entryTime))

    // OPTIMIZED: Use denormalized data - no additional queries needed!
    // All related entity names are embedded in the dispatch_records
    const result = records.map((record: any) => ({
      id: record.id,
      vehicleId: record.vehicleId,
      vehicle: {
        id: record.vehicleId,
        plateNumber: record.vehiclePlateNumber || '',
        operatorId: record.vehicleOperatorId || null,
        operator: record.vehicleOperatorName ? {
          id: record.vehicleOperatorId,
          name: record.vehicleOperatorName,
          code: record.vehicleOperatorCode,
        } : undefined,
      },
      vehiclePlateNumber: record.vehiclePlateNumber || '',
      driverId: record.driverId,
      driverName: record.driverFullName || '',
      scheduleId: record.scheduleId,
      routeId: record.routeId,
      route: record.routeName ? {
        id: record.routeId,
        routeName: record.routeName,
        routeType: record.routeType,
        destination: record.routeDestinationName ? {
          id: record.routeDestinationId,
          name: record.routeDestinationName,
          code: record.routeDestinationCode,
        } : undefined,
      } : undefined,
      routeName: record.routeName || '',
      entryTime: record.entryTime,
      entryBy: record.entryByName || record.entryBy,
      passengerDropTime: record.passengerDropTime,
      passengersArrived: record.passengersArrived,
      passengerDropBy: record.passengerDropByName || record.passengerDropBy,
      boardingPermitTime: record.boardingPermitTime,
      plannedDepartureTime: record.plannedDepartureTime,
      transportOrderCode: record.transportOrderCode,
      seatCount: record.seatCount,
      permitStatus: record.permitStatus,
      rejectionReason: record.rejectionReason,
      boardingPermitBy: record.boardingPermitByName || record.boardingPermitBy,
      paymentTime: record.paymentTime,
      paymentAmount: record.paymentAmount ? parseFloat(record.paymentAmount) : null,
      paymentMethod: record.paymentMethod,
      invoiceNumber: record.invoiceNumber,
      paymentBy: record.paymentByName || record.paymentBy,
      departureOrderTime: record.departureOrderTime,
      passengersDeparting: record.passengersDeparting,
      departureOrderBy: record.departureOrderByName || record.departureOrderBy,
      exitTime: record.exitTime,
      exitBy: record.exitByName || record.exitBy,
      currentStatus: record.status,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))

    return res.json(result)
  } catch (error) {
    console.error('Error fetching dispatch records:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch records' })
  }
}

export const getDispatchRecordById = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    const [record] = await db
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.id, id))

    if (!record) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // OPTIMIZED: Use denormalized data - no additional queries needed!
    return res.json({
      id: record.id,
      vehicleId: record.vehicleId,
      vehicle: {
        id: record.vehicleId,
        plateNumber: record.vehiclePlateNumber || '',
        operatorId: record.vehicleOperatorId || null,
        operator: record.vehicleOperatorName ? {
          id: record.vehicleOperatorId,
          name: record.vehicleOperatorName,
          code: record.vehicleOperatorCode,
        } : undefined,
      },
      vehiclePlateNumber: record.vehiclePlateNumber || '',
      driverId: record.driverId,
      driverName: record.driverFullName || '',
      scheduleId: record.scheduleId,
      routeId: record.routeId,
      route: record.routeName ? {
        id: record.routeId,
        routeName: record.routeName,
        routeType: record.routeType,
        destination: record.routeDestinationName ? {
          id: record.routeDestinationId,
          name: record.routeDestinationName,
          code: record.routeDestinationCode,
        } : undefined,
      } : undefined,
      routeName: record.routeName || '',
      entryTime: record.entryTime,
      entryBy: record.entryByName || record.entryBy,
      passengerDropTime: record.passengerDropTime,
      passengersArrived: record.passengersArrived,
      passengerDropBy: record.passengerDropByName || record.passengerDropBy,
      boardingPermitTime: record.boardingPermitTime,
      plannedDepartureTime: record.plannedDepartureTime,
      transportOrderCode: record.transportOrderCode,
      seatCount: record.seatCount,
      permitStatus: record.permitStatus,
      rejectionReason: record.rejectionReason,
      boardingPermitBy: record.boardingPermitByName || record.boardingPermitBy,
      paymentTime: record.paymentTime,
      paymentAmount: record.paymentAmount ? parseFloat(record.paymentAmount) : null,
      paymentMethod: record.paymentMethod,
      invoiceNumber: record.invoiceNumber,
      paymentBy: record.paymentByName || record.paymentBy,
      departureOrderTime: record.departureOrderTime,
      passengersDeparting: record.passengersDeparting,
      departureOrderBy: record.departureOrderByName || record.departureOrderBy,
      exitTime: record.exitTime,
      exitBy: record.exitByName || record.exitBy,
      currentStatus: record.status,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching dispatch record:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch record' })
  }
}

export const createDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { vehicleId, driverId, scheduleId, routeId, entryTime, notes, entryShiftId } = dispatchSchema.parse(req.body)
    const userId = req.user?.id

    // Frontend sends ISO string with +07:00 (Vietnam time)
    // Convert to UTC ISO string for database storage, but preserve Vietnam time value
    // by storing UTC time that represents Vietnam time (UTC+7)
    const entryTimeForDB = convertVietnamISOToUTCForStorage(entryTime)

    // OPTIMIZED: Fetch denormalized data in parallel before insert
    const denormData = await fetchDenormalizedData({
      vehicleId,
      driverId,
      routeId,
      userId,
    })

    const denormFields = buildDenormalizedFields(denormData)

    const insertData: any = {
      vehicleId,
      driverId: driverId || null,
      scheduleId: scheduleId || null,
      routeId: routeId || null,
      entryTime: entryTimeForDB,
      entryBy: userId || null,
      status: 'entered',
      notes: notes || null,
      // Denormalized fields
      ...denormFields,
      entryByName: denormData.user?.fullName || null,
    }

    // Set entry_shift_id if provided
    if (entryShiftId) {
      insertData.entryShiftId = entryShiftId
    }

    const [data] = await db
      .insert(dispatchRecords)
      .values(insertData)
      .returning()

    // Response uses denormalized data - no additional queries needed!
    return res.status(201).json({
      id: data.id,
      vehicleId: data.vehicleId,
      vehicle: {
        id: data.vehicleId,
        plateNumber: data.vehiclePlateNumber || '',
        operatorId: data.vehicleOperatorId || null,
        operator: data.vehicleOperatorName ? {
          id: data.vehicleOperatorId,
          name: data.vehicleOperatorName,
          code: data.vehicleOperatorCode,
        } : undefined,
      },
      vehiclePlateNumber: data.vehiclePlateNumber || '',
      driverId: data.driverId,
      driverName: data.driverFullName || '',
      scheduleId: data.scheduleId,
      routeId: data.routeId,
      route: data.routeName ? {
        id: data.routeId,
        routeName: data.routeName,
        routeType: data.routeType,
        destination: data.routeDestinationName ? {
          id: data.routeDestinationId,
          name: data.routeDestinationName,
          code: data.routeDestinationCode,
        } : undefined,
      } : undefined,
      routeName: data.routeName || '',
      entryTime: data.entryTime,
      entryBy: data.entryByName || data.entryBy,
      currentStatus: data.status,
      notes: data.notes,
      metadata: data.metadata,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
  } catch (error: any) {
    console.error('Error creating dispatch record:', error)
    console.error('Error stack:', error.stack)
    console.error('Request body:', JSON.stringify(req.body, null, 2))
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create dispatch record' })
  }
}

// Update dispatch status - passengers dropped
export const recordPassengerDrop = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const { passengersArrived, routeId } = req.body
    const userId = req.user?.id

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    // Build update object with denormalized user name
    const updateData: any = {
      passengerDropTime: getCurrentVietnamTime(),
      passengersArrived: passengersArrived || null,
      passengerDropBy: userId || null,
      passengerDropByName: userName,
      status: 'passengers_dropped',
    }

    // Set routeId and fetch route denormalized data if provided
    if (routeId) {
      updateData.routeId = routeId
      const routeData = await fetchRouteData(routeId)
      if (routeData) {
        Object.assign(updateData, buildRouteDenormalizedFields(routeData))
      }
    }

    const [data] = await db
      .update(dispatchRecords)
      .set(updateData)
      .where(eq(dispatchRecords.id, id))
      .returning()

    if (!data) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json({ message: 'Passenger drop recorded', dispatch: data })
  } catch (error: any) {
    console.error('Error recording passenger drop:', error)
    return res.status(500).json({ error: error.message || 'Failed to record passenger drop' })
  }
}

// Issue boarding permit
export const issuePermit = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const { transportOrderCode, plannedDepartureTime, seatCount, permitStatus, rejectionReason, routeId, scheduleId, replacementVehicleId, permitShiftId } = req.body
    const userId = req.user?.id

    console.log('[issuePermit] Record ID:', id)
    console.log('[issuePermit] Request body:', { transportOrderCode, plannedDepartureTime, seatCount, permitStatus, routeId, scheduleId })

    if (!transportOrderCode && permitStatus !== 'rejected') {
      return res.status(400).json({ error: 'Transport order code is required for approval' })
    }

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    // Get current metadata to preserve existing data
    const [currentRecord] = await db
      .select({ metadata: dispatchRecords.metadata })
      .from(dispatchRecords)
      .where(eq(dispatchRecords.id, id))

    const currentMetadata = (currentRecord?.metadata as Record<string, any>) || {}
    const newMetadata: Record<string, any> = { ...currentMetadata }

    // Update replacement vehicle ID in metadata if provided
    if (replacementVehicleId) {
      newMetadata.replacementVehicleId = replacementVehicleId
    } else if (replacementVehicleId === null || replacementVehicleId === '') {
      // Remove replacement vehicle ID if explicitly set to empty
      delete newMetadata.replacementVehicleId
    }

    const updateData: any = {
      boardingPermitTime: getCurrentVietnamTime(),
      boardingPermitBy: userId || null,
      boardingPermitByName: userName,
      permitStatus: permitStatus || 'approved',
      metadata: newMetadata,
    }

    // Set permit_shift_id if provided
    if (permitShiftId) {
      updateData.permitShiftId = permitShiftId
    }

    // Set routeId and fetch route denormalized data if provided
    if (routeId) {
      updateData.routeId = routeId
      const routeData = await fetchRouteData(routeId)
      if (routeData) {
        Object.assign(updateData, buildRouteDenormalizedFields(routeData))
      }
    }

    // Set scheduleId if provided
    if (scheduleId) {
      updateData.scheduleId = scheduleId
    }

    if (permitStatus === 'approved') {
      updateData.transportOrderCode = transportOrderCode
      updateData.plannedDepartureTime = plannedDepartureTime
      updateData.seatCount = seatCount
      updateData.status = 'permit_issued'
      updateData.rejectionReason = rejectionReason || null
    } else if (permitStatus === 'rejected') {
      updateData.transportOrderCode = transportOrderCode || null
      updateData.plannedDepartureTime = plannedDepartureTime || null
      updateData.seatCount = seatCount || null
      updateData.status = 'permit_rejected'
      updateData.rejectionReason = rejectionReason || null
    }

    console.log('[issuePermit] Updating record with data:', JSON.stringify(updateData, null, 2))

    const [data] = await db
      .update(dispatchRecords)
      .set(updateData)
      .where(eq(dispatchRecords.id, id))
      .returning()

    console.log('[issuePermit] Update result - data:', data ? 'found' : 'null')

    if (!data) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json({ message: 'Permit processed', dispatch: data })
  } catch (error: any) {
    console.error('[issuePermit] Error:', error)
    // Check for duplicate key error (unique constraint violation)
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(400).json({
        error: 'Mã lệnh vận chuyển đã tồn tại. Vui lòng chọn mã khác.',
        code: '23505'
      })
    }
    return res.status(500).json({ error: error.message || 'Failed to issue permit' })
  }
}

// Process payment
export const processPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const { paymentAmount, paymentMethod, invoiceNumber, paymentShiftId } = req.body
    const userId = req.user?.id

    // Allow payment amount >= 0 (including 0 for cases with no services)
    if (paymentAmount === undefined || paymentAmount === null || paymentAmount < 0) {
      return res.status(400).json({ error: 'Valid payment amount is required (must be >= 0)' })
    }

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    const updateData: any = {
      paymentTime: getCurrentVietnamTime(),
      paymentAmount: paymentAmount,
      paymentMethod: paymentMethod || 'cash',
      invoiceNumber: invoiceNumber || null,
      paymentBy: userId || null,
      paymentByName: userName,
      status: 'paid',
    }

    // Set payment_shift_id if provided
    if (paymentShiftId) {
      updateData.paymentShiftId = paymentShiftId
    }

    const [data] = await db
      .update(dispatchRecords)
      .set(updateData)
      .where(eq(dispatchRecords.id, id))
      .returning()

    if (!data) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json({ message: 'Payment processed', dispatch: data })
  } catch (error: any) {
    console.error('Error processing payment:', error)
    return res.status(500).json({ error: error.message || 'Failed to process payment' })
  }
}

// Issue departure order
export const issueDepartureOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const { passengersDeparting, departureOrderShiftId } = req.body
    const userId = req.user?.id

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    const updateData: any = {
      departureOrderTime: getCurrentVietnamTime(),
      passengersDeparting: passengersDeparting || null,
      departureOrderBy: userId || null,
      departureOrderByName: userName,
      status: 'departure_ordered',
    }

    // Set departure_order_shift_id if provided
    if (departureOrderShiftId) {
      updateData.departureOrderShiftId = departureOrderShiftId
    }

    const [data] = await db
      .update(dispatchRecords)
      .set(updateData)
      .where(eq(dispatchRecords.id, id))
      .returning()

    if (!data) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json({ message: 'Departure order issued', dispatch: data })
  } catch (error: any) {
    console.error('Error issuing departure order:', error)
    return res.status(500).json({ error: error.message || 'Failed to issue departure order' })
  }
}

// Record exit
export const recordExit = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const { exitTime, passengersDeparting, exitShiftId } = req.body
    const userId = req.user?.id

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    const updateData: any = {
      exitTime: exitTime ? convertVietnamISOToUTCForStorage(exitTime) : getCurrentVietnamTime(),
      exitBy: userId || null,
      exitByName: userName,
      status: 'departed',
    }

    if (passengersDeparting !== undefined) {
      updateData.passengersDeparting = passengersDeparting
    }

    // Set exit_shift_id if provided
    if (exitShiftId) {
      updateData.exitShiftId = exitShiftId
    }

    const [data] = await db
      .update(dispatchRecords)
      .set(updateData)
      .where(eq(dispatchRecords.id, id))
      .returning()

    if (!data) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json({ message: 'Exit recorded', dispatch: data })
  } catch (error: any) {
    console.error('Error recording exit:', error)
    return res.status(500).json({ error: error.message || 'Failed to record exit' })
  }
}

// Delete dispatch record
export const deleteDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    console.log('[deleteDispatchRecord] Attempting to delete record:', id)

    // Check if record exists
    const [existingRecord] = await db
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.id, id))

    console.log('[deleteDispatchRecord] Fetch result:', { found: !!existingRecord })

    if (!existingRecord) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Only allow deletion of records that haven't departed yet
    if (existingRecord.status === 'departed') {
      return res.status(400).json({ error: 'Cannot delete a record that has already departed' })
    }

    // Delete the record
    await db
      .delete(dispatchRecords)
      .where(eq(dispatchRecords.id, id))

    return res.json({ message: 'Dispatch record deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting dispatch record:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete dispatch record' })
  }
}

// Update dispatch record (for editing basic info)
export const updateDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const { vehicleId, driverId, routeId, entryTime, notes } = req.body

    // Check if record exists
    const [existingRecord] = await db
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.id, id))

    if (!existingRecord) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Only allow editing of records in early stages
    const editableStatuses = ['entered', 'passengers_dropped']
    if (!editableStatuses.includes(existingRecord.status)) {
      return res.status(400).json({
        error: 'Cannot edit a record that has already been permitted or paid'
      })
    }

    // Build update data
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    }

    // Update vehicle if changed
    if (vehicleId && vehicleId !== existingRecord.vehicleId) {
      updateData.vehicleId = vehicleId
      try {
        const denormalized = await fetchDenormalizedData(vehicleId)
        Object.assign(updateData, buildDenormalizedFields(denormalized))
      } catch (denormError) {
        // Legacy vehicle (legacy_* or badge_*) - fetch may fail
        // Keep existing denormalized data, just update the vehicle_id
        console.warn(`[updateDispatchRecord] fetchDenormalizedData failed for ${vehicleId}:`, denormError)
      }
    }

    // Update driver if changed
    if (driverId && driverId !== existingRecord.driverId) {
      const driverName = await fetchUserName(driverId)
      updateData.driverId = driverId
      updateData.driverFullName = driverName
    }

    // Update route if changed
    if (routeId !== undefined) {
      if (routeId && routeId !== existingRecord.routeId) {
        const routeData = await fetchRouteData(routeId)
        updateData.routeId = routeId
        Object.assign(updateData, buildRouteDenormalizedFields(routeData))
      } else if (!routeId) {
        updateData.routeId = null
        updateData.routeName = null
        updateData.routeType = null
        updateData.routeDestinationId = null
        updateData.routeDestinationName = null
        updateData.routeDestinationCode = null
      }
    }

    // Update entry time if changed
    if (entryTime) {
      updateData.entryTime = convertVietnamISOToUTCForStorage(entryTime)
    }

    // Update notes if provided
    if (notes !== undefined) {
      updateData.notes = notes
    }

    // Perform update
    const [data] = await db
      .update(dispatchRecords)
      .set(updateData)
      .where(eq(dispatchRecords.id, id))
      .returning()

    return res.json({ message: 'Dispatch record updated successfully', dispatch: data })
  } catch (error: any) {
    console.error('Error updating dispatch record:', error)
    return res.status(500).json({ error: error.message || 'Failed to update dispatch record' })
  }
}

// Legacy endpoints for backward compatibility
export const updateDispatchStatus = async (_req: Request, res: Response) => {
  return res.status(400).json({
    error: 'This endpoint is deprecated. Use specific workflow endpoints instead.'
  })
}

export const depart = async (_req: Request, res: Response) => {
  return res.status(400).json({
    error: 'This endpoint is deprecated. Use /depart endpoint instead.'
  })
}
