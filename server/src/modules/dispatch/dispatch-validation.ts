/**
 * Dispatch Validation
 * Zod schemas and validation functions
 */

import { z } from 'zod'
import {
  DISPATCH_STATUS,
  validateStatusTransition,
  type DispatchStatusType
} from '../../shared/validation/index.js'

// Re-export status utilities for convenience
export { DISPATCH_STATUS, validateStatusTransition }
export type { DispatchStatusType }

/**
 * Schema for creating a new dispatch record
 */
export const createDispatchSchema = z.object({
  vehicleId: z.string().min(1, 'Invalid vehicle ID'),
  driverId: z.string().min(1, 'Invalid driver ID'),
  scheduleId: z.string().min(1).optional(),
  routeId: z.string().min(1, 'Invalid route ID').optional(),
  entryTime: z.string().refine(
    (val) => {
      const date = new Date(val)
      return !isNaN(date.getTime())
    },
    { message: 'Invalid entry time format' }
  ),
  notes: z.string().optional(),
  entryShiftId: z.string().min(1).optional(),
})

/**
 * Schema for passenger drop
 */
export const passengerDropSchema = z.object({
  passengersArrived: z.number().int().min(0, 'Passengers must be non-negative').optional(),
  routeId: z.string().min(1).optional(),
})

/**
 * Schema for issuing permit
 */
export const issuePermitSchema = z.object({
  transportOrderCode: z.string().optional(),
  plannedDepartureTime: z.string().optional(),
  seatCount: z.number().int().positive().optional(),
  permitStatus: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
  routeId: z.string().min(1).optional(),
  scheduleId: z.string().min(1).optional(),
  replacementVehicleId: z.string().optional(),
  permitShiftId: z.string().min(1).optional(),
})

/**
 * Schema for payment
 */
export const paymentSchema = z.object({
  paymentAmount: z.number().min(0, 'Payment amount must be >= 0'),
  paymentMethod: z.enum(['cash', 'transfer', 'card']).optional(),
  invoiceNumber: z.string().optional(),
  paymentShiftId: z.string().min(1).optional(),
})

/**
 * Schema for departure order
 */
export const departureOrderSchema = z.object({
  passengersDeparting: z.number().int().min(0).optional(),
  departureOrderShiftId: z.string().min(1).optional(),
})

/**
 * Schema for exit
 */
export const exitSchema = z.object({
  exitTime: z.string().optional(),
  passengersDeparting: z.number().int().min(0).optional(),
  exitShiftId: z.string().min(1).optional(),
})

/**
 * Type exports from schemas
 */
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>
export type PassengerDropInput = z.infer<typeof passengerDropSchema>
export type IssuePermitInput = z.infer<typeof issuePermitSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type DepartureOrderInput = z.infer<typeof departureOrderSchema>
export type ExitInput = z.infer<typeof exitSchema>

/**
 * Validation functions
 */
export function validateCreateDispatch(data: unknown): CreateDispatchInput {
  return createDispatchSchema.parse(data)
}

export function validatePassengerDrop(data: unknown): PassengerDropInput {
  return passengerDropSchema.parse(data)
}

export function validateIssuePermit(data: unknown): IssuePermitInput {
  const result = issuePermitSchema.parse(data)
  // Additional validation: transport order code required for approval
  if (result.permitStatus === 'approved' && !result.transportOrderCode) {
    throw new z.ZodError([{
      code: 'custom',
      message: 'Transport order code is required for approval',
      path: ['transportOrderCode'],
    }])
  }
  return result
}

export function validatePayment(data: unknown): PaymentInput {
  return paymentSchema.parse(data)
}

export function validateDepartureOrder(data: unknown): DepartureOrderInput {
  return departureOrderSchema.parse(data)
}

export function validateExit(data: unknown): ExitInput {
  return exitSchema.parse(data)
}
