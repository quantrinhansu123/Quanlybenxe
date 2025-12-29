/**
 * Dispatch Controller
 * Thin controller that delegates to repository and helpers
 *
 * Target: < 200 lines (from 585 lines original)
 */

import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth.js'
import { getCurrentVietnamTime, convertVietnamISOToUTCForStorage } from '../../../utils/timezone.js'
import { getErrorMessage, isValidationError } from '../../../types/common.js'
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
  } catch (error: unknown) {
    console.error('Error creating dispatch record:', error)
    if (isValidationError(error)) {
      return res.status(400).json({ error: getErrorMessage(error) })
    }
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to create dispatch record') })
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

    const updateData: Record<string, unknown> = {
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
  } catch (error: unknown) {
    console.error('Error recording passenger drop:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to record passenger drop') })
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

    const updateData: Record<string, unknown> = {
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
  } catch (error: unknown) {
    console.error('Error issuing permit:', error)
    if (isValidationError(error)) return res.status(400).json({ error: getErrorMessage(error) })
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to issue permit') })
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
  } catch (error: unknown) {
    console.error('Error processing payment:', error)
    if (isValidationError(error)) return res.status(400).json({ error: getErrorMessage(error) })
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to process payment') })
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
  } catch (error: unknown) {
    console.error('Error issuing departure order:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to issue departure order') })
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

    const updateData: Record<string, unknown> = {
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
  } catch (error: unknown) {
    console.error('Error recording exit:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to record exit') })
  }
}

/**
 * Update entry image URL (set or remove)
 */
export const updateEntryImage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { entryImageUrl } = req.body

    // Allow null to remove image, or string to set image
    if (entryImageUrl !== null && typeof entryImageUrl !== 'string') {
      return res.status(400).json({ error: 'entryImageUrl must be a string or null' })
    }

    const record = await dispatchRepository.update(id, {
      entry_image_url: entryImageUrl,
    })

    if (!record) return res.status(404).json({ error: 'Dispatch record not found' })

    const message = entryImageUrl ? 'Entry image updated' : 'Entry image removed'
    return res.json({ message, dispatch: mapDispatchToAPI(record) })
  } catch (error: unknown) {
    console.error('Error updating entry image:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to update entry image') })
  }
}

/**
 * Delete dispatch record (only for records that haven't departed)
 */
export const deleteDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    
    const existingRecord = await dispatchRepository.findById(id)
    if (!existingRecord) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Only allow deletion of records that haven't departed yet
    if (existingRecord.current_status === 'departed') {
      return res.status(400).json({ error: 'Không thể xóa record đã xuất bến. Hãy sử dụng chức năng Hủy bỏ.' })
    }

    await dispatchRepository.delete(id)
    return res.json({ message: 'Dispatch record deleted successfully' })
  } catch (error: unknown) {
    console.error('Error deleting dispatch record:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to delete dispatch record') })
  }
}

/**
 * Cancel dispatch record (soft delete - mark as cancelled)
 * Used for records that have already departed but need to be voided
 */
export const cancelDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const userId = req.user?.id

    const existingRecord = await dispatchRepository.findById(id)
    if (!existingRecord) {
      return res.status(404).json({ error: 'Dispatch record not found' })
    }

    // Already cancelled
    if (existingRecord.current_status === 'cancelled') {
      return res.status(400).json({ error: 'Record đã được hủy bỏ trước đó' })
    }

    const userName = await fetchUserName(userId)

    // Update status to cancelled and store cancellation info in metadata
    const updatedRecord = await dispatchRepository.update(id, {
      current_status: 'cancelled',
      metadata: {
        ...existingRecord.metadata,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancelled_by_name: userName,
        cancellation_reason: reason || 'Hủy bỏ bởi người dùng',
        previous_status: existingRecord.current_status,
      }
    })

    if (!updatedRecord) {
      return res.status(500).json({ error: 'Failed to update record' })
    }

    return res.json({ 
      message: 'Record đã được hủy bỏ thành công',
      dispatch: mapDispatchToAPI(updatedRecord)
    })
  } catch (error: unknown) {
    console.error('Error cancelling dispatch record:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to cancel dispatch record') })
  }
}

/**
 * Update dispatch record (edit entry)
 * Allows editing vehicle, driver, route, entry time for records in early stages
 */
export const updateDispatchRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { vehicleId, driverId, routeId, entryTime, notes } = req.body

    // Check if record exists
    const existingRecord = await dispatchRepository.findById(id)
    if (!existingRecord) {
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
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Update vehicle if changed
    if (vehicleId && vehicleId !== existingRecord.vehicle_id) {
      updateData.vehicle_id = vehicleId
      try {
        const denormData = await fetchDenormalizedData({ vehicleId })
        Object.assign(updateData, buildDenormalizedFields(denormData))
      } catch (denormError) {
        // Legacy vehicle (legacy_* or badge_*) - fetch may fail
        // Keep existing denormalized data, just update the vehicle_id
        console.warn(`[updateDispatchRecord] fetchDenormalizedData failed for ${vehicleId}:`, denormError)
      }
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
    const updatedRecord = await dispatchRepository.update(id, updateData)
    if (!updatedRecord) {
      return res.status(500).json({ error: 'Failed to update dispatch record' })
    }

    return res.json(mapDispatchToAPI(updatedRecord))
  } catch (error: unknown) {
    console.error('Error updating dispatch record:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to update dispatch record') })
  }
}

// Legacy endpoints
export const updateDispatchStatus = async (_req: Request, res: Response) => {
  return res.status(400).json({ error: 'This endpoint is deprecated. Use specific workflow endpoints instead.' })
}

export const depart = async (_req: Request, res: Response) => {
  return res.status(400).json({ error: 'This endpoint is deprecated. Use /depart endpoint instead.' })
}
