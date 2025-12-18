/**
 * Dispatch Mappers
 * Transform database records to API format
 */

import type { DispatchDBRecord, DispatchRecord } from './dispatch-types.js'

/**
 * Map database record to API response format
 */
export function mapDispatchToAPI(record: DispatchDBRecord): DispatchRecord {
  return {
    id: record.id,
    vehicleId: record.vehicle_id,
    vehicle: {
      id: record.vehicle_id,
      plateNumber: record.vehicle_plate_number || '',
      operatorId: record.vehicle_operator_id || null,
      operator: record.vehicle_operator_name ? {
        id: record.vehicle_operator_id!,
        name: record.vehicle_operator_name,
        code: record.vehicle_operator_code || '',
      } : undefined,
    },
    vehiclePlateNumber: record.vehicle_plate_number || '',
    driverId: record.driver_id,
    driverName: record.driver_full_name || '',
    scheduleId: record.schedule_id,
    routeId: record.route_id,
    route: record.route_name ? {
      id: record.route_id!,
      routeName: record.route_name,
      routeType: record.route_type,
      destination: record.route_destination_name ? {
        id: record.route_destination_id!,
        name: record.route_destination_name,
        code: record.route_destination_code || '',
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
    permitStatus: record.permit_status as 'approved' | 'rejected' | null,
    rejectionReason: record.rejection_reason,
    boardingPermitBy: record.boarding_permit_by_name || record.boarding_permit_by,
    paymentTime: record.payment_time,
    paymentAmount: record.payment_amount ? parseFloat(String(record.payment_amount)) : null,
    paymentMethod: record.payment_method as 'cash' | 'transfer' | 'card' | null,
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
  }
}

/**
 * Map array of database records to API format
 */
export function mapDispatchListToAPI(records: DispatchDBRecord[]): DispatchRecord[] {
  return records.map(mapDispatchToAPI)
}
