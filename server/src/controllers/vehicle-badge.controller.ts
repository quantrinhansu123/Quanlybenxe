import { Request, Response } from 'express'
import { db, firebase } from '../config/database.js'

// In-memory cache for vehicle badges (refresh every 30 minutes for production)
let badgesCache: any[] | null = null
let badgesCacheTime: number = 0
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes - badges don't change often
let cacheLoading: Promise<any[]> | null = null // Prevent multiple simultaneous loads

// Helper function to get active dispatch vehicle plates (vehicles currently in operation)
const getActiveDispatchPlates = async (): Promise<Set<string>> => {
  try {
    // Get all dispatch records that are NOT departed (still in process)
    const { data: activeRecords } = await firebase
      .from('dispatch_records')
      .select('vehicle_plate_number, current_status')
      .neq('current_status', 'departed')

    const activePlates = new Set<string>()
    if (activeRecords) {
      for (const record of activeRecords) {
        if (record.vehicle_plate_number) {
          // Normalize plate number for comparison
          activePlates.add(record.vehicle_plate_number.replace(/[.\-\s]/g, '').toUpperCase())
        }
      }
    }
    return activePlates
  } catch (error) {
    console.error('Error fetching active dispatch plates:', error)
    return new Set()
  }
}

// Helper function to normalize plate number for comparison
const normalizePlate = (plate: string): string => {
  return plate.replace(/[.\-\s]/g, '').toUpperCase()
}

// Helper function to map Firebase data to VehicleBadge format
const mapFirebaseDataToBadge = (firebaseData: any, activePlates?: Set<string>) => {
  // Keep original status from Firebase data (TrangThai field)
  const status = firebaseData.TrangThai || ''

  return {
    id: firebaseData.ID_PhuHieu || '',
    badge_number: firebaseData.SoPhuHieu || '',
    license_plate_sheet: firebaseData.BienSoXe || '',
    badge_type: firebaseData.LoaiPH || '',
    badge_color: firebaseData.MauPhuHieu || '',
    issue_date: firebaseData.NgayCap || '',
    expiry_date: firebaseData.NgayHetHan || '',
    status: status,
    file_code: firebaseData.MaHoSo || '',
    issue_type: firebaseData.LoaiCap || '',
    business_license_ref: firebaseData.Ref_GPKD || '',
    issuing_authority_ref: firebaseData.Ref_DonViCapPhuHieu || '',
    vehicle_id: '',
    route_id: '',
    bus_route_ref: firebaseData.TuyenDuong || '',
    vehicle_type: firebaseData.LoaiXe || '',
    notes: '',
    created_at: firebaseData.created_at || new Date().toISOString(),
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
    // Compute operational_status based on active dispatch records
    operational_status: activePlates && firebaseData.BienSoXe
      ? (activePlates.has(normalizePlate(firebaseData.BienSoXe)) ? 'dang_chay' : 'trong_ben')
      : 'trong_ben',
  }
}

// Helper to load and cache badges with deduplication
const loadBadgesFromDB = async (): Promise<any[]> => {
  const now = Date.now()
  
  // Return cached data if valid
  if (badgesCache && (now - badgesCacheTime) < CACHE_TTL) {
    return badgesCache
  }
  
  // If already loading, wait for that instead of starting another load
  if (cacheLoading) {
    return cacheLoading
  }
  
  // Start loading
  cacheLoading = (async () => {
    try {
      // Load from Firebase
      const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
      const firebaseData = snapshot.val()
      
      if (!firebaseData) {
        badgesCache = []
        badgesCacheTime = Date.now()
        return []
      }
      
      // Convert and cache - use Object.values for faster iteration
      const keys = Object.keys(firebaseData)
      badgesCache = new Array(keys.length)
      
      for (let i = 0; i < keys.length; i++) {
        badgesCache[i] = mapFirebaseDataToBadge(firebaseData[keys[i]])
      }
      
      // Sort once during caching
      badgesCache.sort((a, b) => b.badge_number.localeCompare(a.badge_number))
      badgesCacheTime = Date.now()
      
      return badgesCache
    } finally {
      cacheLoading = null
    }
  })()
  
  return cacheLoading
}

