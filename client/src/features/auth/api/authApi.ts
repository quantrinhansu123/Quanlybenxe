import api from '@/lib/api'
import type { LoginCredentials, RegisterCredentials, User, AuthResponse } from '../types'

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials)
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token)
    }
    return response.data
  },

  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', credentials)
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token)
    }
    return response.data
  },

  logout: (): void => {
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

// Backward compatibility
export default authApi
