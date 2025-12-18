import api from '@/lib/api'
import type { Operator, OperatorInput } from '@/types'

export const operatorService = {
  getAll: async (isActive?: boolean): Promise<Operator[]> => {
    try {
      const params = new URLSearchParams()
      if (isActive !== undefined) params.append('isActive', String(isActive))

      const queryString = params.toString()
      const url = queryString ? `/operators?${queryString}` : '/operators'

      const response = await api.get<Operator[]>(url)
      return response.data
    } catch (error) {
      console.error('Error fetching operators:', error)
      return []
    }
  },

  getById: async (id: string): Promise<Operator> => {
    const response = await api.get<Operator>(`/operators/${id}`)
    return response.data
  },

  create: async (input: OperatorInput): Promise<Operator> => {
    const response = await api.post<Operator>('/operators', input)
    return response.data
  },

  update: async (id: string, input: Partial<OperatorInput>): Promise<Operator> => {
    const response = await api.put<Operator>(`/operators/${id}`, input)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/operators/${id}`)
  },
}
