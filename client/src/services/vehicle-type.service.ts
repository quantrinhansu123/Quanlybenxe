import { firebaseClient } from '@/lib/firebase'
import type { VehicleType } from '@/types'

interface FirebaseVehicleType {
  id: string
  name: string
  description: string
  created_at: string
}

const mapVehicleType = (v: FirebaseVehicleType): VehicleType => ({
  id: v.id,
  name: v.name,
  description: v.description,
  createdAt: v.created_at,
})

export const vehicleTypeService = {
  getAll: async (): Promise<VehicleType[]> => {
    const data = await firebaseClient.getAsArray<FirebaseVehicleType>('vehicle_types')
    return data.map(mapVehicleType).sort((a, b) => a.name.localeCompare(b.name))
  },

  getById: async (id: string): Promise<VehicleType> => {
    const data = await firebaseClient.get<FirebaseVehicleType>(`vehicle_types/${id}`)
    if (!data) throw new Error('Vehicle type not found')
    return mapVehicleType({ ...data, id })
  },

  create: async (input: { name: string; description?: string }): Promise<VehicleType> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()

    const data: FirebaseVehicleType = {
      id,
      name: input.name,
      description: input.description || '',
      created_at: now,
    }

    await firebaseClient.set(`vehicle_types/${id}`, data)
    return mapVehicleType(data)
  },

  update: async (id: string, input: { name?: string; description?: string }): Promise<VehicleType> => {
    const updateData: any = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description

    await firebaseClient.update(`vehicle_types/${id}`, updateData)
    return vehicleTypeService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`vehicle_types/${id}`)
  },
}
