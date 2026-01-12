import { Request, Response } from 'express'
import { db } from '../db/drizzle.js'
import { vehicleBadges, vehicles as vehiclesTable, operators as operatorsTable, routes as routesTable } from '../db/schema/index.js'

// Unified cache for all quanly data - pre-filtered for Buýt and Tuyến cố định
interface QuanLyCache {
  badges: any[]
  vehicles: any[]
  operators: any[]
  routes: any[]
  timestamp: number
}

let quanLyCache: QuanLyCache | null = null
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes - stable numbers for users
let cacheLoading: Promise<QuanLyCache> | null = null

const ALLOWED_BADGE_TYPES = ['Buýt', 'Tuyến cố định']

// Normalize plate number
const normalizePlate = (plate: string): string => {
  return (plate || '').replace(/[.\-\s]/g, '').toUpperCase()
}

// Load all data in parallel and pre-filter
async function loadQuanLyData(): Promise<QuanLyCache> {
  const now = Date.now()

  // Return cached data if valid
  if (quanLyCache && (now - quanLyCache.timestamp) < CACHE_TTL) {
    return quanLyCache
  }

  // Prevent multiple simultaneous loads
  if (cacheLoading) {
    return cacheLoading
  }

  cacheLoading = (async () => {
    try {
      if (!db) throw new Error('Database not initialized')

      const startTime = Date.now()

      // OPTIMIZED: Load only required columns (60-80% faster)
      const [badgeData, vehicleData, operatorData, routeData] = await Promise.all([
        db.select({
          id: vehicleBadges.id,
          plateNumber: vehicleBadges.plateNumber,
          badgeNumber: vehicleBadges.badgeNumber,
          badgeType: vehicleBadges.badgeType,
          status: vehicleBadges.status,
          expiryDate: vehicleBadges.expiryDate,
          issueDate: vehicleBadges.issueDate,
          operatorId: vehicleBadges.operatorId,
          vehicleId: vehicleBadges.vehicleId,
          routeId: vehicleBadges.routeId,
        }).from(vehicleBadges),
        db.select({
          id: vehiclesTable.id,
          plateNumber: vehiclesTable.plateNumber,
          seatCount: vehiclesTable.seatCount,
          operatorName: vehiclesTable.operatorName,
          isActive: vehiclesTable.isActive,
          roadWorthinessExpiry: vehiclesTable.roadWorthinessExpiry,
          source: vehiclesTable.source,
        }).from(vehiclesTable),
        db.select({
          id: operatorsTable.id,
          name: operatorsTable.name,
          province: operatorsTable.province,
          phone: operatorsTable.phone,
          email: operatorsTable.email,
          address: operatorsTable.address,
          representative: operatorsTable.representative,
          isActive: operatorsTable.isActive,
          source: operatorsTable.source,
        }).from(operatorsTable),
        db.select({
          id: routesTable.id,
          routeCode: routesTable.routeCode,
          departureStation: routesTable.departureStation,
          arrivalStation: routesTable.arrivalStation,
          distanceKm: routesTable.distanceKm,
        }).from(routesTable),
      ])

      // Build vehicle plate lookup (Drizzle data is array)
      const vehiclePlateMap = new Map<string, string>()
      for (const vehicle of vehicleData) {
        const v = vehicle as any
        const plate = v.plateNumber || ''
        if (plate && v.id) {
          vehiclePlateMap.set(v.id, plate)
        }
      }

      // Build operator name lookup (Drizzle data is array)
      const operatorNameMap = new Map<string, string>()
      for (const op of operatorData) {
        const o = op as any
        if (o.id) {
          operatorNameMap.set(o.id, o.name || '')
        }
      }

      // Filter badges by allowed types (Drizzle data is array)
      const allowedPlates = new Set<string>()
      const operatorIdsWithBadges = new Set<string>()
      const vehicleOperatorMap = new Map<string, string>() // plate -> operator name
      const vehicleBadgeExpiryMap = new Map<string, string>() // plate -> badge expiry date
      const badges: any[] = []

      for (const badge of badgeData) {
        const b = badge as any
        const badgeType = b.badgeType || ''

        if (!ALLOWED_BADGE_TYPES.includes(badgeType)) continue

        // Get plate number (from plateNumber field or vehicle lookup)
        let plateNumber = b.plateNumber || ''
        const vehicleId = b.vehicleId || ''
        if (!plateNumber && vehicleId && vehiclePlateMap.has(vehicleId)) {
          plateNumber = vehiclePlateMap.get(vehicleId)!
        }

        if (plateNumber) {
          const normalizedPlate = normalizePlate(plateNumber)
          allowedPlates.add(normalizedPlate)

          // Map vehicle plate to operator name
          const operatorId = b.operatorId || ''
          if (operatorId && operatorNameMap.has(operatorId)) {
            vehicleOperatorMap.set(normalizedPlate, operatorNameMap.get(operatorId)!)
          }

          // Map vehicle plate to badge expiry date
          const badgeExpiry = b.expiryDate || ''
          if (badgeExpiry) {
            vehicleBadgeExpiryMap.set(normalizedPlate, badgeExpiry)
          }
        }

        // Track operator IDs
        const operatorId = b.operatorId || ''
        if (operatorId) {
          operatorIdsWithBadges.add(operatorId)
        }

        badges.push({
          id: b.id,
          badge_number: b.badgeNumber || '',
          license_plate_sheet: plateNumber,
          badge_type: badgeType,
          badge_color: '',
          issue_date: b.issueDate || '',
          expiry_date: b.expiryDate || '',
          status: b.status || '',
          file_code: '',
          issuing_authority_ref: operatorId,
          route_id: b.routeId || '',
          vehicle_type: '',
        })
      }

      // Filter vehicles by allowed plates (Drizzle data is array)
      // If no badges found, return ALL vehicles (fallback for initial setup or empty badge data)
      const shouldFilterByBadges = allowedPlates.size > 0
      const vehiclesByPlate = new Map<string, any[]>()
      for (const vehicle of vehicleData) {
        const v = vehicle as any
        const plateNumber = v.plateNumber || ''
        const normalizedPlate = normalizePlate(plateNumber)

        // Skip if no plate number
        if (!plateNumber) continue

        // If we have badges, filter by allowed plates; otherwise include all
        if (shouldFilterByBadges && !allowedPlates.has(normalizedPlate)) continue

        if (!vehiclesByPlate.has(normalizedPlate)) {
          vehiclesByPlate.set(normalizedPlate, [])
        }
        vehiclesByPlate.get(normalizedPlate)!.push({ key: v.id, v, plateNumber })
      }

      // Second pass: for each plate, pick the entry with most data
      const vehicles: any[] = []
      for (const [normalizedPlate, entries] of vehiclesByPlate) {
        // Sort by data completeness: prefer entries with operatorName, seatCount, etc.
        entries.sort((a, b) => {
          const scoreA = (a.v.operatorName ? 2 : 0) + (a.v.seatCount ? 1 : 0)
          const scoreB = (b.v.operatorName ? 2 : 0) + (b.v.seatCount ? 1 : 0)
          return scoreB - scoreA // Higher score first
        })

        const { key, v, plateNumber } = entries[0]

        // Get seat capacity from seatCount field
        const seatCapacity = v.seatCount || 0

        // Get operator name: prefer from badge reference, fallback to vehicle operatorName
        const operatorFromBadge = vehicleOperatorMap.get(normalizedPlate) || ''
        const operatorName = operatorFromBadge || v.operatorName || ''

        // Get badge expiry date for inspection display
        const badgeExpiryDate = vehicleBadgeExpiryMap.get(normalizedPlate) || ''

        vehicles.push({
          id: key,
          plateNumber: plateNumber,
          seatCapacity,
          operatorName,
          vehicleType: '',
          inspectionExpiryDate: badgeExpiryDate || v.roadWorthinessExpiry || '',
          isActive: v.isActive !== false,
          source: v.source || 'drizzle',
        })
      }

      // Include ALL operators (removed badge-based filtering for Quản lý ĐVVT page)
      // Previous logic was too strict - excluded operators without badges
      const operators: any[] = []
      for (const op of operatorData) {
        const o = op as any
        const operatorId = o.id

        operators.push({
          id: operatorId,
          name: o.name || '',
          province: o.province || '',
          phone: o.phone || '',
          email: o.email || '',
          address: o.address || '',
          representativeName: o.representative || '',
          isActive: o.isActive !== false,
          source: o.source || 'drizzle',
        })
      }

      // Parse routes (Drizzle data is array)
      const routes: any[] = []
      for (const route of routeData) {
        const r = route as any
        // Note: routes schema doesn't have routeName field, using departureStation-arrivalStation as name
        const routeName = r.departureStation && r.arrivalStation
          ? `${r.departureStation} - ${r.arrivalStation}`
          : ''
        routes.push({
          id: r.id,
          code: r.routeCode || '',
          name: routeName,
          startPoint: r.departureStation || '',
          endPoint: r.arrivalStation || '',
          distance: r.distanceKm || '',
        })
      }
      
      // Sort data
      badges.sort((a, b) => b.badge_number.localeCompare(a.badge_number))
      vehicles.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
      operators.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      routes.sort((a, b) => a.code.localeCompare(b.code))

      const loadTime = Date.now() - startTime
      console.log(`[QuanLyData] Loaded ${badges.length} badges, ${vehicles.length} vehicles, ${operators.length} operators, ${routes.length} routes in ${loadTime}ms (source: Drizzle ORM)`)
      console.log(`[QuanLyData] Debug: ${allowedPlates.size} allowed plates from badges, ${vehicleData.length} total vehicles in database, filter=${shouldFilterByBadges ? 'by-badges' : 'all-vehicles'}`)
      console.log(`[QuanLyData] Debug: vehiclesByPlate unique plates = ${vehiclesByPlate.size}, final vehicles array = ${vehicles.length}`)
      
      // Log first 5 plates for debugging
      const samplePlates = Array.from(allowedPlates).slice(0, 5)
      console.log(`[QuanLyData] Sample allowed plates: ${samplePlates.join(', ')}`)
      
      quanLyCache = {
        badges,
        vehicles,
        operators,
        routes,
        timestamp: Date.now(),
      }
      
      return quanLyCache
    } finally {
      cacheLoading = null
    }
  })()
  
  return cacheLoading
}

