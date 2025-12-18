import { firebaseClient } from '@/lib/firebase'
import type { Driver, DriverInput } from '@/types'

interface FirebaseDriver {
  id: string
  operator_id: string
  full_name: string
  id_number: string
  phone: string
  email: string
  province: string
  district: string
  address: string
  license_number: string
  license_class: string
  license_issue_date: string
  license_expiry_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const driverService = {
  getAll: async (operatorId?: string, isActive?: boolean): Promise<Driver[]> => {
    const data = await firebaseClient.getAsArray<FirebaseDriver>('drivers')
    const operators = await firebaseClient.get<Record<string, any>>('operators') || {}
    
    let filtered = data
    if (operatorId) {
      filtered = filtered.filter(d => d.operator_id === operatorId)
    }
    if (isActive !== undefined) {
      filtered = filtered.filter(d => d.is_active === isActive)
    }

    return filtered.map(d => {
      const operator = operators[d.operator_id]
      return {
        id: d.id,
        operatorId: d.operator_id,
        operatorIds: [d.operator_id],
        operator: operator ? {
          id: d.operator_id,
          name: operator.name,
          code: operator.code,
          isTicketDelegated: operator.is_ticket_delegated,
          isActive: operator.is_active,
        } : undefined,
        operators: operator ? [{
          id: d.operator_id,
          name: operator.name,
          code: operator.code,
          isTicketDelegated: operator.is_ticket_delegated,
          isActive: operator.is_active,
          isPrimary: true,
        }] : undefined,
        fullName: d.full_name,
        idNumber: d.id_number,
        phone: d.phone,
        province: d.province,
        district: d.district,
        address: d.address,
        licenseNumber: d.license_number,
        licenseClass: d.license_class,
        licenseExpiryDate: d.license_expiry_date,
        isActive: d.is_active,
        createdAt: d.created_at,
      }
    }).sort((a, b) => a.fullName.localeCompare(b.fullName))
  },

  getById: async (id: string): Promise<Driver> => {
    const data = await firebaseClient.get<FirebaseDriver>(`drivers/${id}`)
    if (!data) throw new Error('Driver not found')
    
    const operators = await firebaseClient.get<Record<string, any>>('operators') || {}
    const operator = operators[data.operator_id]
    
    return {
      id,
      operatorId: data.operator_id,
      operatorIds: [data.operator_id],
      operator: operator ? {
        id: data.operator_id,
        name: operator.name,
        code: operator.code,
        isTicketDelegated: operator.is_ticket_delegated,
        isActive: operator.is_active,
      } : undefined,
      operators: operator ? [{
        id: data.operator_id,
        name: operator.name,
        code: operator.code,
        isTicketDelegated: operator.is_ticket_delegated,
        isActive: operator.is_active,
        isPrimary: true,
      }] : undefined,
      fullName: data.full_name,
      idNumber: data.id_number,
      phone: data.phone,
      province: data.province,
      district: data.district,
      address: data.address,
      licenseNumber: data.license_number,
      licenseClass: data.license_class,
      licenseExpiryDate: data.license_expiry_date,
      isActive: data.is_active,
      createdAt: data.created_at,
    }
  },

  create: async (input: DriverInput): Promise<Driver> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    const data: FirebaseDriver = {
      id,
      operator_id: input.operatorIds[0] || '',
      full_name: input.fullName,
      id_number: input.idNumber || '',
      phone: input.phone || '',
      email: '',
      province: input.province || '',
      district: input.district || '',
      address: input.address || '',
      license_number: input.licenseNumber || '',
      license_class: input.licenseClass || '',
      license_issue_date: '',
      license_expiry_date: input.licenseExpiryDate || '',
      is_active: true,
      created_at: now,
      updated_at: now,
    }
    
    await firebaseClient.set(`drivers/${id}`, data)
    return driverService.getById(id)
  },

  update: async (id: string, input: Partial<DriverInput>): Promise<Driver> => {
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (input.operatorIds !== undefined && input.operatorIds.length > 0) {
      updateData.operator_id = input.operatorIds[0]
    }
    if (input.fullName !== undefined) updateData.full_name = input.fullName
    if (input.idNumber !== undefined) updateData.id_number = input.idNumber
    if (input.phone !== undefined) updateData.phone = input.phone
    if (input.province !== undefined) updateData.province = input.province
    if (input.district !== undefined) updateData.district = input.district
    if (input.address !== undefined) updateData.address = input.address
    if (input.licenseNumber !== undefined) updateData.license_number = input.licenseNumber
    if (input.licenseClass !== undefined) updateData.license_class = input.licenseClass
    if (input.licenseExpiryDate !== undefined) updateData.license_expiry_date = input.licenseExpiryDate

    await firebaseClient.update(`drivers/${id}`, updateData)
    return driverService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`drivers/${id}`)
  },
}
