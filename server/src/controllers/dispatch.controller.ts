import { Request, Response } from 'express'
import { firebase } from '../config/database.js'
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
    const { status, vehicleId, driverId, routeId } = req.query

    let query = firebase
      .from('dispatch_records')
      .select('*')
      .order('entry_time', { ascending: false })

    if (status) {
      query = query.eq('current_status', status as string)
    }
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId as string)
    }
    if (driverId) {
      query = query.eq('driver_id', driverId as string)
    }
    if (routeId) {
      query = query.eq('route_id', routeId as string)
    }

    const { data: records, error } = await query

    if (error) throw error

    // OPTIMIZED: Use denormalized data - no additional queries needed!
    // All related entity names are embedded in the dispatch_records
    const result = records.map((record: any) => ({
      id: record.id,
      vehicleId: record.vehicle_id,
      vehicle: {
        id: record.vehicle_id,
        plateNumber: record.vehicle_plate_number || '',
        operatorId: record.vehicle_operator_id || null,
        operator: record.vehicle_operator_name ? {
          id: record.vehicle_operator_id,
          name: record.vehicle_operator_name,
          code: record.vehicle_operator_code,
        } : undefined,
      },
      vehiclePlateNumber: record.vehicle_plate_number || '',
      driverId: record.driver_id,
      driverName: record.driver_full_name || '',
      scheduleId: record.schedule_id,
      routeId: record.route_id,
      route: record.route_name ? {
        id: record.route_id,
        routeName: record.route_name,
        routeType: record.route_type,
        destination: record.route_destination_name ? {
          id: record.route_destination_id,
          name: record.route_destination_name,
          code: record.route_destination_code,
        } : undefined,
      } : undefined,
      routeName: record.route_name || '',
      entryTime: record.entry_time,
      entryBy: record.entry_by_name || record.entry_by,
      passengerDropTime: record.passenger_drop_time,
      passengersArrived: record.passengers_arrived,
      passengerDropBy: record.passenger_drop_by_name || record.passenger_drop_by,
      boardingPermitTime: record.boarding_permit_time,
      plannedDepartureTime: record.planned_departure_time,
      transportOrderCode: record.transport_order_code,
      seatCount: record.seat_count,
      permitStatus: record.permit_status,
      rejectionReason: record.rejection_reason,
      boardingPermitBy: record.boarding_permit_by_name || record.boarding_permit_by,
      paymentTime: record.payment_time,
      paymentAmount: record.payment_amount ? parseFloat(record.payment_amount) : null,
      paymentMethod: record.payment_method,
      invoiceNumber: record.invoice_number,
      paymentBy: record.payment_by_name || record.payment_by,
      departureOrderTime: record.departure_order_time,
      passengersDeparting: record.passengers_departing,
      departureOrderBy: record.departure_order_by_name || record.departure_order_by,
      exitTime: record.exit_time,
      exitBy: record.exit_by_name || record.exit_by,
      currentStatus: record.current_status,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }))

    return res.json(result)
  } catch (error) {
    console.error('Error fetching dispatch records:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch records' })
  }
}

export const getDispatchRecordById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: record, error } = await firebase
      .from('dispatch_records')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!record) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // OPTIMIZED: Use denormalized data - no additional queries needed!
    return res.json({
      id: record.id,
      vehicleId: record.vehicle_id,
      vehicle: {
        id: record.vehicle_id,
        plateNumber: record.vehicle_plate_number || '',
        operatorId: record.vehicle_operator_id || null,
        operator: record.vehicle_operator_name ? {
          id: record.vehicle_operator_id,
          name: record.vehicle_operator_name,
          code: record.vehicle_operator_code,
        } : undefined,
      },
      vehiclePlateNumber: record.vehicle_plate_number || '',
      driverId: record.driver_id,
      driverName: record.driver_full_name || '',
      scheduleId: record.schedule_id,
      routeId: record.route_id,
      route: record.route_name ? {
        id: record.route_id,
        routeName: record.route_name,
        routeType: record.route_type,
        destination: record.route_destination_name ? {
          id: record.route_destination_id,
          name: record.route_destination_name,
          code: record.route_destination_code,
        } : undefined,
      } : undefined,
      routeName: record.route_name || '',
      entryTime: record.entry_time,
      entryBy: record.entry_by_name || record.entry_by,
      passengerDropTime: record.passenger_drop_time,
      passengersArrived: record.passengers_arrived,
      passengerDropBy: record.passenger_drop_by_name || record.passenger_drop_by,
      boardingPermitTime: record.boarding_permit_time,
      plannedDepartureTime: record.planned_departure_time,
      transportOrderCode: record.transport_order_code,
      seatCount: record.seat_count,
      permitStatus: record.permit_status,
      rejectionReason: record.rejection_reason,
      boardingPermitBy: record.boarding_permit_by_name || record.boarding_permit_by,
      paymentTime: record.payment_time,
      paymentAmount: record.payment_amount ? parseFloat(record.payment_amount) : null,
      paymentMethod: record.payment_method,
      invoiceNumber: record.invoice_number,
      paymentBy: record.payment_by_name || record.payment_by,
      departureOrderTime: record.departure_order_time,
      passengersDeparting: record.passengers_departing,
      departureOrderBy: record.departure_order_by_name || record.departure_order_by,
      exitTime: record.exit_time,
      exitBy: record.exit_by_name || record.exit_by,
      currentStatus: record.current_status,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    })
  } catch (error) {
    console.error('Error fetching dispatch record:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch record' })
  }
}

