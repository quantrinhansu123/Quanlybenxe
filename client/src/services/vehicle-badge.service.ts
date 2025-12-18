import { firebaseClient } from "@/lib/firebase"

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
  warn_duplicate_plate: boolean
}

// Map Firebase data to VehicleBadge format
const mapFirebaseDataToBadge = (firebaseData: any): VehicleBadge => {
  // Normalize status - map Vietnamese to English
  let status = 'active'
  if (firebaseData.TrangThai) {
    const statusLower = firebaseData.TrangThai.toLowerCase()
    if (statusLower.includes('hiệu lực') || statusLower.includes('hieu luc')) {
      status = 'active'
    } else if (statusLower.includes('hết') || statusLower.includes('het')) {
      status = 'expired'
    } else if (statusLower.includes('thu hồi') || statusLower.includes('thu hoi')) {
      status = 'revoked'
    } else {
      status = firebaseData.TrangThai
    }
  }

  return {
    id: firebaseData.ID_PhuHieu || '',
    badge_number: firebaseData.SoPhuHieu || '',
    license_plate_sheet: firebaseData.BienSoXe || '',
    badge_type: firebaseData.LoaiPH || '',
    badge_color: '',
    issue_date: firebaseData.NgayCap || '',
    expiry_date: firebaseData.NgayHetHan || '',
    status: status,
    file_code: firebaseData.MaHoSo || '',
    issue_type: firebaseData.LoaiCap || '',
    business_license_ref: firebaseData.Ref_GPKD || '',
    bus_route_ref: '',
    vehicle_id: '',
    route_id: '',
    notes: '',
    created_at: new Date().toISOString(),
    created_by: '',
    email_notification_sent: false,
    notification_ref: '',
    previous_badge_number: '',
    renewal_due_date: '',
    renewal_reason: '',
    renewal_reminder_shown: false,
    replacement_vehicle_id: '',
    revocation_date: '',
    revocation_decision: '',
    revocation_reason: '',
    warn_duplicate_plate: false,
  }
}

export const vehicleBadgeService = {
  getAll: async (): Promise<VehicleBadge[]> => {
    try {
      // Fetch from Firebase datasheet/PHUHIEUXE
      const firebaseData = await firebaseClient.get<Record<string, any>>('datasheet/PHUHIEUXE')
      
      if (!firebaseData) {
        return []
      }

      const badges = Object.keys(firebaseData).map(key => {
        const item = firebaseData[key]
        return mapFirebaseDataToBadge(item)
      })

      // Sort by badge number descending
      badges.sort((a, b) => b.badge_number.localeCompare(a.badge_number))

      return badges
    } catch (error) {
      console.error('Error fetching vehicle badges from Firebase:', error)
      return []
    }
  },

  getById: async (id: string): Promise<VehicleBadge | null> => {
    try {
      const firebaseData = await firebaseClient.get<Record<string, any>>('datasheet/PHUHIEUXE')
      
      if (!firebaseData) {
        return null
      }

      // Find badge by ID
      const badgeKey = Object.keys(firebaseData).find(key => {
        const item = firebaseData[key]
        return item.ID_PhuHieu === id
      })

      if (!badgeKey) {
        return null
      }

      return mapFirebaseDataToBadge(firebaseData[badgeKey])
    } catch (error) {
      console.error('Error fetching vehicle badge by id from Firebase:', error)
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
      const badges = await vehicleBadgeService.getAll()

      const totalCount = badges.length
      const activeCount = badges.filter(b => b.status === 'active').length
      const expiredCount = badges.filter(b => b.status === 'expired').length

      // Calculate expiring soon (within 30 days)
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const expiringSoonCount = badges.filter(b => {
        if (b.status !== 'active' || !b.expiry_date) return false
        let expiryDate: Date
        if (b.expiry_date.includes('/')) {
          const [day, month, year] = b.expiry_date.split('/')
          expiryDate = new Date(`${year}-${month}-${day}`)
        } else {
          expiryDate = new Date(b.expiry_date)
        }
        return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date()
      }).length

      return {
        total: totalCount,
        active: activeCount,
        expired: expiredCount,
        expiringSoon: expiringSoonCount,
      }
    } catch (error) {
      console.error('Error fetching vehicle badge stats from Firebase:', error)
      return {
        total: 0,
        active: 0,
        expired: 0,
        expiringSoon: 0,
      }
    }
  },
}
