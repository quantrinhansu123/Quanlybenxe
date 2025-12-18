import api from '@/lib/api'
import type { LoginCredentials, RegisterCredentials, User } from '@/types'

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post<{ token: string; user: User }>('/auth/login', credentials)
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token)
    }
    return response.data
  },

  register: async (credentials: RegisterCredentials) => {
    const response = await api.post<{ token: string; user: User }>('/auth/register', credentials)
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token)
    }
    return response.data
  },

  logout: () => {
    localStorage.removeItem('auth_token')
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  updateProfile: async (data: { fullName?: string; email?: string; phone?: string }): Promise<User> => {
    const response = await api.put<User>('/auth/profile', data)
    return response.data
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('auth_token')
  },
}