export const createDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
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
      vehicle_id: vehicleId,
      driver_id: driverId || null,  // Firebase RTDB doesn't accept undefined
      schedule_id: scheduleId || null,
      route_id: routeId || null,
      entry_time: entryTimeForDB,
      entry_by: userId || null,
      current_status: 'entered',
      notes: notes || null,
      // Denormalized fields
      ...denormFields,
      entry_by_name: denormData.user?.fullName || null,
    }

    // Set entry_shift_id if provided
    if (entryShiftId) {
      insertData.entry_shift_id = entryShiftId
    }

    const { data, error } = await firebase
      .from('dispatch_records')
      .insert(insertData)
      .select('*')
      .single()

    if (error) throw error

    // Response uses denormalized data - no additional queries needed!
    return res.status(201).json({
      id: data.id,
      vehicleId: data.vehicle_id,
      vehicle: {
        id: data.vehicle_id,
        plateNumber: data.vehicle_plate_number || '',
        operatorId: data.vehicle_operator_id || null,
        operator: data.vehicle_operator_name ? {
          id: data.vehicle_operator_id,
          name: data.vehicle_operator_name,
          code: data.vehicle_operator_code,
        } : undefined,
      },
      vehiclePlateNumber: data.vehicle_plate_number || '',
      driverId: data.driver_id,
      driverName: data.driver_full_name || '',
      scheduleId: data.schedule_id,
      routeId: data.route_id,
      route: data.route_name ? {
        id: data.route_id,
        routeName: data.route_name,
        routeType: data.route_type,
        destination: data.route_destination_name ? {
          id: data.route_destination_id,
          name: data.route_destination_name,
          code: data.route_destination_code,
        } : undefined,
      } : undefined,
      routeName: data.route_name || '',
      entryTime: data.entry_time,
      entryBy: data.entry_by_name || data.entry_by,
      currentStatus: data.current_status,
      notes: data.notes,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
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
    const { id } = req.params
    const { passengersArrived, routeId } = req.body
    const userId = req.user?.id

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    // Build update object with denormalized user name
    const updateData: any = {
      passenger_drop_time: getCurrentVietnamTime(),
      passengers_arrived: passengersArrived || null,
      passenger_drop_by: userId || null,
      passenger_drop_by_name: userName,
      current_status: 'passengers_dropped',
    }

    // Set routeId and fetch route denormalized data if provided
    if (routeId) {
      updateData.route_id = routeId
      const routeData = await fetchRouteData(routeId)
      if (routeData) {
        Object.assign(updateData, buildRouteDenormalizedFields(routeData))
      }
    }

    const { data, error } = await firebase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
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
    const { data: currentRecord } = await firebase
      .from('dispatch_records')
      .select('metadata')
      .eq('id', id)
      .single()

    const currentMetadata = currentRecord?.metadata || {}
    const newMetadata = { ...currentMetadata }

    // Update replacement vehicle ID in metadata if provided
    if (replacementVehicleId) {
      newMetadata.replacementVehicleId = replacementVehicleId
    } else if (replacementVehicleId === null || replacementVehicleId === '') {
      // Remove replacement vehicle ID if explicitly set to empty
      delete newMetadata.replacementVehicleId
    }

    const updateData: any = {
      boarding_permit_time: getCurrentVietnamTime(),
      boarding_permit_by: userId || null,
      boarding_permit_by_name: userName,
      permit_status: permitStatus || 'approved',
      metadata: newMetadata,
    }

    // Set permit_shift_id if provided
    if (permitShiftId) {
      updateData.permit_shift_id = permitShiftId
    }

    // Set routeId and fetch route denormalized data if provided
    if (routeId) {
      updateData.route_id = routeId
      const routeData = await fetchRouteData(routeId)
      if (routeData) {
        Object.assign(updateData, buildRouteDenormalizedFields(routeData))
      }
    }

    // Set scheduleId if provided
    if (scheduleId) {
      updateData.schedule_id = scheduleId
    }

    if (permitStatus === 'approved') {
      updateData.transport_order_code = transportOrderCode
      updateData.planned_departure_time = plannedDepartureTime
      updateData.seat_count = seatCount
      updateData.current_status = 'permit_issued'
      updateData.rejection_reason = rejectionReason || null
    } else if (permitStatus === 'rejected') {
      updateData.transport_order_code = transportOrderCode || null
      updateData.planned_departure_time = plannedDepartureTime || null
      updateData.seat_count = seatCount || null
      updateData.current_status = 'permit_rejected'
      updateData.rejection_reason = rejectionReason || null
    }

    console.log('[issuePermit] Updating record with data:', JSON.stringify(updateData, null, 2))

    const { data, error } = await firebase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    console.log('[issuePermit] Update result - data:', data ? 'found' : 'null', 'error:', error)

    if (error) throw error
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
      payment_time: getCurrentVietnamTime(),
      payment_amount: paymentAmount,
      payment_method: paymentMethod || 'cash',
      invoice_number: invoiceNumber || null,
      payment_by: userId || null,
      payment_by_name: userName,
      current_status: 'paid',
    }

    // Set payment_shift_id if provided
    if (paymentShiftId) {
      updateData.payment_shift_id = paymentShiftId
    }

    const { data, error } = await firebase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
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
    const { id } = req.params
    const { passengersDeparting, departureOrderShiftId } = req.body
    const userId = req.user?.id

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    const updateData: any = {
      departure_order_time: getCurrentVietnamTime(),
      passengers_departing: passengersDeparting || null,
      departure_order_by: userId || null,
      departure_order_by_name: userName,
      current_status: 'departure_ordered',
    }

    // Set departure_order_shift_id if provided
    if (departureOrderShiftId) {
      updateData.departure_order_shift_id = departureOrderShiftId
    }

    const { data, error } = await firebase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
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
    const { id } = req.params
    const { exitTime, passengersDeparting, exitShiftId } = req.body
    const userId = req.user?.id

    // Fetch user name for denormalization
    const userName = await fetchUserName(userId)

    const updateData: any = {
      exit_time: exitTime ? convertVietnamISOToUTCForStorage(exitTime) : getCurrentVietnamTime(),
      exit_by: userId || null,
      exit_by_name: userName,
      current_status: 'departed',
    }

    if (passengersDeparting !== undefined) {
      updateData.passengers_departing = passengersDeparting
    }

    // Set exit_shift_id if provided
    if (exitShiftId) {
      updateData.exit_shift_id = exitShiftId
    }

    const { data, error } = await firebase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
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
    const { id } = req.params

    // Check if record exists
    const { data: existingRecord, error: fetchError } = await firebase
      .from('dispatch_records')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRecord) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Only allow deletion of records that haven't departed yet
    if (existingRecord.current_status === 'departed') {
      return res.status(400).json({ error: 'Cannot delete a record that has already departed' })
    }

    // Delete the record
    const { error: deleteError } = await firebase
      .from('dispatch_records')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return res.json({ message: 'Dispatch record deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting dispatch record:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete dispatch record' })
  }
}

