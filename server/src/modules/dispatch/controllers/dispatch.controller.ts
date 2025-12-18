/**
 * Dispatch Controller
 * Thin controller that delegates to repository and helpers
 *
 * Target: < 200 lines (from 585 lines original)
 */

import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth.js'
import { getCurrentVietnamTime, convertVietnamISOToUTCForStorage } from '../../../utils/timezone.js'
import {
  fetchDenormalizedData,
  buildDenormalizedFields,
  fetchUserName,
  fetchRouteData,
  buildRouteDenormalizedFields
} from '../../../utils/denormalization.js'
import { dispatchRepository } from '../dispatch-repository.js'
import { mapDispatchToAPI, mapDispatchListToAPI } from '../dispatch-mappers.js'
import {
  validateCreateDispatch,
  validatePassengerDrop,
  validateIssuePermit,
  validatePayment,
  validateDepartureOrder,
  validateExit,
  DISPATCH_STATUS,
} from '../dispatch-validation.js'

/**
 * Get all dispatch records with optional filters
 */
export const getAllDispatchRecords = async (req: Request, res: Response) => {
  try {
    const { status, vehicleId, driverId, routeId } = req.query
    const records = await dispatchRepository.findAll({
      status: status as string,
      vehicleId: vehicleId as string,
      driverId: driverId as string,
      routeId: routeId as string,
    })
    return res.json(mapDispatchListToAPI(records))
  } catch (error) {
    console.error('Error fetching dispatch records:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch records' })
  }
}

/**
 * Get single dispatch record by ID
 */
export const getDispatchRecordById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const record = await dispatchRepository.findById(id)

    if (!record) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    return res.json(mapDispatchToAPI(record))
  } catch (error) {
    console.error('Error fetching dispatch record:', error)
    return res.status(500).json({ error: 'Failed to fetch dispatch record' })
  }
}

/**
 * Create new dispatch record (vehicle entry)
 */
export const createDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    const input = validateCreateDispatch(req.body)
    const userId = req.user?.id

    const entryTimeForDB = convertVietnamISOToUTCForStorage(input.entryTime)
    const denormData = await fetchDenormalizedData({
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      routeId: input.routeId,
      userId,
    })

    const insertData = {
      vehicle_id: input.vehicleId,
      driver_id: input.driverId,
      schedule_id: input.scheduleId || null,
      route_id: input.routeId || null,
      entry_time: entryTimeForDB,
      entry_by: userId || null,
      entry_shift_id: input.entryShiftId || null,
      current_status: DISPATCH_STATUS.ENTERED,
      notes: input.notes || null,
      ...buildDenormalizedFields(denormData),
      entry_by_name: denormData.user?.fullName || null,
    }

    const record = await dispatchRepository.create(insertData)
    return res.status(201).json(mapDispatchToAPI(record))
  } catch (error: any) {
    console.error('Error creating dispatch record:', error)
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create dispatch record' })
  }
}

/**
 * Record passenger drop
 */
export const recordPassengerDrop = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = validatePassengerDrop(req.body)
    const userId = req.user?.id
    const userName = await fetchUserName(userId)

    const updateData: Record<string, any> = {
      passenger_drop_time: getCurrentVietnamTime(),
      passengers_arrived: input.passengersArrived ?? null,
      passenger_drop_by: userId || null,
      passenger_drop_by_name: userName,
      current_status: DISPATCH_STATUS.PASSENGERS_DROPPED,
    }

    if (input.routeId) {
      updateData.route_id = input.routeId
      const routeData = await fetchRouteData(input.routeId)
      if (routeData) Object.assign(updateData, buildRouteDenormalizedFields(routeData))
    }

    const record = await dispatchRepository.update(id, updateData)
    if (!record) return res.status(404).json({ error: 'Dispatch record not found' })

    return res.json({ message: 'Passenger drop recorded', dispatch: record })
  } catch (error: any) {
    console.error('Error recording passenger drop:', error)
    return res.status(500).json({ error: error.message || 'Failed to record passenger drop' })
  }
}

/**
 * Issue boarding permit
 */
