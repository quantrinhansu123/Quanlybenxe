import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '@/store/ui.store'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const { initializeShiftIfNeeded } = useUIStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Tự động set shift theo giờ hiện tại khi đăng nhập lần đầu
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      initializeShiftIfNeeded()
    }
  }, [isAuthenticated, isLoading, initializeShiftIfNeeded])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
