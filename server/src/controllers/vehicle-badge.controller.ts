import { Request, Response } from 'express'
import { firebase } from '../config/database.js'

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

// Helper function to map Supabase/Firebase data to VehicleBadge format
// Supports both Supabase (snake_case) and old format (Vietnamese field names)
const mapFirebaseDataToBadge = (data: any, activePlates?: Set<string>) => {
  // Supabase uses snake_case, Firebase uses Vietnamese names
  const status = data.status || data.TrangThai || ''
  const vehicleRef = data.plate_number || data.BienSoXe || data.vehicle_id || ''
  const vehicleId = data.vehicle_id || ''

  return {
    id: data.id || data.ID_PhuHieu || '',
    badge_number: data.badge_number || data.SoPhuHieu || '',
    license_plate_sheet: data.plate_number || vehicleRef,
    badge_type: data.badge_type || data.LoaiPH || '',
    badge_color: data.badge_color || data.MauPhuHieu || '',
    issue_date: data.issue_date || data.NgayCap || '',
    expiry_date: data.expiry_date || data.NgayHetHan || '',
    status: status,
    file_code: data.file_code || data.MaHoSo || '',
    issue_type: data.issue_type || data.LoaiCap || '',
    business_license_ref: data.business_license_ref || data.Ref_GPKD || '',
    issuing_authority_ref: data.operator_id || data.Ref_DonViCapPhuHieu || '',
    vehicle_id: vehicleId,
    route_id: data.route_id || data.Ref_Tuyen || '',
    bus_route_ref: data.bus_route_ref || data.TuyenDuong || '',
    vehicle_type: data.vehicle_type || data.LoaiXe || '',
    notes: data.notes || data.GhiChu || '',
    created_at: data.created_at || data.synced_at || new Date().toISOString(),
    created_by: data.created_by || data.User || '',
    email_notification_sent: data.email_notification_sent || data.GuiEmailbao || false,
    notification_ref: data.notification_ref || data.Ref_ThongBao || '',
    previous_badge_number: data.previous_badge_number || data.SoPhuHieuCu || '',
    renewal_due_date: data.renewal_due_date || data.Hancap || '',
    renewal_reason: data.renewal_reason || data.LyDoCapLai || '',
    renewal_reminder_shown: data.renewal_reminder_shown || data.CanCapLaiPopup || false,
    replacement_vehicle_id: data.replacement_vehicle_id || data.XeThayThe || '',
    revocation_date: data.revocation_date || data.NgayThuHoi || '',
    revocation_decision: data.revocation_decision || data.QDThuHoi || '',
    revocation_reason: data.revocation_reason || data.LyDoThuHoi || '',
    warn_duplicate_plate: data.warn_duplicate_plate || data.CanhBaoTrungBienSoKhiCapPH || false,
    // Compute operational_status based on active dispatch records
    operational_status: activePlates && vehicleRef
      ? (activePlates.has(normalizePlate(vehicleRef)) ? 'dang_chay' : 'trong_ben')
      : 'trong_ben',
  }
}

// Cache for vehicle ID to plate number mapping
let vehiclePlateCache: Map<string, string> | null = null
let vehiclePlateCacheTime: number = 0

// Helper to load vehicle plate numbers for resolving badge vehicle_id
const loadVehiclePlates = async (): Promise<Map<string, string>> => {
  const now = Date.now()
  if (vehiclePlateCache && (now - vehiclePlateCacheTime) < CACHE_TTL) {
    return vehiclePlateCache
  }

  const { data, error } = await firebase.from('vehicles').select('id, plate_number')
  if (error) {
    console.error('Error loading vehicle plates:', error)
    return new Map()
  }

  vehiclePlateCache = new Map()
  if (data) {
    for (const vehicle of data) {
      if (vehicle.plate_number) {
        vehiclePlateCache.set(vehicle.id, vehicle.plate_number)
      }
    }
  }

  vehiclePlateCacheTime = Date.now()
  return vehiclePlateCache
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
  const loadPromise = (async (): Promise<any[]> => {
    try {
      // Load from Supabase
      const [badgesResult, vehiclePlates] = await Promise.all([
        firebase.from('vehicle_badges').select('*'),
        loadVehiclePlates()
      ])

      if (badgesResult.error) {
        console.error('Error loading badges:', badgesResult.error)
        badgesCache = []
        badgesCacheTime = Date.now()
        return []
      }

      const badgeData = badgesResult.data || []

      // Convert and cache
      const mappedBadges = badgeData.map((badge: any) => {
        const mapped = mapFirebaseDataToBadge(badge)
        // Resolve vehicle_id to actual plate number
        if (mapped.vehicle_id && vehiclePlates.has(mapped.vehicle_id)) {
          mapped.license_plate_sheet = vehiclePlates.get(mapped.vehicle_id)!
        }
        return mapped
      })

      // Sort once during caching
      mappedBadges.sort((a: any, b: any) => b.badge_number.localeCompare(a.badge_number))
      badgesCache = mappedBadges
      badgesCacheTime = Date.now()

      return mappedBadges
    } finally {
      cacheLoading = null
    }
  })()

  cacheLoading = loadPromise
  return loadPromise
}

