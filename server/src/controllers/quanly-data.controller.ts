import { Request, Response } from 'express'
import { firebaseDb } from '../config/database.js'

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

// Extract seat count from registration_info text
const extractSeatCount = (registrationInfo: string): number => {
  if (!registrationInfo) return 0
  // Match patterns like "Số người cho phép chở (ngồi): 45 người" or "số chỗ ngồi: 16"
  const patterns = [
    /Số người cho phép chở[^:]*:\s*(\d+)/i,
    /số chỗ ngồi[^:]*:\s*(\d+)/i,
    /\(ngồi\):\s*(\d+)/i,
    /chở được\s*(\d+)\s*người/i,
  ]
  for (const pattern of patterns) {
    const match = registrationInfo.match(pattern)
    if (match) return parseInt(match[1]) || 0
  }
  return 0
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
      const startTime = Date.now()
      
      // Load all data in parallel from Firebase RTDB
      const [badgeSnapshot, vehicleSnapshot, operatorSnapshot, routeSnapshot] = await Promise.all([
        firebaseDb.ref('datasheet/PHUHIEUXE').once('value'),
        firebaseDb.ref('datasheet/Xe').once('value'),
        firebaseDb.ref('datasheet/DONVIVANTAI').once('value'),
        firebaseDb.ref('datasheet/DANHMUCTUYENCODINH').once('value'),
      ])
      
      const badgeData = badgeSnapshot.val() || {}
      const vehicleData = vehicleSnapshot.val() || {}
      const operatorData = operatorSnapshot.val() || {}
      const routeData = routeSnapshot.val() || {}
      
      // Build vehicle plate lookup
      const vehiclePlateMap = new Map<string, string>()
      for (const [key, vehicle] of Object.entries(vehicleData)) {
        const v = vehicle as any
        const plate = v.plate_number || v.BienSo || ''
        if (plate) {
          vehiclePlateMap.set(key, plate)
        }
      }
      
      // Build operator name lookup from DONVIVANTAI
      const operatorNameMap = new Map<string, string>()
      for (const [key, op] of Object.entries(operatorData)) {
        const o = op as any
        const operatorId = o.id || key
        operatorNameMap.set(operatorId, o.name || '')
      }
      
      // Filter badges by allowed types and build plate set + vehicle-operator mapping
      const allowedPlates = new Set<string>()
      const operatorIdsWithBadges = new Set<string>()
      const vehicleOperatorMap = new Map<string, string>() // plate -> operator name
      const vehicleBadgeExpiryMap = new Map<string, string>() // plate -> badge expiry date
      const badges: any[] = []
      
      for (const [key, badge] of Object.entries(badgeData)) {
        const b = badge as any
        const badgeType = b.LoaiPH || b.badge_type || ''
        
        if (!ALLOWED_BADGE_TYPES.includes(badgeType)) continue
        
        // Get plate number (resolve from vehicle_id if needed)
        let plateNumber = b.BienSoXe || b.vehicle_id || ''
        const vehicleId = b.vehicle_id || ''
        if (vehiclePlateMap.has(vehicleId)) {
          plateNumber = vehiclePlateMap.get(vehicleId)!
        }
        
        if (plateNumber) {
          const normalizedPlate = normalizePlate(plateNumber)
          allowedPlates.add(normalizedPlate)
          
          // Map vehicle plate to operator name from badge's issuing authority
          const issuingAuth = b.Ref_DonViCapPhuHieu || b.issuing_authority_ref || ''
          if (issuingAuth && operatorNameMap.has(issuingAuth)) {
            vehicleOperatorMap.set(normalizedPlate, operatorNameMap.get(issuingAuth)!)
          }
          
          // Map vehicle plate to badge expiry date
          const badgeExpiry = b.NgayHetHan || b.expiry_date || ''
          if (badgeExpiry) {
            vehicleBadgeExpiryMap.set(normalizedPlate, badgeExpiry)
          }
        }
        
        // Track operator IDs
        const issuingAuth = b.Ref_DonViCapPhuHieu || b.issuing_authority_ref || ''
        if (issuingAuth) {
          operatorIdsWithBadges.add(issuingAuth)
        }
        
        badges.push({
          id: b.ID_PhuHieu || key,
          badge_number: b.SoPhuHieu || b.badge_number || '',
          license_plate_sheet: plateNumber,
          badge_type: badgeType,
          badge_color: b.MauPhuHieu || b.badge_color || '',
          issue_date: b.NgayCap || b.issue_date || '',
          expiry_date: b.NgayHetHan || b.expiry_date || '',
          status: b.TrangThai || b.status || '',
          file_code: b.MaHoSo || b.file_number || '',
          issuing_authority_ref: issuingAuth,
          route_id: b.Ref_Tuyen || b.route_ref || '',
          vehicle_type: b.LoaiXe || b.vehicle_type || '',
        })
      }
      
      // Filter vehicles by allowed plates (from badges) - dedupe by normalized plate
      // First pass: collect all matching vehicles grouped by plate
      const vehiclesByPlate = new Map<string, any[]>()
      for (const [key, vehicle] of Object.entries(vehicleData)) {
        const v = vehicle as any
        const plateNumber = v.plate_number || v.BienSo || ''
        const normalizedPlate = normalizePlate(plateNumber)
        
        if (!plateNumber || !allowedPlates.has(normalizedPlate)) continue
        
        if (!vehiclesByPlate.has(normalizedPlate)) {
          vehiclesByPlate.set(normalizedPlate, [])
        }
        vehiclesByPlate.get(normalizedPlate)!.push({ key, v, plateNumber })
      }
      
      // Second pass: for each plate, pick the entry with most data
      const vehicles: any[] = []
      for (const [normalizedPlate, entries] of vehiclesByPlate) {
        // Sort by data completeness: prefer entries with owner_name, seat_count, etc.
        entries.sort((a, b) => {
          const scoreA = (a.v.owner_name ? 2 : 0) + (a.v.seat_count ? 1 : 0) + (a.v.registration_info ? 1 : 0)
          const scoreB = (b.v.owner_name ? 2 : 0) + (b.v.seat_count ? 1 : 0) + (b.v.registration_info ? 1 : 0)
          return scoreB - scoreA // Higher score first
        })
        
        const { key, v, plateNumber } = entries[0]
        
        // Get seat capacity: prefer seat_count, then SoCho, fallback to parsing registration_info
        let seatCapacity = typeof v.seat_count === 'number' ? v.seat_count : (parseInt(v.seat_count) || 0)
        if (!seatCapacity && v.SoCho) {
          // Parse "4 người" or "45" format
          const soCho = String(v.SoCho)
          const match = soCho.match(/(\d+)/)
          if (match) seatCapacity = parseInt(match[1]) || 0
        }
        if (!seatCapacity && v.registration_info) {
          seatCapacity = extractSeatCount(v.registration_info)
        }
        
        // Get operator name: prefer from badge reference, fallback to vehicle owner_name
        const operatorFromBadge = vehicleOperatorMap.get(normalizedPlate) || ''
        const operatorName = operatorFromBadge || v.owner_name || ''
        
        // Get badge expiry date for inspection display
        const badgeExpiryDate = vehicleBadgeExpiryMap.get(normalizedPlate) || ''
        
        vehicles.push({
          id: key,
          plateNumber: plateNumber,
          seatCapacity,
          operatorName,
          vehicleType: v.vehicle_category || v.vehicle_type || '',
          inspectionExpiryDate: badgeExpiryDate || v.inspection_expiry || '',
          isActive: true,
          source: 'google_sheets',
        })
      }
      
      // Filter operators by badge issuing authority refs
      const operators: any[] = []
      for (const [key, op] of Object.entries(operatorData)) {
        const o = op as any
        const operatorId = o.id || key
        
        // Include if operator has badges with allowed types
        if (!operatorIdsWithBadges.has(operatorId) && operatorIdsWithBadges.size > 0) {
          continue
        }
        
        let province = (o.province || '').trim()
        province = province.replace(/^\s*→\s*"?/g, '').replace(/"$/g, '').trim()
        if (province.includes('Tỉnh Tỉnh')) province = province.replace('Tỉnh Tỉnh', 'Tỉnh')
        
        operators.push({
          id: operatorId,
          name: o.name || '',
          province: province,
          phone: o.phone || '',
          email: o.email || '',
          address: o.address || '',
          representativeName: o.representative_name || '',
          isActive: true,
          source: 'google_sheets',
        })
      }
      
      // Parse routes
      const routes: any[] = []
      for (const [key, route] of Object.entries(routeData)) {
        const r = route as any
        routes.push({
          id: key,
          code: r.MaTuyen || r.route_code || '',
          name: r.TenTuyen || r.route_name || '',
          startPoint: r.DiemDi || r.start_point || '',
          endPoint: r.DiemDen || r.end_point || '',
          distance: r.CuLy || r.distance || '',
        })
      }
      
      // Sort data
      badges.sort((a, b) => b.badge_number.localeCompare(a.badge_number))
      vehicles.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
      operators.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      routes.sort((a, b) => a.code.localeCompare(b.code))
      
      const loadTime = Date.now() - startTime
      console.log(`[QuanLyData] Loaded ${badges.length} badges, ${vehicles.length} vehicles, ${operators.length} operators, ${routes.length} routes in ${loadTime}ms`)
      console.log(`[QuanLyData] Debug: ${allowedPlates.size} allowed plates from badges, ${Object.keys(vehicleData).length} total vehicles in datasheet`)
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

// Pre-warm cache on server startup
export const preWarmQuanLyCache = async () => {
  try {
    console.log('[QuanLyData] Pre-warming cache...')
    await loadQuanLyData()
    console.log('[QuanLyData] Cache pre-warmed successfully')
  } catch (error) {
    console.error('[QuanLyData] Failed to pre-warm cache:', error)
  }
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