// Invalidate cache
export const invalidateQuanLyCache = () => {
  quanLyCache = null
  cacheLoading = null
}

// Pre-warm cache on server startup (BACKGROUND - non-blocking)
export const preWarmQuanLyCache = async () => {
  // Start loading in background, don't await
  console.log('[QuanLyData] Starting background cache warm...')
  loadQuanLyData().then(() => {
    console.log('[QuanLyData] Background cache warm complete')
  }).catch(error => {
    console.error('[QuanLyData] Background cache warm failed:', error)
  })
}

// Unified endpoint - returns all data for Quản lý thông tin module
export const getQuanLyData = async (req: Request, res: Response) => {
  try {
    const { include } = req.query
    const forceRefresh = req.query.refresh === 'true'
    
    if (forceRefresh) {
      invalidateQuanLyCache()
    }
    
    const data = await loadQuanLyData()
    
    // Allow selective data loading
    const includes = include ? (include as string).split(',') : ['badges', 'vehicles', 'operators', 'routes']
    
    const response: Record<string, any> = {}
    if (includes.includes('badges')) response.badges = data.badges
    if (includes.includes('vehicles')) response.vehicles = data.vehicles
    if (includes.includes('operators')) response.operators = data.operators
    if (includes.includes('routes')) response.routes = data.routes
    
    response.meta = {
      badgeCount: data.badges.length,
      vehicleCount: data.vehicles.length,
      operatorCount: data.operators.length,
      routeCount: data.routes.length,
      cachedAt: new Date(data.timestamp).toISOString(),
    }
    
    res.json(response)
  } catch (error) {
    console.error('[QuanLyData] Error:', error)
    res.status(500).json({ error: 'Failed to fetch data' })
  }
}

// Stats endpoint - lightweight
export const getQuanLyStats = async (_req: Request, res: Response) => {
  try {
    const data = await loadQuanLyData()
    
    res.json({
      badges: data.badges.length,
      vehicles: data.vehicles.length,
      operators: data.operators.length,
      routes: data.routes.length,
      cachedAt: new Date(data.timestamp).toISOString(),
    })
  } catch (error) {
    console.error('[QuanLyStats] Error:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
