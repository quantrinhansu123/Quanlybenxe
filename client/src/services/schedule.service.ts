import api from '@/lib/api'
import type { Schedule, ScheduleInput } from '@/types'

export const scheduleService = {
  getAll: async (routeId?: string, operatorId?: string, isActive?: boolean): Promise<Schedule[]> => {
    try {
      const params = new URLSearchParams()
      if (routeId) params.append('routeId', routeId)
      if (operatorId) params.append('operatorId', operatorId)
      if (isActive !== undefined) params.append('isActive', String(isActive))

      const queryString = params.toString()
      const url = queryString ? `/schedules?${queryString}` : '/schedules'

      const response = await api.get<Schedule[]>(url)
      return response.data
    } catch (error) {
      console.error('Error fetching schedules:', error)
      return []
    }
  },

  getById: async (id: string): Promise<Schedule> => {
    const response = await api.get<Schedule>(`/schedules/${id}`)
    return response.data
  },

  create: async (input: ScheduleInput): Promise<Schedule> => {
    const response = await api.post<Schedule>('/schedules', input)
    return response.data
  },

  update: async (id: string, input: Partial<ScheduleInput>): Promise<Schedule> => {
    const response = await api.put<Schedule>(`/schedules/${id}`, input)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/schedules/${id}`)
  },
}
