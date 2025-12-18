import { firebaseClient } from '@/lib/firebase'
import type { Vehicle, VehicleInput } from '@/types'

interface FirebaseVehicle {
  id: string
  plate_number: string
  vehicle_type_id: string
  operator_id: string
  seat_capacity: number
  bed_capacity: number
  province: string
  insurance_expiry_date: string
  inspection_expiry_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const vehicleService = {
  getAll: async (operatorId?: string, isActive?: boolean): Promise<Vehicle[]> => {
    const data = await firebaseClient.getAsArray<FirebaseVehicle>('vehicles')
    
    let filtered = data
    if (operatorId) {
      filtered = filtered.filter(v => v.operator_id === operatorId)
    }
    if (isActive !== undefined) {
      filtered = filtered.filter(v => v.is_active === isActive)
    }

    // Get operators and vehicle types for mapping
    const operators = await firebaseClient.get<Record<string, any>>('operators') || {}
    const vehicleTypes = await firebaseClient.get<Record<string, any>>('vehicle_types') || {}

    return filtered.map(v => ({
      id: v.id,
      plateNumber: v.plate_number,
      vehicleTypeId: v.vehicle_type_id,
      vehicleType: vehicleTypes[v.vehicle_type_id] ? {
        id: v.vehicle_type_id,
        name: vehicleTypes[v.vehicle_type_id].name,
        description: vehicleTypes[v.vehicle_type_id].description,
      } : undefined,
      operatorId: v.operator_id,
      operator: operators[v.operator_id] ? {
        id: v.operator_id,
        name: operators[v.operator_id].name,
        code: operators[v.operator_id].code,
        isTicketDelegated: operators[v.operator_id].is_ticket_delegated,
        isActive: operators[v.operator_id].is_active,
      } : undefined,
      seatCapacity: v.seat_capacity,
      bedCapacity: v.bed_capacity,
      province: v.province,
      insuranceExpiryDate: v.insurance_expiry_date,
      inspectionExpiryDate: v.inspection_expiry_date,
      isActive: v.is_active,
      createdAt: v.created_at,
    }))
  },

  getById: async (id: string): Promise<Vehicle> => {
    const data = await firebaseClient.get<FirebaseVehicle>(`vehicles/${id}`)
    if (!data) throw new Error('Vehicle not found')
    
    const operators = await firebaseClient.get<Record<string, any>>('operators') || {}
    const vehicleTypes = await firebaseClient.get<Record<string, any>>('vehicle_types') || {}
    
    return {
      id,
      plateNumber: data.plate_number,
      vehicleTypeId: data.vehicle_type_id,
      vehicleType: vehicleTypes[data.vehicle_type_id] ? {
        id: data.vehicle_type_id,
        name: vehicleTypes[data.vehicle_type_id].name,
        description: vehicleTypes[data.vehicle_type_id].description,
      } : undefined,
      operatorId: data.operator_id,
      operator: operators[data.operator_id] ? {
        id: data.operator_id,
        name: operators[data.operator_id].name,
        code: operators[data.operator_id].code,
        isTicketDelegated: operators[data.operator_id].is_ticket_delegated,
        isActive: operators[data.operator_id].is_active,
      } : undefined,
      seatCapacity: data.seat_capacity,
      bedCapacity: data.bed_capacity,
      province: data.province,
      insuranceExpiryDate: data.insurance_expiry_date,
      inspectionExpiryDate: data.inspection_expiry_date,
      isActive: data.is_active,
      createdAt: data.created_at,
    }
  },

  create: async (input: VehicleInput): Promise<Vehicle> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    const data: FirebaseVehicle = {
      id,
      plate_number: input.plateNumber,
      vehicle_type_id: input.vehicleTypeId || '',
      operator_id: input.operatorId,
      seat_capacity: input.seatCapacity || 0,
      bed_capacity: input.bedCapacity || 0,
      province: input.province || '',
      insurance_expiry_date: input.insuranceExpiryDate || '',
      inspection_expiry_date: input.inspectionExpiryDate || '',
      is_active: true,
      created_at: now,
      updated_at: now,
    }
    
    await firebaseClient.set(`vehicles/${id}`, data)
    return vehicleService.getById(id)
  },

  update: async (id: string, input: Partial<VehicleInput>): Promise<Vehicle> => {
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (input.plateNumber !== undefined) updateData.plate_number = input.plateNumber
    if (input.vehicleTypeId !== undefined) updateData.vehicle_type_id = input.vehicleTypeId
    if (input.operatorId !== undefined) updateData.operator_id = input.operatorId
    if (input.seatCapacity !== undefined) updateData.seat_capacity = input.seatCapacity
    if (input.bedCapacity !== undefined) updateData.bed_capacity = input.bedCapacity
    if (input.province !== undefined) updateData.province = input.province
    if (input.insuranceExpiryDate !== undefined) updateData.insurance_expiry_date = input.insuranceExpiryDate
    if (input.inspectionExpiryDate !== undefined) updateData.inspection_expiry_date = input.inspectionExpiryDate

    await firebaseClient.update(`vehicles/${id}`, updateData)
    return vehicleService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`vehicles/${id}`)
  },

  getDocumentAuditLogs: async (vehicleId: string): Promise<any[]> => {
    const logs = await firebaseClient.getAsArray<any>('vehicle_document_audit_logs')
    return logs.filter(log => log.vehicle_id === vehicleId)
  },
}