// Update dispatch record (for editing basic info)
export const updateDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { vehicleId, driverId, routeId, entryTime, notes } = req.body

    // Check if record exists
    const { data: existingRecord, error: fetchError } = await firebase
      .from('dispatch_records')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRecord) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Only allow editing of records in early stages
    const editableStatuses = ['entered', 'passengers_dropped']
    if (!editableStatuses.includes(existingRecord.current_status)) {
      return res.status(400).json({
        error: 'Cannot edit a record that has already been permitted or paid'
      })
    }

    // Build update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    // Update vehicle if changed
    if (vehicleId && vehicleId !== existingRecord.vehicle_id) {
      const denormalized = await fetchDenormalizedData(vehicleId)
      updateData.vehicle_id = vehicleId
      Object.assign(updateData, buildDenormalizedFields(denormalized))
    }

    // Update driver if changed
    if (driverId && driverId !== existingRecord.driver_id) {
      const driverName = await fetchUserName(driverId)
      updateData.driver_id = driverId
      updateData.driver_full_name = driverName
    }

    // Update route if changed
    if (routeId !== undefined) {
      if (routeId && routeId !== existingRecord.route_id) {
        const routeData = await fetchRouteData(routeId)
        updateData.route_id = routeId
        Object.assign(updateData, buildRouteDenormalizedFields(routeData))
      } else if (!routeId) {
        updateData.route_id = null
        updateData.route_name = null
        updateData.route_type = null
        updateData.route_destination_id = null
        updateData.route_destination_name = null
        updateData.route_destination_code = null
      }
    }

    // Update entry time if changed
    if (entryTime) {
      updateData.entry_time = convertVietnamISOToUTCForStorage(entryTime)
    }

    // Update notes if provided
    if (notes !== undefined) {
      updateData.notes = notes
    }

    // Perform update
    const { data, error } = await firebase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .single()

    if (error) throw error

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
