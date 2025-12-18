import { firebaseClient } from '@/lib/firebase'
import type { Operator, OperatorInput } from '@/types'

interface FirebaseOperator {
  id: string
  name: string
  code: string
  tax_code: string
  phone: string
  email: string
  address: string
  province: string
  district: string
  representative_name: string
  representative_position: string
  is_ticket_delegated: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

const mapOperator = (o: FirebaseOperator): Operator => ({
  id: o.id,
  name: o.name,
  code: o.code,
  taxCode: o.tax_code,
  phone: o.phone,
  email: o.email,
  address: o.address,
  province: o.province,
  district: o.district,
  representativeName: o.representative_name,
  representativePosition: o.representative_position,
  isTicketDelegated: o.is_ticket_delegated,
  isActive: o.is_active,
  createdAt: o.created_at,
})

export const operatorService = {
  getAll: async (isActive?: boolean): Promise<Operator[]> => {
    const data = await firebaseClient.getAsArray<FirebaseOperator>('operators')
    
    let filtered = data
    if (isActive !== undefined) {
      filtered = filtered.filter(o => o.is_active === isActive)
    }

    return filtered.map(mapOperator).sort((a, b) => a.name.localeCompare(b.name))
  },

  getById: async (id: string): Promise<Operator> => {
    const data = await firebaseClient.get<FirebaseOperator>(`operators/${id}`)
    if (!data) throw new Error('Operator not found')
    return mapOperator({ ...data, id })
  },

  create: async (input: OperatorInput): Promise<Operator> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    const data: FirebaseOperator = {
      id,
      name: input.name,
      code: input.code,
      tax_code: input.taxCode || '',
      phone: input.phone || '',
      email: input.email || '',
      address: input.address || '',
      province: input.province || '',
      district: input.district || '',
      representative_name: input.representativeName || '',
      representative_position: input.representativePosition || '',
      is_ticket_delegated: input.isTicketDelegated || false,
      is_active: true,
      created_at: now,
      updated_at: now,
    }
    
    await firebaseClient.set(`operators/${id}`, data)
    return mapOperator(data)
  },

  update: async (id: string, input: Partial<OperatorInput>): Promise<Operator> => {
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (input.name !== undefined) updateData.name = input.name
    if (input.code !== undefined) updateData.code = input.code
    if (input.taxCode !== undefined) updateData.tax_code = input.taxCode
    if (input.phone !== undefined) updateData.phone = input.phone
    if (input.email !== undefined) updateData.email = input.email
    if (input.address !== undefined) updateData.address = input.address
    if (input.province !== undefined) updateData.province = input.province
    if (input.district !== undefined) updateData.district = input.district
    if (input.representativeName !== undefined) updateData.representative_name = input.representativeName
    if (input.representativePosition !== undefined) updateData.representative_position = input.representativePosition
    if (input.isTicketDelegated !== undefined) updateData.is_ticket_delegated = input.isTicketDelegated

    await firebaseClient.update(`operators/${id}`, updateData)
    return operatorService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`operators/${id}`)
  },
}