export const issuePermit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = validateIssuePermit(req.body)
    const userId = req.user?.id
    const userName = await fetchUserName(userId)

    const currentRecord = await dispatchRepository.findById(id)
    if (!currentRecord) return res.status(404).json({ error: 'Dispatch record not found' })

    const metadata = { ...(currentRecord.metadata || {}) }
    if (input.replacementVehicleId) metadata.replacementVehicleId = input.replacementVehicleId
    else if (input.replacementVehicleId === '') delete metadata.replacementVehicleId

    const updateData: Record<string, any> = {
      boarding_permit_time: getCurrentVietnamTime(),
      boarding_permit_by: userId || null,
      boarding_permit_by_name: userName,
      permit_status: input.permitStatus,
      metadata,
      permit_shift_id: input.permitShiftId || null,
    }

    if (input.routeId) {
      updateData.route_id = input.routeId
      const routeData = await fetchRouteData(input.routeId)
      if (routeData) Object.assign(updateData, buildRouteDenormalizedFields(routeData))
    }
    if (input.scheduleId) updateData.schedule_id = input.scheduleId

    if (input.permitStatus === 'approved') {
      updateData.transport_order_code = input.transportOrderCode
      updateData.planned_departure_time = input.plannedDepartureTime
      updateData.seat_count = input.seatCount
      updateData.current_status = DISPATCH_STATUS.PERMIT_ISSUED
      updateData.rejection_reason = input.rejectionReason || null
    } else {
      updateData.transport_order_code = input.transportOrderCode || null
      updateData.planned_departure_time = input.plannedDepartureTime || null
      updateData.seat_count = input.seatCount || null
      updateData.current_status = DISPATCH_STATUS.PERMIT_REJECTED
      updateData.rejection_reason = input.rejectionReason || null
    }

    const record = await dispatchRepository.update(id, updateData)
    return res.json({ message: 'Permit processed', dispatch: record })
  } catch (error: any) {
    console.error('Error issuing permit:', error)
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors[0].message })
    return res.status(500).json({ error: error.message || 'Failed to issue permit' })
  }
}

/**
 * Process payment
 */
export const processPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = validatePayment(req.body)
    const userId = req.user?.id
    const userName = await fetchUserName(userId)

    const updateData = {
      payment_time: getCurrentVietnamTime(),
      payment_amount: input.paymentAmount,
      payment_method: input.paymentMethod || 'cash',
      invoice_number: input.invoiceNumber || null,
      payment_by: userId || null,
      payment_by_name: userName,
      payment_shift_id: input.paymentShiftId || null,
      current_status: DISPATCH_STATUS.PAID,
    }

    const record = await dispatchRepository.update(id, updateData)
    if (!record) return res.status(404).json({ error: 'Dispatch record not found' })

    return res.json({ message: 'Payment processed', dispatch: record })
  } catch (error: any) {
    console.error('Error processing payment:', error)
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors[0].message })
    return res.status(500).json({ error: error.message || 'Failed to process payment' })
  }
}

/**
 * Issue departure order
 */
export const issueDepartureOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = validateDepartureOrder(req.body)
    const userId = req.user?.id
    const userName = await fetchUserName(userId)

    const updateData = {
      departure_order_time: getCurrentVietnamTime(),
      passengers_departing: input.passengersDeparting ?? null,
      departure_order_by: userId || null,
      departure_order_by_name: userName,
      departure_order_shift_id: input.departureOrderShiftId || null,
      current_status: DISPATCH_STATUS.DEPARTURE_ORDERED,
    }

    const record = await dispatchRepository.update(id, updateData)
    if (!record) return res.status(404).json({ error: 'Dispatch record not found' })

    return res.json({ message: 'Departure order issued', dispatch: record })
  } catch (error: any) {
    console.error('Error issuing departure order:', error)
    return res.status(500).json({ error: error.message || 'Failed to issue departure order' })
  }
}

/**
 * Record vehicle exit
 */
export const recordExit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = validateExit(req.body)
    const userId = req.user?.id
    const userName = await fetchUserName(userId)

    const updateData: Record<string, any> = {
      exit_time: input.exitTime ? convertVietnamISOToUTCForStorage(input.exitTime) : getCurrentVietnamTime(),
      exit_by: userId || null,
      exit_by_name: userName,
      exit_shift_id: input.exitShiftId || null,
      current_status: DISPATCH_STATUS.DEPARTED,
    }

    if (input.passengersDeparting !== undefined) {
      updateData.passengers_departing = input.passengersDeparting
    }

    const record = await dispatchRepository.update(id, updateData)
    if (!record) return res.status(404).json({ error: 'Dispatch record not found' })

    return res.json({ message: 'Exit recorded', dispatch: record })
  } catch (error: any) {
    console.error('Error recording exit:', error)
    return res.status(500).json({ error: error.message || 'Failed to record exit' })
  }
}

// Legacy endpoints
export const updateDispatchStatus = async (_req: Request, res: Response) => {
  return res.status(400).json({ error: 'This endpoint is deprecated. Use specific workflow endpoints instead.' })
}

export const depart = async (_req: Request, res: Response) => {
  return res.status(400).json({ error: 'This endpoint is deprecated. Use /depart endpoint instead.' })
}
