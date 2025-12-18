import { create } from 'zustand'
import type { User, RegisterCredentials } from '@/types'
import { authService } from '@/services/auth.service'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (usernameOrEmail: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateProfile: (data: { fullName?: string; email?: string; phone?: string }) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (usernameOrEmail: string, password: string, rememberMe = false) => {
    try {
      const data = await authService.login({ usernameOrEmail, password, rememberMe })
      set({ user: data.user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (credentials: RegisterCredentials) => {
    try {
      const data = await authService.register(credentials)
      set({ user: data.user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    authService.logout()
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    if (authService.isAuthenticated()) {
      try {
        const user = await authService.getCurrentUser()
        set({ user, isAuthenticated: true, isLoading: false })
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } else {
      set({ isLoading: false })
    }
  },

  updateProfile: async (data: { fullName?: string; email?: string; phone?: string }) => {
    try {
      const updatedUser = await authService.updateProfile(data)
      set({ user: updatedUser })
    } catch (error) {
      throw error
    }
  },
}))

