import { Request, Response } from 'express'
import { db } from '../config/database.js'

// Helper function to map Firebase data to VehicleBadge format
const mapFirebaseDataToBadge = (firebaseData: any) => {
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
    badge_color: '', // Not available in datasheet
    issue_date: firebaseData.NgayCap || '',
    expiry_date: firebaseData.NgayHetHan || '',
    status: status,
    file_code: firebaseData.MaHoSo || '',
    issue_type: firebaseData.LoaiCap || '',
    business_license_ref: firebaseData.Ref_GPKD || '',
    issuing_authority_ref: firebaseData.Ref_DonViCapPhuHieu || '',
    vehicle_id: '',
    route_id: '',
    bus_route_ref: '',
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

export const getAllVehicleBadges = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, badgeType, badgeColor, vehicleId, routeId } = req.query

    // Get data from Firebase datasheet/PHUHIEUXE path
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const firebaseData = snapshot.val()

    if (!firebaseData) {
      res.json([])
      return
    }

    // Convert Firebase object to array and map to VehicleBadge format
    let badges = Object.keys(firebaseData).map(key => {
      const item = firebaseData[key]
      return mapFirebaseDataToBadge(item)
    })

    // Apply filters
    if (status) {
      badges = badges.filter(badge => badge.status === status)
    }
    if (badgeType) {
      badges = badges.filter(badge => badge.badge_type === badgeType)
    }
    if (badgeColor) {
      badges = badges.filter(badge => badge.badge_color === badgeColor)
    }
    if (vehicleId) {
      badges = badges.filter(badge => badge.vehicle_id === vehicleId)
    }
    if (routeId) {
      badges = badges.filter(badge => badge.route_id === routeId)
    }

    // Sort by badge_number descending
    badges.sort((a, b) => b.badge_number.localeCompare(a.badge_number))

    res.json(badges)
  } catch (error) {
    console.error('Error fetching vehicle badges:', error)
    res.status(500).json({ 
      error: 'Failed to fetch vehicle badges',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getVehicleBadgeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    // Get data from Firebase datasheet/PHUHIEUXE path
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const firebaseData = snapshot.val()

    if (!firebaseData) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    // Find badge by ID
    const badgeKey = Object.keys(firebaseData).find(key => {
      const item = firebaseData[key]
      return item.ID_PhuHieu === id
    })

    if (!badgeKey) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    const badge = mapFirebaseDataToBadge(firebaseData[badgeKey])
    res.json(badge)
  } catch (error) {
    console.error('Error fetching vehicle badge:', error)
    res.status(500).json({ 
      error: 'Failed to fetch vehicle badge',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getVehicleBadgeStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get data from Firebase datasheet/PHUHIEUXE path
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const firebaseData = snapshot.val()

    if (!firebaseData) {
      res.json({
        total: 0,
        active: 0,
        expired: 0,
        expiringSoon: 0,
      })
      return
    }

    // Convert to array and map
    const badges = Object.keys(firebaseData).map(key => mapFirebaseDataToBadge(firebaseData[key]))

    // Calculate stats
    const totalCount = badges.length
    const activeCount = badges.filter(b => b.status === 'active').length
    const expiredCount = badges.filter(b => b.status === 'expired').length

    // Get badges expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const expiringSoonCount = badges.filter(b => {
      if (b.status !== 'active' || !b.expiry_date) return false
      // Handle both DD/MM/YYYY and YYYY-MM-DD formats
      let expiryDate: Date
      if (b.expiry_date.includes('/')) {
        const [day, month, year] = b.expiry_date.split('/')
        expiryDate = new Date(`${year}-${month}-${day}`)
      } else {
        expiryDate = new Date(b.expiry_date)
      }
      return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date()
    }).length

    res.json({
      total: totalCount,
      active: activeCount,
      expired: expiredCount,
      expiringSoon: expiringSoonCount,
    })
  } catch (error) {
    console.error('Error fetching vehicle badge stats:', error)
    res.status(500).json({ 
      error: 'Failed to fetch vehicle badge statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
