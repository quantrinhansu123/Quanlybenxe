import api from '@/lib/api'
import type { Route, RouteInput } from '@/types'

export const routeService = {
  // Support legacy call: getAll(operatorId?, limit?, isActive?)
  getAll: async (_operatorId?: string, _limit?: number, isActive?: boolean): Promise<Route[]> => {
    try {
      const params = new URLSearchParams()
      if (isActive !== undefined) params.append('isActive', String(isActive))

      const queryString = params.toString()
      const url = queryString ? `/routes?${queryString}` : '/routes'

      const response = await api.get<Route[]>(url)
      return response.data
    } catch (error) {
      console.error('Error fetching routes:', error)
      return []
    }
  },

  getById: async (id: string): Promise<Route> => {
    const response = await api.get<Route>(`/routes/${id}`)
    return response.data
  },

  create: async (input: RouteInput): Promise<Route> => {
    const response = await api.post<Route>('/routes', input)
    return response.data
  },

  update: async (id: string, input: Partial<RouteInput>): Promise<Route> => {
    const response = await api.put<Route>(`/routes/${id}`, input)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/routes/${id}`)
  },
}
