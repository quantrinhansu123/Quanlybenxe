import { Request, Response } from 'express'
import { db } from '../db/drizzle.js'
import { vehicleBadges, vehicles, dispatchRecords } from '../db/schema/index.js'
import { eq, ne, ilike, and } from 'drizzle-orm'

// In-memory cache for vehicle badges (refresh every 30 minutes for production)
let badgesCache: any[] | null = null
let badgesCacheTime: number = 0
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes - badges don't change often
let cacheLoading: Promise<any[]> | null = null // Prevent multiple simultaneous loads

// Helper function to get active dispatch vehicle plates (vehicles currently in operation)
const getActiveDispatchPlates = async (): Promise<Set<string>> => {
  try {
    if (!db) throw new Error('Database not initialized')

    // Get all dispatch records that are NOT departed (still in process)
    const activeRecords = await db
      .select({
        vehiclePlateNumber: dispatchRecords.vehiclePlateNumber,
        status: dispatchRecords.status
      })
      .from(dispatchRecords)
      .where(ne(dispatchRecords.status, 'departed'))

    const activePlates = new Set<string>()
    for (const record of activeRecords) {
      if (record.vehiclePlateNumber) {
        // Normalize plate number for comparison
        activePlates.add(record.vehiclePlateNumber.replace(/[.\-\s]/g, '').toUpperCase())
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

  try {
    if (!db) throw new Error('Database not initialized')

    const data = await db
      .select({
        id: vehicles.id,
        plateNumber: vehicles.plateNumber
      })
      .from(vehicles)

    vehiclePlateCache = new Map()
    for (const vehicle of data) {
      if (vehicle.plateNumber) {
        vehiclePlateCache.set(vehicle.id, vehicle.plateNumber)
      }
    }

    vehiclePlateCacheTime = Date.now()
    return vehiclePlateCache
  } catch (error) {
    console.error('Error loading vehicle plates:', error)
    return new Map()
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
  const loadPromise = (async (): Promise<any[]> => {
    try {
      if (!db) throw new Error('Database not initialized')

      // Load from Drizzle
      const [badgeData, vehiclePlates] = await Promise.all([
        db.select().from(vehicleBadges),
        loadVehiclePlates()
      ])

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
    if (!db) throw new Error('Database not initialized')

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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    // Get active dispatch plates to compute operational_status
    const activePlates = await getActiveDispatchPlates()

    // Get data from Drizzle
    const [data] = await db
      .select()
      .from(vehicleBadges)
      .where(eq(vehicleBadges.id, id))

    if (!data) {
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
    if (!db) throw new Error('Database not initialized')

    const { plateNumber } = req.params

    if (!plateNumber) {
      res.status(400).json({ error: 'Plate number is required' })
      return
    }

    // Get active dispatch plates to compute operational_status
    const activePlates = await getActiveDispatchPlates()

    // Get data from Drizzle - search by plate_number
    const results = await db
      .select()
      .from(vehicleBadges)
      .where(ilike(vehicleBadges.plateNumber, `%${plateNumber}%`))
      .limit(1)

    const data = results[0]

    if (!data) {
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
    if (!db) throw new Error('Database not initialized')

    const {
      badge_number,
      license_plate_sheet,
      badge_type,
      issue_date,
      expiry_date,
      status,
      bus_route_ref,
    } = req.body

    // Validate required fields
    if (!badge_number || !license_plate_sheet) {
      res.status(400).json({ error: 'Số phù hiệu và biển số xe là bắt buộc' })
      return
    }

    // Check for duplicate badge number
    if (!db) throw new Error('Database not initialized')

    const existingBadges = await db
      .select({ id: vehicleBadges.id })
      .from(vehicleBadges)
      .where(eq(vehicleBadges.badgeNumber, badge_number))
      .limit(1)

    if (existingBadges.length > 0) {
      res.status(400).json({ error: 'Số phù hiệu đã tồn tại' })
      return
    }

    // Create new badge in Drizzle
    const [data] = await db
      .insert(vehicleBadges)
      .values({
        badgeNumber: badge_number,
        plateNumber: license_plate_sheet,
        badgeType: badge_type || null,
        issueDate: issue_date || null,
        expiryDate: expiry_date || null,
        status: status || 'active',
        routeCode: bus_route_ref || null,
        source: 'manual',
      })
      .returning()

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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const {
      badge_number,
      license_plate_sheet,
      badge_type,
      issue_date,
      expiry_date,
      status,
      bus_route_ref,
    } = req.body

    // Check for duplicate badge number (excluding current badge)
    if (badge_number) {
      if (!db) throw new Error('Database not initialized')

      const duplicateBadges = await db
        .select({ id: vehicleBadges.id })
        .from(vehicleBadges)
        .where(and(
          eq(vehicleBadges.badgeNumber, badge_number),
          ne(vehicleBadges.id, id)
        ))
        .limit(1)

      if (duplicateBadges.length > 0) {
        res.status(400).json({ error: 'Số phù hiệu đã tồn tại' })
        return
      }
    }

    // Build update data
    const updateData: any = {}
    if (badge_number !== undefined) updateData.badgeNumber = badge_number
    if (license_plate_sheet !== undefined) updateData.plateNumber = license_plate_sheet
    if (badge_type !== undefined) updateData.badgeType = badge_type
    if (issue_date !== undefined) updateData.issueDate = issue_date
    if (expiry_date !== undefined) updateData.expiryDate = expiry_date
    if (status !== undefined) updateData.status = status
    if (bus_route_ref !== undefined) updateData.routeCode = bus_route_ref

    // Update in Drizzle
    if (!db) throw new Error('Database not initialized')

    const results = await db
      .update(vehicleBadges)
      .set(updateData)
      .where(eq(vehicleBadges.id, id))
      .returning()

    const data = results[0]

    if (!data) {
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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    // Delete from Drizzle
    await db
      .delete(vehicleBadges)
      .where(eq(vehicleBadges.id, id))

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
    if (!db) throw new Error('Database not initialized')

    // Get data from Drizzle
    const badges = await db.select().from(vehicleBadges)

    // Calculate stats
    const totalCount = badges.length
    const activeCount = badges.filter((b: any) => b.status === 'active').length
    const expiredCount = badges.filter((b: any) => b.status === 'expired').length

    // Get badges expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const expiringSoonCount = badges.filter((b: any) => {
      if (b.status !== 'active' || !b.expiryDate) return false
      const expiryDate = new Date(b.expiryDate)
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
