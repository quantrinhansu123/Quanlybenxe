import { firebaseClient } from '@/lib/firebase'
import type { Location, LocationInput } from '@/types'

interface FirebaseLocation {
  id: string
  name: string
  code: string
  station_type: string
  province: string
  district: string
  address: string
  phone: string
  email: string
  latitude: number
  longitude: number
  is_active: boolean
  created_at: string
}

const mapLocation = (l: FirebaseLocation): Location => ({
  id: l.id,
  name: l.name,
  code: l.code,
  stationType: l.station_type,
  province: l.province,
  district: l.district,
  address: l.address,
  phone: l.phone,
  email: l.email,
  latitude: l.latitude,
  longitude: l.longitude,
  isActive: l.is_active,
  createdAt: l.created_at,
})

export const locationService = {
  getAll: async (isActive?: boolean): Promise<Location[]> => {
    const data = await firebaseClient.getAsArray<FirebaseLocation>('locations')
    
    let filtered = data
    if (isActive !== undefined) {
      filtered = filtered.filter(l => l.is_active === isActive)
    }

    return filtered.map(mapLocation).sort((a, b) => a.name.localeCompare(b.name))
  },

  getById: async (id: string): Promise<Location> => {
    const data = await firebaseClient.get<FirebaseLocation>(`locations/${id}`)
    if (!data) throw new Error('Location not found')
    return mapLocation({ id, ...data })
  },

  create: async (input: LocationInput): Promise<Location> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    const data: FirebaseLocation = {
      id,
      name: input.name,
      code: input.code,
      station_type: input.stationType || '',
      province: input.province || '',
      district: input.district || '',
      address: input.address || '',
      phone: input.phone || '',
      email: input.email || '',
      latitude: input.latitude || 0,
      longitude: input.longitude || 0,
      is_active: input.isActive !== false,
      created_at: now,
    }
    
    await firebaseClient.set(`locations/${id}`, data)
    return mapLocation(data)
  },

  update: async (id: string, input: Partial<LocationInput>): Promise<Location> => {
    const updateData: any = {}
    
    if (input.name !== undefined) updateData.name = input.name
    if (input.code !== undefined) updateData.code = input.code
    if (input.stationType !== undefined) updateData.station_type = input.stationType
    if (input.province !== undefined) updateData.province = input.province
    if (input.district !== undefined) updateData.district = input.district
    if (input.address !== undefined) updateData.address = input.address
    if (input.phone !== undefined) updateData.phone = input.phone
    if (input.email !== undefined) updateData.email = input.email
    if (input.latitude !== undefined) updateData.latitude = input.latitude
    if (input.longitude !== undefined) updateData.longitude = input.longitude
    if (input.isActive !== undefined) updateData.is_active = input.isActive

    await firebaseClient.update(`locations/${id}`, updateData)
    return locationService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`locations/${id}`)
  },
}
