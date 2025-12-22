/**
 * Dispatch Module Types
 */

export interface DispatchRecord {
  id: string
  vehicleId: string
  vehiclePlateNumber: string
  vehicle?: {
    id: string
    plateNumber: string
    operatorId?: string | null
    operator?: {
      id: string
      name: string
      code: string
    }
  }
  driverId: string
  driverName: string
  scheduleId?: string | null
  routeId?: string | null
  routeName?: string
  route?: {
    id: string
    routeName: string
    routeType?: string | null
    destination?: {
      id: string
      name: string
      code: string
    }
  }
  entryTime: string
  entryBy?: string | null
  entryImageUrl?: string | null
  passengerDropTime?: string | null
  passengersArrived?: number | null
  passengerDropBy?: string | null
  boardingPermitTime?: string | null
  plannedDepartureTime?: string | null
  transportOrderCode?: string | null
  seatCount?: number | null
  permitStatus?: 'approved' | 'rejected' | null
  rejectionReason?: string | null
  boardingPermitBy?: string | null
  paymentTime?: string | null
  paymentAmount?: number | null
  paymentMethod?: 'cash' | 'transfer' | 'card' | null
  invoiceNumber?: string | null
  paymentBy?: string | null
  departureOrderTime?: string | null
  passengersDeparting?: number | null
  departureOrderBy?: string | null
  exitTime?: string | null
  exitBy?: string | null
  currentStatus: string
  notes?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface DispatchDBRecord {
  id: string
  vehicle_id: string
  vehicle_plate_number?: string | null
  vehicle_operator_id?: string | null
  vehicle_operator_name?: string | null
  vehicle_operator_code?: string | null
  driver_id: string
  driver_full_name?: string | null
  schedule_id?: string | null
  route_id?: string | null
  route_name?: string | null
  route_type?: string | null
  route_destination_id?: string | null
  route_destination_name?: string | null
  route_destination_code?: string | null
  entry_time: string
  entry_by?: string | null
  entry_by_name?: string | null
  entry_image_url?: string | null
  passenger_drop_time?: string | null
  passengers_arrived?: number | null
  passenger_drop_by?: string | null
  passenger_drop_by_name?: string | null
  boarding_permit_time?: string | null
  planned_departure_time?: string | null
  transport_order_code?: string | null
  seat_count?: number | null
  permit_status?: string | null
  rejection_reason?: string | null
  boarding_permit_by?: string | null
  boarding_permit_by_name?: string | null
  payment_time?: string | null
  payment_amount?: string | number | null
  payment_method?: string | null
  invoice_number?: string | null
  payment_by?: string | null
  payment_by_name?: string | null
  departure_order_time?: string | null
  passengers_departing?: number | null
  departure_order_by?: string | null
  departure_order_by_name?: string | null
  exit_time?: string | null
  exit_by?: string | null
  exit_by_name?: string | null
  current_status: string
  notes?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  // Shift IDs
  entry_shift_id?: string | null
  permit_shift_id?: string | null
  payment_shift_id?: string | null
  departure_order_shift_id?: string | null
  exit_shift_id?: string | null
}

export interface DispatchFilters {
  status?: string
  vehicleId?: string
  driverId?: string
  routeId?: string
}

// Note: Input types are defined in dispatch-validation.ts via Zod schemas
// Use those types instead: CreateDispatchInput, PassengerDropInput, IssuePermitInput,
// PaymentInput, DepartureOrderInput, ExitInput
