/**
 * Route Sync Service
 * Automatically syncs routes from Google Sheets to Firebase
 * Runs every 30 minutes
 */

import https from 'https'
import { firebaseDb } from '../config/database.js'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&gid=328499076'
const SYNC_INTERVAL = 30 * 60 * 1000 // 30 minutes

let syncTimer: NodeJS.Timeout | null = null
let lastSyncTime: Date | null = null
let lastSyncCount: number = 0
let isSyncing = false

// Export function to invalidate cache (placeholder for future cache implementation)
export const invalidateRouteCache = () => {
  // Will be used when caching is implemented
}

// Fix common Unicode encoding issues
function fixEncoding(str: string | undefined): string {
  if (!str) return ''
  return str
    // Bắc Ninh fixes
    .replace(/B��c/g, 'Bắc')
    .replace(/B���c/g, 'Bắc')
    // Đã công bố fixes
    .replace(/Đ��/g, 'Đã')
    .replace(/Đ���/g, 'Đã')
    .replace(/��ã/g, 'Đã')
    .replace(/c��ng/g, 'công')
    .replace(/c���ng/g, 'công')
    .replace(/b���/g, 'bố')
    .replace(/b��/g, 'bố')
    // Tuyến fixes
    .replace(/Tuy��n/g, 'Tuyến')
    .replace(/Tuy���n/g, 'Tuyến')
    // Other common fixes
    .replace(/Li��n/g, 'Liên')
    .replace(/Li���n/g, 'Liên')
    .replace(/t��nh/g, 'tỉnh')
    .replace(/t���nh/g, 'tỉnh')
    .replace(/đ���ng/g, 'đồng')
    .replace(/đ��ng/g, 'đồng')
    .trim()
}

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

// Fetch CSV from Google Sheets
function fetchCSV(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// Parse CSV to objects
function parseCSV(csv: string): any[] {
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  const headers = parseCSVLine(lines[0])
  const routes: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj: any = {}
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    const routeCode = obj.MaSoTuyen || obj.MaSoTuyen_Fix
    const isValid = routeCode && 
        routeCode.length > 0 &&
        routeCode.length < 100 && 
        !routeCode.includes(':') &&
        !routeCode.startsWith('•')
    
    if (isValid) {
      routes.push(obj)
    }
  }
  
  return routes
}

// Convert sheet route to Firebase format
function toFirebaseFormat(r: any) {
  return {
    id: r.MaSoTuyen || r.MaSoTuyen_Fix,
    route_code: r.MaSoTuyen || r.MaSoTuyen_Fix || '',
    route_code_old: r.MaSoTuyen_Cu || '',
    original_info: r.ThongTinTuyenGoc || '',
    departure_province: fixEncoding(r.TinhDi),
    arrival_province: fixEncoding(r.TinhDen),
    departure_station: fixEncoding(r.BenDi),
    departure_station_ref: r.BenDi_Ref || '',
    arrival_station: fixEncoding(r.BenDen),
    arrival_station_ref: r.BenDen_Ref || '',
    itinerary: fixEncoding(r.HanhTrinh),
    route_type: fixEncoding(r.PhanLoaiTuyen),
    operation_status: fixEncoding(r.TinhTrangKhaiThac),
    distance_km: r.CuLyTuyen_km ? parseFloat(r.CuLyTuyen_km) || 0 : 0,
    total_trips_per_month: r.TongChuyenThang ? parseInt(r.TongChuyenThang) || 0 : 0,
    trips_operated: r.ChuyenDaKhaiThac ? parseInt(r.ChuyenDaKhaiThac) || 0 : 0,
    remaining_capacity: r.LuuLuongConLai ? parseInt(r.LuuLuongConLai) || 0 : 0,
    min_interval_minutes: r.GianCachToiThieu_phut ? parseInt(r.GianCachToiThieu_phut) || 0 : 0,
    decision_number: r.SoQuyetDinh || '',
    decision_date: r.NgayBanHanh || '',
    issuing_authority: fixEncoding(r.DonViBanHanh),
    document_file: r.File || '',
    calendar_type: r.Kieulich || '',
    notes: fixEncoding(r.Ghichu),
    user: r.User || '',
    import_time: r.ThoiGianNhap || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

// Generate a valid Firebase key from route code
function toFirebaseKey(routeCode: string): string {
  return routeCode
    .replace(/\./g, '_')
    .replace(/#/g, '_')
    .replace(/\$/g, '_')
    .replace(/\//g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
}

// Main sync function
export async function syncRoutesFromSheets(): Promise<{ success: boolean; count: number; error?: string }> {
  if (isSyncing) {
    return { success: false, count: 0, error: 'Sync already in progress' }
  }
  
  isSyncing = true
  
  try {
    console.log('[RouteSync] Starting sync from Google Sheets...')
    
    const csv = await fetchCSV(SHEET_URL)
    const sheetRoutes = parseCSV(csv)
    console.log(`[RouteSync] Found ${sheetRoutes.length} routes in sheet`)
    
    const firebaseRoutes: Record<string, any> = {}
    sheetRoutes.forEach(r => {
      const fbRoute = toFirebaseFormat(r)
      const key = toFirebaseKey(fbRoute.route_code)
      firebaseRoutes[key] = fbRoute
    })
    
    await firebaseDb.ref('datasheet/DANHMUCTUYENCODINH').set(firebaseRoutes)
    
    invalidateRouteCache()
    
    lastSyncTime = new Date()
    lastSyncCount = sheetRoutes.length
    
    console.log(`[RouteSync] ✅ Successfully synced ${sheetRoutes.length} routes at ${lastSyncTime.toISOString()}`)
    
    return { success: true, count: sheetRoutes.length }
  } catch (error: any) {
    console.error('[RouteSync] ❌ Error syncing routes:', error.message)
    return { success: false, count: 0, error: error.message }
  } finally {
    isSyncing = false
  }
}

// Start the cron job
export function startRouteSyncCron(intervalMs: number = SYNC_INTERVAL): void {
  if (syncTimer) {
    console.log('[RouteSync] Cron already running, skipping start')
    return
  }
  
  console.log(`[RouteSync] Starting cron job (interval: ${intervalMs / 1000 / 60} minutes)`)
  
  syncTimer = setInterval(() => {
    syncRoutesFromSheets()
  }, intervalMs)
  
  console.log('[RouteSync] Cron job started successfully')
}

// Stop the cron job
export function stopRouteSyncCron(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
    console.log('[RouteSync] Cron job stopped')
  }
}

// Get sync status
export function getRouteSyncStatus(): {
  isRunning: boolean
  isSyncing: boolean
  lastSyncTime: string | null
  lastSyncCount: number
  nextSyncIn: number | null
} {
  return {
    isRunning: syncTimer !== null,
    isSyncing,
    lastSyncTime: lastSyncTime?.toISOString() || null,
    lastSyncCount,
    nextSyncIn: syncTimer ? SYNC_INTERVAL : null
  }
}
