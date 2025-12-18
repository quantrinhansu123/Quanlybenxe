import { firebaseClient } from '@/lib/firebase'
import type { DispatchRecord, DispatchInput, DispatchStatus } from '@/types'

interface FirebaseDispatchRecord {
  id: string
  vehicle_id: string
  driver_id: string
  schedule_id?: string
  route_id?: string
  entry_time: string
  entry_by?: string
  entry_shift_id?: string
  passenger_drop_time?: string
  passengers_arrived?: number
  passenger_drop_by?: string
  boarding_permit_time?: string
  planned_departure_time?: string
  transport_order_code?: string
  seat_count?: number
  permit_status?: string
  rejection_reason?: string
  boarding_permit_by?: string
  permit_shift_id?: string
  payment_time?: string
  payment_amount?: number
  payment_method?: string
  invoice_number?: string
  payment_by?: string
  payment_shift_id?: string
  departure_order_time?: string
  passengers_departing?: number
  departure_order_by?: string
  departure_order_shift_id?: string
  exit_time?: string
  exit_by?: string
  exit_shift_id?: string
  current_status: string
  notes?: string
  created_at: string
  updated_at: string
}

// Map Firebase data to DispatchRecord format
const mapDispatchRecord = async (record: FirebaseDispatchRecord): Promise<DispatchRecord> => {
  // Fetch related data
  const vehicles = await firebaseClient.get<Record<string, any>>('vehicles') || {}
  const drivers = await firebaseClient.get<Record<string, any>>('drivers') || {}
  const routes = await firebaseClient.get<Record<string, any>>('routes') || {}
  const operators = await firebaseClient.get<Record<string, any>>('operators') || {}

  const vehicle = vehicles[record.vehicle_id]
  const driver = drivers[record.driver_id]
  const route = record.route_id ? routes[record.route_id] : null
  const operator = vehicle ? operators[vehicle.operator_id] : null

  return {
    id: record.id,
    vehicleId: record.vehicle_id,
    vehicle: vehicle ? {
      id: record.vehicle_id,
      plateNumber: vehicle.plate_number,
      operatorId: vehicle.operator_id,
      seatCapacity: vehicle.seat_capacity || 0,
      isActive: vehicle.is_active ?? true,
      operator: operator ? {
        id: vehicle.operator_id,
        name: operator.name,
        code: operator.code,
        isTicketDelegated: operator.is_ticket_delegated,
        isActive: operator.is_active,
      } : undefined,
    } : undefined,
    vehiclePlateNumber: vehicle?.plate_number || '',
    driverId: record.driver_id,
    driver: driver ? {
      id: record.driver_id,
      fullName: driver.full_name,
      operatorId: driver.operator_id,
      idNumber: driver.id_number || '',
      licenseNumber: driver.license_number || '',
      licenseClass: driver.license_class || '',
      licenseExpiryDate: driver.license_expiry_date || '',
      isActive: driver.is_active ?? true,
    } : undefined,
    driverName: driver?.full_name || '',
    scheduleId: record.schedule_id,
    routeId: record.route_id || '',
    route: route ? {
      id: record.route_id || '',
      routeName: route.route_name,
      routeCode: route.route_code,
      originId: route.origin_id || '',
      destinationId: route.destination_id || '',
      isActive: route.is_active ?? true,
    } : undefined,
    routeName: route?.route_name || '',
    entryTime: record.entry_time,
    entryBy: record.entry_by,
    passengerDropTime: record.passenger_drop_time,
    passengersArrived: record.passengers_arrived,
    passengerDropBy: record.passenger_drop_by,
    boardingPermitTime: record.boarding_permit_time,
    plannedDepartureTime: record.planned_departure_time,
    transportOrderCode: record.transport_order_code,
    seatCount: record.seat_count,
    permitStatus: record.permit_status as any,
    rejectionReason: record.rejection_reason,
    boardingPermitBy: record.boarding_permit_by,
    paymentTime: record.payment_time,
    paymentAmount: record.payment_amount,
    paymentMethod: record.payment_method as any,
    invoiceNumber: record.invoice_number,
    paymentBy: record.payment_by,
    departureOrderTime: record.departure_order_time,
    passengersDeparting: record.passengers_departing,
    departureOrderBy: record.departure_order_by,
    exitTime: record.exit_time,
    exitBy: record.exit_by,
    currentStatus: record.current_status as DispatchStatus,
    notes: record.notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export const dispatchService = {
  getAll: async (status?: DispatchStatus, vehicleId?: string, driverId?: string, routeId?: string): Promise<DispatchRecord[]> => {
    try {
      const data = await firebaseClient.getAsArray<FirebaseDispatchRecord>('dispatch_records')

      let filtered = data
      if (status) {
        filtered = filtered.filter(r => r.current_status === status)
      }
      if (vehicleId) {
        filtered = filtered.filter(r => r.vehicle_id === vehicleId)
      }
      if (driverId) {
        filtered = filtered.filter(r => r.driver_id === driverId)
      }
      if (routeId) {
        filtered = filtered.filter(r => r.route_id === routeId)
      }

      // Sort by entry_time descending
      filtered.sort((a, b) =>
        new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
      )

      // Map all records
      return Promise.all(filtered.map(mapDispatchRecord))
    } catch (error) {
      console.error('Error fetching dispatch records from Firebase:', error)
      return []
    }
  },

  getById: async (id: string): Promise<DispatchRecord> => {
    try {
      const data = await firebaseClient.get<FirebaseDispatchRecord>(`dispatch_records/${id}`)
      if (!data) throw new Error('Dispatch record not found')
      return mapDispatchRecord({ ...data, id })
    } catch (error) {
      console.error('Error fetching dispatch record by id from Firebase:', error)
      throw error
    }
  },

  create: async (input: DispatchInput): Promise<DispatchRecord> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()

    const data: FirebaseDispatchRecord = {
      id,
      vehicle_id: input.vehicleId,
      driver_id: input.driverId,
      schedule_id: input.scheduleId,
      route_id: input.routeId || '',
      entry_time: input.entryTime,
      entry_by: '',
      entry_shift_id: input.entryShiftId,
      current_status: 'entered',
      notes: input.notes,
      created_at: now,
      updated_at: now,
    }

    await firebaseClient.set(`dispatch_records/${id}`, data)
    return mapDispatchRecord(data)
  },

  // New workflow methods
  recordPassengerDrop: async (id: string, passengersArrived: number, routeId?: string): Promise<DispatchRecord> => {
    const updateData: any = {
      passenger_drop_time: new Date().toISOString(),
      passengers_arrived: passengersArrived,
      passenger_drop_by: '',
      updated_at: new Date().toISOString(),
    }

    if (routeId) {
      updateData.route_id = routeId
    }

    if (passengersArrived > 0) {
      updateData.current_status = 'passengers_dropped'
    }

    await firebaseClient.update(`dispatch_records/${id}`, updateData)
    return dispatchService.getById(id)
  },

  issuePermit: async (
    id: string,
    data: {
      transportOrderCode?: string
      plannedDepartureTime: string
      seatCount: number
      permitStatus?: 'approved' | 'rejected'
      rejectionReason?: string
      routeId?: string
      scheduleId?: string
      replacementVehicleId?: string
      permitShiftId?: string
    }
  ): Promise<DispatchRecord> => {
    const updateData: any = {
      boarding_permit_time: new Date().toISOString(),
      planned_departure_time: data.plannedDepartureTime,
      transport_order_code: data.transportOrderCode,
      seat_count: data.seatCount,
      permit_status: data.permitStatus || 'approved',
      boarding_permit_by: '',
      permit_shift_id: data.permitShiftId,
      updated_at: new Date().toISOString(),
    }

    if (data.rejectionReason) {
      updateData.rejection_reason = data.rejectionReason
    }
    if (data.routeId) {
      updateData.route_id = data.routeId
    }
    if (data.scheduleId) {
      updateData.schedule_id = data.scheduleId
    }
    if (data.replacementVehicleId) {
      updateData.replacement_vehicle_id = data.replacementVehicleId
    }

    if (data.permitStatus === 'approved') {
      updateData.current_status = 'permit_issued'
    } else {
      updateData.current_status = 'permit_rejected'
    }

    await firebaseClient.update(`dispatch_records/${id}`, updateData)
    return dispatchService.getById(id)
  },

  processPayment: async (
    id: string,
    data: {
      paymentAmount: number
      paymentMethod?: 'cash' | 'bank_transfer' | 'card'
      invoiceNumber?: string
      paymentShiftId?: string
    }
  ): Promise<DispatchRecord> => {
    const updateData: any = {
      payment_time: new Date().toISOString(),
      payment_amount: data.paymentAmount,
      payment_method: data.paymentMethod || 'cash',
      invoice_number: data.invoiceNumber,
      payment_by: '',
      payment_shift_id: data.paymentShiftId,
      current_status: 'paid',
      updated_at: new Date().toISOString(),
    }

    await firebaseClient.update(`dispatch_records/${id}`, updateData)
    return dispatchService.getById(id)
  },

  issueDepartureOrder: async (id: string, passengersDeparting: number, departureOrderShiftId?: string): Promise<DispatchRecord> => {
    const updateData: any = {
      departure_order_time: new Date().toISOString(),
      passengers_departing: passengersDeparting,
      departure_order_by: '',
      departure_order_shift_id: departureOrderShiftId,
      current_status: 'departure_ordered',
      updated_at: new Date().toISOString(),
    }

    await firebaseClient.update(`dispatch_records/${id}`, updateData)
    return dispatchService.getById(id)
  },

  recordExit: async (id: string, exitTime?: string, passengersDeparting?: number, exitShiftId?: string): Promise<DispatchRecord> => {
    const updateData: any = {
      exit_time: exitTime || new Date().toISOString(),
      exit_by: '',
      exit_shift_id: exitShiftId,
      current_status: 'departed',
      updated_at: new Date().toISOString(),
    }

    if (passengersDeparting !== undefined) {
      updateData.passengers_departing = passengersDeparting
    }

    await firebaseClient.update(`dispatch_records/${id}`, updateData)
    return dispatchService.getById(id)
  },

  // Legacy methods for backward compatibility
  updateStatus: async (
    id: string,
    status: DispatchStatus,
    data?: Partial<DispatchRecord>
  ): Promise<DispatchRecord> => {
    // Map old status to new workflow
    if (status === 'permit_issued') {
      return dispatchService.issuePermit(id, {
        transportOrderCode: data?.transportOrderCode || '',
        plannedDepartureTime: data?.plannedDepartureTime || new Date().toISOString(),
        seatCount: data?.seatCount || 0,
      })
    }
    if (status === 'paid') {
      return dispatchService.processPayment(id, {
        paymentAmount: data?.paymentAmount || 0,
      })
    }
    if (status === 'departed') {
      return dispatchService.recordExit(id)
    }
    throw new Error('Legacy updateStatus is deprecated. Use specific workflow methods.')
  },

  depart: async (id: string, _exitTime: string, passengerCount: number): Promise<DispatchRecord> => {
    // Use new workflow
    await dispatchService.issueDepartureOrder(id, passengerCount)
    return dispatchService.recordExit(id)
  },
}