// Invalidate cache (call after create/update/delete)
export const invalidateBadgesCache = () => {
  badgesCache = null
  badgesCacheTime = 0
  cacheLoading = null
  vehiclePlateCache = null
  vehiclePlateCacheTime = 0
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

    // Get data from Supabase
    const { data, error } = await firebase
      .from('vehicle_badges')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    const badge = mapFirebaseDataToBadge(data, activePlates)
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

    // Get active dispatch plates to compute operational_status
    const activePlates = await getActiveDispatchPlates()

    // Get data from Supabase - search by plate_number
    const { data, error } = await firebase
      .from('vehicle_badges')
      .select('*')
      .ilike('plate_number', `%${plateNumber}%`)
      .limit(1)
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Vehicle badge not found for this plate number' })
      return
    }

    const badge = mapFirebaseDataToBadge(data, activePlates)
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
    const { data: existingBadge } = await firebase
      .from('vehicle_badges')
      .select('id')
      .eq('badge_number', badge_number)
      .limit(1)
      .single()

    if (existingBadge) {
      res.status(400).json({ error: 'Số phù hiệu đã tồn tại' })
      return
    }

    // Create new badge in Supabase
    const { data, error } = await firebase
      .from('vehicle_badges')
      .insert({
        badge_number: badge_number,
        plate_number: license_plate_sheet,
        badge_type: badge_type || null,
        badge_color: badge_color || null,
        issue_date: issue_date || null,
        expiry_date: expiry_date || null,
        status: status || 'active',
        file_code: file_code || null,
        issue_type: issue_type || null,
        bus_route_ref: bus_route_ref || null,
        vehicle_type: vehicle_type || null,
        notes: notes || null,
        source: 'manual',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating badge:', error)
      res.status(500).json({ error: 'Failed to create vehicle badge' })
      return
    }

    // Invalidate cache
    invalidateBadgesCache()

    // Return mapped badge
    const createdBadge = mapFirebaseDataToBadge(data)

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

    // Check for duplicate badge number (excluding current badge)
    if (badge_number) {
      const { data: duplicateBadge } = await firebase
        .from('vehicle_badges')
        .select('id')
        .eq('badge_number', badge_number)
        .neq('id', id)
        .limit(1)
        .single()

      if (duplicateBadge) {
        res.status(400).json({ error: 'Số phù hiệu đã tồn tại' })
        return
      }
    }

    // Build update data
    const updateData: any = {}
    if (badge_number !== undefined) updateData.badge_number = badge_number
    if (license_plate_sheet !== undefined) updateData.plate_number = license_plate_sheet
    if (badge_type !== undefined) updateData.badge_type = badge_type
    if (badge_color !== undefined) updateData.badge_color = badge_color
    if (issue_date !== undefined) updateData.issue_date = issue_date
    if (expiry_date !== undefined) updateData.expiry_date = expiry_date
    if (status !== undefined) updateData.status = status
    if (file_code !== undefined) updateData.file_code = file_code
    if (issue_type !== undefined) updateData.issue_type = issue_type
    if (bus_route_ref !== undefined) updateData.bus_route_ref = bus_route_ref
    if (vehicle_type !== undefined) updateData.vehicle_type = vehicle_type
    if (notes !== undefined) updateData.notes = notes

    // Update in Supabase
    const { data, error } = await firebase
      .from('vehicle_badges')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

    // Invalidate cache
    invalidateBadgesCache()

    // Return mapped badge
    const updatedBadge = mapFirebaseDataToBadge(data)

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

    // Delete from Supabase
    const { error } = await firebase
      .from('vehicle_badges')
      .delete()
      .eq('id', id)

    if (error) {
      res.status(404).json({ error: 'Vehicle badge not found' })
      return
    }

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
    // Get data from Supabase
    const { data: badges, error } = await firebase
      .from('vehicle_badges')
      .select('*')

    if (error || !badges) {
      res.json({
        total: 0,
        active: 0,
        expired: 0,
        expiringSoon: 0,
      })
      return
    }

    // Calculate stats
    const totalCount = badges.length
    const activeCount = badges.filter((b: any) => b.status === 'active').length
    const expiredCount = badges.filter((b: any) => b.status === 'expired').length

    // Get badges expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const expiringSoonCount = badges.filter((b: any) => {
      if (b.status !== 'active' || !b.expiry_date) return false
      const expiryDate = new Date(b.expiry_date)
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
