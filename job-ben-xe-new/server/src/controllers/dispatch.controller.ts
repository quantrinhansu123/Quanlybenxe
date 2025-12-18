import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth.js'
import { getCurrentVietnamTime, convertVietnamISOToUTCForStorage } from '../utils/timezone.js'

const dispatchSchema = z.object({
  vehicleId: z.string().min(1, 'Invalid vehicle ID'),
  driverId: z.string().min(1, 'Invalid driver ID'),
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

    let query = supabase
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

    // Fetch related data
    const vehicleIds = [...new Set(records.map((r: any) => r.vehicle_id))]
    const driverIds = [...new Set(records.map((r: any) => r.driver_id))]
    const routeIds = [...new Set(records.map((r: any) => r.route_id).filter((id: any) => id !== null))]
    const userIds = [...new Set(records.flatMap((r: any) => [
      r.entry_by,
      r.payment_by,
      r.departure_order_by,
      r.exit_by,
      r.boarding_permit_by,
      r.passenger_drop_by,
    ]).filter((id: any) => id !== null))]

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select(`
        id, 
        plate_number,
        operator_id,
        operators:operator_id(id, name, code)
      `)
      .in('id', vehicleIds)

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, full_name')
      .in('id', driverIds)

    const { data: routes } = routeIds.length > 0 ? await supabase
      .from('routes')
      .select(`
        id, 
        route_name, 
        route_type,
        destination:destination_id(id, name, code)
      `)
      .in('id', routeIds) : { data: [] }

    const { data: users } = userIds.length > 0 ? await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIds) : { data: [] }

    const vehicleMap = new Map(vehicles?.map((v: any) => [v.id, v.plate_number]) || [])
    const vehicleDataMap = new Map(vehicles?.map((v: any) => {
      const operatorData = Array.isArray(v.operators) ? v.operators[0] : v.operators
      const operator = operatorData ? {
        id: operatorData.id,
        name: operatorData.name,
        code: operatorData.code,
      } : undefined
      return [v.id, {
        id: v.id,
        plateNumber: v.plate_number,
        operatorId: v.operator_id,
        operator: operator,
      }]
    }) || [])
    const driverMap = new Map(drivers?.map((d: any) => [d.id, d.full_name]) || [])
    const routeMap = new Map(routes?.map((r: any) => [r.id, r.route_name]) || [])
    const routeDataMap = new Map(routes?.map((r: any) => {
      const destinationData = Array.isArray(r.destination) ? r.destination[0] : r.destination
      const destination = destinationData ? {
        id: destinationData.id,
        name: destinationData.name,
        code: destinationData.code,
      } : undefined
      return [r.id, {
        id: r.id,
        routeName: r.route_name,
        routeType: r.route_type,
        destination: destination,
      }]
    }) || [])
    const userMap = new Map(users?.map((u: any) => [u.id, u.full_name]) || [])

    const result = records.map((record: any) => {
      const vehicleData = vehicleDataMap.get(record.vehicle_id)
      return {
      id: record.id,
      vehicleId: record.vehicle_id,
        vehicle: vehicleData,
      vehiclePlateNumber: vehicleMap.get(record.vehicle_id) || '',
      driverId: record.driver_id,
      driverName: driverMap.get(record.driver_id) || '',
      scheduleId: record.schedule_id,
      routeId: record.route_id,
      route: routeDataMap.get(record.route_id),
      routeName: routeMap.get(record.route_id) || '',
      entryTime: record.entry_time,
      entryBy: userMap.get(record.entry_by) || record.entry_by,
      passengerDropTime: record.passenger_drop_time,
      passengersArrived: record.passengers_arrived,
      passengerDropBy: userMap.get(record.passenger_drop_by) || record.passenger_drop_by,
      boardingPermitTime: record.boarding_permit_time,
      plannedDepartureTime: record.planned_departure_time,
      transportOrderCode: record.transport_order_code,
      seatCount: record.seat_count,
      permitStatus: record.permit_status,
      rejectionReason: record.rejection_reason,
        boardingPermitBy: userMap.get(record.boarding_permit_by) || record.boarding_permit_by,
      paymentTime: record.payment_time,
      paymentAmount: record.payment_amount ? parseFloat(record.payment_amount) : null,
      paymentMethod: record.payment_method,
      invoiceNumber: record.invoice_number,
        paymentBy: userMap.get(record.payment_by) || record.payment_by,
      departureOrderTime: record.departure_order_time,
      passengersDeparting: record.passengers_departing,
        departureOrderBy: userMap.get(record.departure_order_by) || record.departure_order_by,
      exitTime: record.exit_time,
        exitBy: userMap.get(record.exit_by) || record.exit_by,
      currentStatus: record.current_status,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      }
    })

    return res.json(result)
  } catch (error) {
    console.error('Error fetching dispatch records:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch records' })
  }
}

