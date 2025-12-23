/**
 * Vehicle Sync Service
 * Automatically syncs vehicles from Google Sheets to Firebase
 * Runs every 15 minutes
 */

import https from 'https'
import { firebaseDb } from '../config/database.js'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&gid=40001005'
const SYNC_INTERVAL = 15 * 60 * 1000 // 15 minutes

let syncTimer: NodeJS.Timeout | null = null
let lastSyncTime: Date | null = null
let lastSyncCount: number = 0
let isSyncing = false

// Export function to invalidate cache (placeholder for future cache implementation)
export const invalidateVehicleCache = () => {
  // Will be used when caching is implemented
}

// Fix common Unicode encoding issues
function fixEncoding(str: string | undefined): string {
  if (!str) return ''
  return str
    .replace(/Lo���i/g, 'Loại')
    .replace(/Lo��i/g, 'Loại')
    .replace(/kh��c/g, 'khác')
    .replace(/đ���ng/g, 'đồng')
    .replace(/đ��ng/g, 'đồng')
    .replace(/H��p/g, 'Hợp')
    .replace(/c��� /g, 'cố ')
    .replace(/t��i/g, 'tải')
    .replace(/t���i/g, 'tải')
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
  const vehicles: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj: any = {}
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    const id = obj.IDXe
    const isValidId = id && 
        id.length > 0 &&
        id.length < 50 && 
        !id.includes(':') &&
        !id.includes('→') &&
        !id.startsWith('•')
    
    if (isValidId) {
      vehicles.push(obj)
    }
  }
  
  return vehicles
}

// Convert sheet vehicle to Firebase format
function toFirebaseFormat(v: any) {
  return {
    id: v.IDXe,
    plate_number: v.BienSo || '',
    owner_name: fixEncoding(v.TenDangKyXe),
    owner_address: fixEncoding(v.DiaChiChuXe),
    manufacturer: fixEncoding(v.NhanHieu),
    vehicle_type: fixEncoding(v.LoaiXe),
    vehicle_category: fixEncoding(v.LoaiPhuongTien),
    chassis_number: v.SoKhung || '',
    engine_number: v.SoMay || '',
    seat_count: v.SoCho ? parseInt(v.SoCho) || 0 : 0,
    load_capacity: v.TaiTrong ? parseInt(v.TaiTrong) || 0 : 0,
    color: fixEncoding(v.MauSon),
    manufacture_year: v.NamSanXuat ? parseInt(v.NamSanXuat) || 0 : 0,
    validity_years: v.NienHan || '',
    is_identified_plate: v.LaBienDinhDanh === 'true' || v.LaBienDinhDanh === '1',
    identified_plate_status: fixEncoding(v.TrangThaiBienDinhDanh),
    identified_plate_revoke_reason: fixEncoding(v.LyDoThuBienDinhDanh),
    registration_info: fixEncoding(v.ThongTinDangKyXe),
    has_transport_business: v.CoKDVT === 'true' || v.CoKDVT === '1',
    user: v.User || '',
    import_time: v.ThoiGianNhap || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

// Main sync function
export async function syncVehiclesFromSheets(): Promise<{ success: boolean; count: number; error?: string }> {
  if (isSyncing) {
    return { success: false, count: 0, error: 'Sync already in progress' }
  }
  
  isSyncing = true
  
  try {
    console.log('[VehicleSync] Starting sync from Google Sheets...')
    
    const csv = await fetchCSV(SHEET_URL)
    const sheetVehicles = parseCSV(csv)
    console.log(`[VehicleSync] Found ${sheetVehicles.length} vehicles in sheet`)
    
    const firebaseVehicles: Record<string, any> = {}
    sheetVehicles.forEach(v => {
      const fbV = toFirebaseFormat(v)
      firebaseVehicles[v.IDXe] = fbV
    })
    
    await firebaseDb.ref('datasheet/Xe').set(firebaseVehicles)
    
    // Invalidate cache
    invalidateVehicleCache()
    
    lastSyncTime = new Date()
    lastSyncCount = sheetVehicles.length
    
    console.log(`[VehicleSync] ✅ Successfully synced ${sheetVehicles.length} vehicles at ${lastSyncTime.toISOString()}`)
    
    return { success: true, count: sheetVehicles.length }
  } catch (error: any) {
    console.error('[VehicleSync] ❌ Error syncing vehicles:', error.message)
    return { success: false, count: 0, error: error.message }
  } finally {
    isSyncing = false
  }
}

// Start the cron job
export function startVehicleSyncCron(intervalMs: number = SYNC_INTERVAL): void {
  if (syncTimer) {
    console.log('[VehicleSync] Cron already running, skipping start')
    return
  }
  
  console.log(`[VehicleSync] Starting cron job (interval: ${intervalMs / 1000 / 60} minutes)`)
  
  // Don't run initial sync - data was just synced manually
  // syncVehiclesFromSheets()
  
  syncTimer = setInterval(() => {
    syncVehiclesFromSheets()
  }, intervalMs)
  
  console.log('[VehicleSync] Cron job started successfully')
}

// Stop the cron job
export function stopVehicleSyncCron(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
    console.log('[VehicleSync] Cron job stopped')
  }
}

// Get sync status
export function getVehicleSyncStatus(): {
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