// Invalidate cache (call after create/update/delete)
export const invalidateBadgesCache = () => {
  badgesCache = null
  badgesCacheTime = 0
  cacheLoading = null
}

export const getAllVehicleBadges = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, badgeType, badgeColor, vehicleId, routeId, page, limit } = req.query

    // Load from cache
    let badges = await loadBadgesFromDB()

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

    // Server-side pagination
    const pageNum = parseInt(page as string) || 1
    const limitNum = parseInt(limit as string) || 0 // 0 = no limit
    
    if (limitNum > 0) {
      const startIndex = (pageNum - 1) * limitNum
      badges = badges.slice(startIndex, startIndex + limitNum)
    }

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

    // Get active dispatch plates to compute operational_status
    const activePlates = await getActiveDispatchPlates()

    // Get data from Firebase datasheet/PHUHIEUXE path (migrated from old Firebase)
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

    const badge = mapFirebaseDataToBadge(firebaseData[badgeKey], activePlates)
    res.json(badge)
  } catch (error) {
    console.error('Error fetching vehicle badge:', error)
    res.status(500).json({ 
      error: 'Failed to fetch vehicle badge',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getVehicleBadgeByPlateNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const { plateNumber } = req.params

    if (!plateNumber) {
      res.status(400).json({ error: 'Plate number is required' })
      return
    }

    // Normalize input plate number
    const normalizedInput = normalizePlate(plateNumber)

    // Get active dispatch plates to compute operational_status
    const activePlates = await getActiveDispatchPlates()

    // Get data from Firebase datasheet/PHUHIEUXE path
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const firebaseData = snapshot.val()

    if (!firebaseData) {
      res.status(404).json({ error: 'No vehicle badges found' })
      return
    }

    // Find badge by plate number (BienSoXe field)
    const badgeKey = Object.keys(firebaseData).find(key => {
      const item = firebaseData[key]
      if (!item.BienSoXe) return false
      return normalizePlate(item.BienSoXe) === normalizedInput
    })

    if (!badgeKey) {
      res.status(404).json({ error: 'Vehicle badge not found for this plate number' })
      return
    }

    const badge = mapFirebaseDataToBadge(firebaseData[badgeKey], activePlates)
    res.json(badge)
  } catch (error) {
    console.error('Error fetching vehicle badge by plate number:', error)
    res.status(500).json({
      error: 'Failed to fetch vehicle badge',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Create a new vehicle badge
export const createVehicleBadge = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      badge_number,
      license_plate_sheet,
      badge_type,
      badge_color,
      issue_date,
      expiry_date,
      status,
      file_code,
      issue_type,
      bus_route_ref,
      vehicle_type,
      notes,
    } = req.body

    // Validate required fields
    if (!badge_number || !license_plate_sheet) {
      res.status(400).json({ error: 'Số phù hiệu và biển số xe là bắt buộc' })
      return
    }

    // Check for duplicate badge number
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const existingData = snapshot.val() || {}
    
    const duplicateBadge = Object.values(existingData).find(
      (item: any) => item.SoPhuHieu === badge_number
    )
    if (duplicateBadge) {
      res.status(400).json({ error: 'Số phù hiệu đã tồn tại' })
      return
    }

    // Generate new ID
    const newId = `PH_${Date.now()}`
    
    // Create new badge data in Firebase format
    const newBadgeData = {
      ID_PhuHieu: newId,
      SoPhuHieu: badge_number,
      BienSoXe: license_plate_sheet,
      LoaiPH: badge_type || '',
      MauPhuHieu: badge_color || '',
      NgayCap: issue_date || '',
      NgayHetHan: expiry_date || '',
      TrangThai: status || 'Còn hiệu lực',
      MaHoSo: file_code || '',
      LoaiCap: issue_type || 'Cấp mới',
      TuyenDuong: bus_route_ref || '',
      LoaiXe: vehicle_type || '',
      GhiChu: notes || '',
      created_at: new Date().toISOString(),
    }

    // Save to Firebase
    await db!.ref(`datasheet/PHUHIEUXE/${newId}`).set(newBadgeData)

    // Invalidate cache
    invalidateBadgesCache()

    // Return mapped badge
    const createdBadge = mapFirebaseDataToBadge(newBadgeData)
    
    res.status(201).json(createdBadge)
  } catch (error) {
    console.error('Error creating vehicle badge:', error)
    res.status(500).json({
      error: 'Failed to create vehicle badge',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Update an existing vehicle badge
export const updateVehicleBadge = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const {
      badge_number,
      license_plate_sheet,
      badge_type,
      badge_color,
      issue_date,
      expiry_date,
      status,
      file_code,
      issue_type,
      bus_route_ref,
      vehicle_type,
      notes,
    } = req.body

    // Find the badge by ID
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const firebaseData = snapshot.val()

    if (!firebaseData) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    // Find badge key by ID
    const badgeKey = Object.keys(firebaseData).find(key => {
      const item = firebaseData[key]
      return item.ID_PhuHieu === id
    })

    if (!badgeKey) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    // Check for duplicate badge number (excluding current badge)
    if (badge_number) {
      const duplicateBadge = Object.entries(firebaseData).find(
        ([key, item]: [string, any]) => item.SoPhuHieu === badge_number && key !== badgeKey
      )
      if (duplicateBadge) {
        res.status(400).json({ error: 'Số phù hiệu đã tồn tại' })
        return
      }
    }

    // Update badge data
    const existingData = firebaseData[badgeKey]
    const updatedData = {
      ...existingData,
      SoPhuHieu: badge_number ?? existingData.SoPhuHieu,
      BienSoXe: license_plate_sheet ?? existingData.BienSoXe,
      LoaiPH: badge_type ?? existingData.LoaiPH,
      MauPhuHieu: badge_color ?? existingData.MauPhuHieu,
      NgayCap: issue_date ?? existingData.NgayCap,
      NgayHetHan: expiry_date ?? existingData.NgayHetHan,
      TrangThai: status ?? existingData.TrangThai,
      MaHoSo: file_code ?? existingData.MaHoSo,
      LoaiCap: issue_type ?? existingData.LoaiCap,
      TuyenDuong: bus_route_ref ?? existingData.TuyenDuong,
      LoaiXe: vehicle_type ?? existingData.LoaiXe,
      GhiChu: notes ?? existingData.GhiChu,
      updated_at: new Date().toISOString(),
    }

    // Save to Firebase
    await db!.ref(`datasheet/PHUHIEUXE/${badgeKey}`).set(updatedData)

    // Invalidate cache
    invalidateBadgesCache()

    // Return mapped badge
    const updatedBadge = mapFirebaseDataToBadge(updatedData)
    
    res.json(updatedBadge)
  } catch (error) {
    console.error('Error updating vehicle badge:', error)
    res.status(500).json({
      error: 'Failed to update vehicle badge',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Delete a vehicle badge
export const deleteVehicleBadge = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    // Find the badge by ID
    const snapshot = await db!.ref('datasheet/PHUHIEUXE').once('value')
    const firebaseData = snapshot.val()

    if (!firebaseData) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    // Find badge key by ID
    const badgeKey = Object.keys(firebaseData).find(key => {
      const item = firebaseData[key]
      return item.ID_PhuHieu === id
    })

    if (!badgeKey) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    // Delete from Firebase
    await db!.ref(`datasheet/PHUHIEUXE/${badgeKey}`).remove()

    // Invalidate cache
    invalidateBadgesCache()

    res.status(204).send()
  } catch (error) {
    console.error('Error deleting vehicle badge:', error)
    res.status(500).json({
      error: 'Failed to delete vehicle badge',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getVehicleBadgeStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get data from Firebase datasheet/PHUHIEUXE path (migrated from old Firebase)
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
