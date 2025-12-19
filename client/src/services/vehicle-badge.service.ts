import api from '@/lib/api'

export type OperationalStatus = 'trong_ben' | 'dang_chay'

export interface VehicleBadge {
  id: string
  badge_color: string
  badge_number: string
  badge_type: string
  bus_route_ref: string
  business_license_ref: string
  created_at: string
  created_by: string
  email_notification_sent: boolean
  expiry_date: string
  file_code: string
  issue_date: string
  issue_type: string
  issuing_authority_ref: string
  license_plate_sheet: string
  notes: string
  notification_ref: string
  previous_badge_number: string
  renewal_due_date: string
  renewal_reason: string
  renewal_reminder_shown: boolean
  replacement_vehicle_id: string
  revocation_date: string
  revocation_decision: string
  revocation_reason: string
  route_id: string
  status: string
  vehicle_id: string
  vehicle_type: string
  warn_duplicate_plate: boolean
  operational_status: OperationalStatus  // 'trong_ben' (in station) or 'dang_chay' (running)
}

export const vehicleBadgeService = {
  getAll: async (): Promise<VehicleBadge[]> => {
    try {
      const response = await api.get<VehicleBadge[]>('/vehicle-badges')
      return response.data
    } catch (error) {
      console.error('Error fetching vehicle badges:', error)
      return []
    }
  },

  getById: async (id: string): Promise<VehicleBadge | null> => {
    try {
      const response = await api.get<VehicleBadge>(`/vehicle-badges/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching vehicle badge by id:', error)
      return null
    }
  },

  getByPlateNumber: async (plateNumber: string): Promise<VehicleBadge | null> => {
    try {
      const response = await api.get<VehicleBadge>(`/vehicle-badges/by-plate/${encodeURIComponent(plateNumber)}`)
      return response.data
    } catch (error) {
      console.error('Error fetching vehicle badge by plate number:', error)
      return null
    }
  },

  getStats: async (): Promise<{
    total: number
    active: number
    expired: number
    expiringSoon: number
  }> => {
    try {
      const response = await api.get<{
        total: number
        active: number
        expired: number
        expiringSoon: number
      }>('/vehicle-badges/stats')
      return response.data
    } catch (error) {
      console.error('Error fetching vehicle badge stats:', error)
      return {
        total: 0,
        active: 0,
        expired: 0,
        expiringSoon: 0,
      }
    }
  },
}