export const getDispatchRecordById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: record, error } = await supabase
      .from('dispatch_records')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!record) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Fetch related data with operator
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select(`
        id, 
        plate_number,
        operator_id,
        operators:operator_id(id, name, code)
      `)
      .eq('id', record.vehicle_id)
      .single()

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('id', record.driver_id)
      .single()

    // Fetch route only if route_id exists
    let route = null
    if (record.route_id) {
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, route_name, route_type')
        .eq('id', record.route_id)
        .single()
      route = routeData
    }

    // Fetch user data for all user fields
    const userIds = [
      record.entry_by,
      record.payment_by,
      record.departure_order_by,
      record.exit_by,
      record.boarding_permit_by,
      record.passenger_drop_by,
    ].filter((id: any) => id !== null)

    const { data: users } = userIds.length > 0 ? await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIds) : { data: [] }

    const userMap = new Map(users?.map((u: any) => [u.id, u.full_name]) || [])

    // Format operator data
    const operatorData = Array.isArray(vehicle?.operators) ? vehicle?.operators[0] : vehicle?.operators
    const operator = operatorData ? {
      id: operatorData.id,
      name: operatorData.name,
      code: operatorData.code,
    } : undefined

    return res.json({
      id: record.id,
      vehicleId: record.vehicle_id,
      vehicle: vehicle ? {
        id: vehicle.id,
        plateNumber: vehicle.plate_number,
        operatorId: vehicle.operator_id,
        operator: operator,
      } : undefined,
      vehiclePlateNumber: vehicle?.plate_number || '',
      driverId: record.driver_id,
      driverName: driver?.full_name || '',
      scheduleId: record.schedule_id,
      routeId: record.route_id,
      routeName: route?.route_name || '',
      entryTime: record.entry_time,
      entryBy: userMap.get(record.entry_by) || record.entry_by,
      passengerDropTime: record.passenger_drop_time,
      passengersArrived: record.passengers_arrived,
      passengerDropBy: userMap.get(record.passenger_drop_by) || record.passenger_drop_by,
      boardingPermitTime: record.boarding_permit_time,
      plannedDepartureTime: record.planned_departure_time,
      transportOrderCode: record.transport_order_code,
      seatCount: record.seat_count,
      permitStatus: record.permit_status,
      rejectionReason: record.rejection_reason,
      boardingPermitBy: userMap.get(record.boarding_permit_by) || record.boarding_permit_by,
      paymentTime: record.payment_time,
      paymentAmount: record.payment_amount ? parseFloat(record.payment_amount) : null,
      paymentMethod: record.payment_method,
      invoiceNumber: record.invoice_number,
      paymentBy: userMap.get(record.payment_by) || record.payment_by,
      departureOrderTime: record.departure_order_time,
      passengersDeparting: record.passengers_departing,
      departureOrderBy: userMap.get(record.departure_order_by) || record.departure_order_by,
      exitTime: record.exit_time,
      exitBy: userMap.get(record.exit_by) || record.exit_by,
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

    const insertData: any = {
      vehicle_id: vehicleId,
      driver_id: driverId,
      schedule_id: scheduleId || null,
      route_id: routeId || null,
      entry_time: entryTimeForDB,
      entry_by: userId || null,
      current_status: 'entered',
      notes: notes || null,
    }

    // Set entry_shift_id if provided
    if (entryShiftId) {
      insertData.entry_shift_id = entryShiftId
    }

    const { data, error } = await supabase
      .from('dispatch_records')
      .insert(insertData)
      .select('*')
      .single()

    if (error) throw error

    // Fetch related data with operator
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select(`
        id, 
        plate_number,
        operator_id,
        operators:operator_id(id, name, code)
      `)
      .eq('id', data.vehicle_id)
      .single()

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('id', data.driver_id)
      .single()

    // Fetch route only if route_id exists
    let route = null
    if (data.route_id) {
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, route_name, route_type')
        .eq('id', data.route_id)
        .single()
      route = routeData
    }

    // Format operator data
    const operatorData = Array.isArray(vehicle?.operators) ? vehicle?.operators[0] : vehicle?.operators
    const operator = operatorData ? {
      id: operatorData.id,
      name: operatorData.name,
      code: operatorData.code,
    } : undefined

    return res.status(201).json({
      id: data.id,
      vehicleId: data.vehicle_id,
      vehicle: vehicle ? {
        id: vehicle.id,
        plateNumber: vehicle.plate_number,
        operatorId: vehicle.operator_id,
        operator: operator,
      } : undefined,
      vehiclePlateNumber: vehicle?.plate_number || '',
      driverId: data.driver_id,
      driverName: driver?.full_name || '',
      scheduleId: data.schedule_id,
      routeId: data.route_id,
      route: route ? {
        id: route.id,
        routeName: route.route_name,
        routeType: route.route_type,
      } : undefined,
      routeName: route?.route_name || '',
      entryTime: data.entry_time,
      entryBy: data.entry_by,
      currentStatus: data.current_status,
      notes: data.notes,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error creating dispatch record:', error)
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

    // Build update object
    const updateData: any = {
      passenger_drop_time: getCurrentVietnamTime(),
      passengers_arrived: passengersArrived || null,
      passenger_drop_by: userId || null,
      current_status: 'passengers_dropped',
    }

    // Set routeId if provided and not already set
    if (routeId) {
      updateData.route_id = routeId
    }

    const { data, error } = await supabase
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

    if (!transportOrderCode && permitStatus !== 'rejected') {
      return res.status(400).json({ error: 'Transport order code is required for approval' })
    }

    // Get current metadata to preserve existing data
    const { data: currentRecord } = await supabase
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
      permit_status: permitStatus || 'approved',
      metadata: newMetadata,
    }

    // Set permit_shift_id if provided
    if (permitShiftId) {
      updateData.permit_shift_id = permitShiftId
    }

    // Set routeId if provided
    if (routeId) {
      updateData.route_id = routeId
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

    const { data, error } = await supabase
      .from('dispatch_records')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json({ message: 'Permit processed', dispatch: data })
  } catch (error: any) {
    console.error('Error issuing permit:', error)
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

    const updateData: any = {
      payment_time: getCurrentVietnamTime(),
      payment_amount: paymentAmount,
      payment_method: paymentMethod || 'cash',
      invoice_number: invoiceNumber || null,
      payment_by: userId || null,
      current_status: 'paid',
    }

    // Set payment_shift_id if provided
    if (paymentShiftId) {
      updateData.payment_shift_id = paymentShiftId
    }

    const { data, error } = await supabase
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

    const updateData: any = {
      departure_order_time: getCurrentVietnamTime(),
      passengers_departing: passengersDeparting || null,
      departure_order_by: userId || null,
      current_status: 'departure_ordered',
    }

    // Set departure_order_shift_id if provided
    if (departureOrderShiftId) {
      updateData.departure_order_shift_id = departureOrderShiftId
    }

    const { data, error } = await supabase
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

    const updateData: any = {
      exit_time: exitTime ? convertVietnamISOToUTCForStorage(exitTime) : getCurrentVietnamTime(),
      exit_by: userId || null,
      current_status: 'departed',
    }

    if (passengersDeparting !== undefined) {
      updateData.passengers_departing = passengersDeparting
    }

    // Set exit_shift_id if provided
    if (exitShiftId) {
      updateData.exit_shift_id = exitShiftId
    }

    const { data, error } = await supabase
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
