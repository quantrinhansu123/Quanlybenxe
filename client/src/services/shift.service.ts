import { firebaseClient } from '@/lib/firebase'
import type { Shift } from '@/types'

// Re-export Shift type for convenience
export type { Shift } from '@/types'

interface FirebaseShift {
  id: string
  name: string
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const mapShift = (s: FirebaseShift): Shift => ({
  id: s.id,
  name: s.name,
  startTime: s.start_time,
  endTime: s.end_time,
  isActive: s.is_active,
  createdAt: s.created_at,
})

// Default shifts for fallback
const DEFAULT_SHIFTS: Shift[] = [
  { id: 'shift-1', name: 'Ca 1', startTime: '06:00:00', endTime: '14:00:00', isActive: true },
  { id: 'shift-2', name: 'Ca 2', startTime: '14:00:00', endTime: '22:00:00', isActive: true },
  { id: 'shift-3', name: 'Ca 3', startTime: '22:00:00', endTime: '06:00:00', isActive: true },
  { id: 'shift-4', name: 'Hành chính', startTime: '07:30:00', endTime: '17:00:00', isActive: true },
]

export const shiftService = {
  getAll: async (): Promise<Shift[]> => {
    try {
      const data = await firebaseClient.getAsArray<FirebaseShift>('shifts')
      if (data.length === 0) {
        console.log('No shifts found in Firebase, using defaults')
        return DEFAULT_SHIFTS
      }
      return data.map(mapShift)
    } catch (error) {
      console.warn('Shifts API not available, using default shifts')
      return DEFAULT_SHIFTS
    }
  },

  getById: async (id: string): Promise<Shift> => {
    const data = await firebaseClient.get<FirebaseShift>(`shifts/${id}`)
    if (!data) {
      const defaultShift = DEFAULT_SHIFTS.find(s => s.id === id)
      if (defaultShift) return defaultShift
      throw new Error('Shift not found')
    }
    return mapShift({ ...data, id })
  },

  create: async (input: { name: string; startTime: string; endTime: string }): Promise<Shift> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()

    const data: FirebaseShift = {
      id,
      name: input.name,
      start_time: input.startTime,
      end_time: input.endTime,
      is_active: true,
      created_at: now,
      updated_at: now,
    }

    await firebaseClient.set(`shifts/${id}`, data)
    return mapShift(data)
  },

  update: async (id: string, input: Partial<{ name: string; startTime: string; endTime: string; isActive: boolean }>): Promise<Shift> => {
    const updateData: any = { updated_at: new Date().toISOString() }

    if (input.name !== undefined) updateData.name = input.name
    if (input.startTime !== undefined) updateData.start_time = input.startTime
    if (input.endTime !== undefined) updateData.end_time = input.endTime
    if (input.isActive !== undefined) updateData.is_active = input.isActive

    await firebaseClient.update(`shifts/${id}`, updateData)
    return shiftService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`shifts/${id}`)
  },
}
