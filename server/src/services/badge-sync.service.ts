/**
 * Badge Sync Service
 * Automatically syncs vehicle badges from Google Sheets to Firebase
 * Runs every 15 minutes (after vehicle sync)
 */

import https from 'https'
import { firebaseDb } from '../config/database.js'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&gid=1560762265'
const SYNC_INTERVAL = 2 * 60 * 60 * 1000 // 2 hours - badge data rarely changes

let syncTimer: NodeJS.Timeout | null = null
let lastSyncTime: Date | null = null
let lastSyncCount: number = 0
let isSyncing = false

// Export function to invalidate cache (placeholder for future cache implementation)
export const invalidateBadgeCache = () => {
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
    .replace(/H���p/g, 'Hợp')
    .replace(/c��� /g, 'cố ')
    .replace(/t��i/g, 'tải')
    .replace(/t���i/g, 'tải')
    .replace(/Hi��u/g, 'Hiệu')
    .replace(/Hi���u/g, 'Hiệu')
    .replace(/l��c/g, 'lực')
    .replace(/l���c/g, 'lực')
    .replace(/h���i/g, 'hồi')
    .replace(/h��i/g, 'hồi')
    .replace(/H��t/g, 'Hết')
    .replace(/hi���u/g, 'hiệu')
    .replace(/hi��u/g, 'hiệu')
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
  const badges: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj: any = {}
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    const id = obj.ID_PhuHieu
    const isValidId = id && 
        id.length > 0 &&
        id.length < 50 && 
        !id.includes(':') &&
        !id.includes('→') &&
        !id.startsWith('•')
    
    if (isValidId) {
      badges.push(obj)
    }
  }
  
  return badges
}

// Convert sheet badge to Firebase format
function toFirebaseFormat(b: any) {
  return {
    id: b.ID_PhuHieu,
    file_number: b.MaHoSo || '',
    badge_type: fixEncoding(b.LoaiPH),
    badge_number: b.SoPhuHieu || '',
    vehicle_id: b.BienSoXe || '',
    warning_duplicate_plate: b.CanhBaoTrungBienSoKhiCapPH || '',
    issuing_authority_ref: b.Ref_DonViCapPhuHieu || '',
    business_license_ref: b.Ref_GPKD || '',
    notification_ref: b.Ref_ThongBao || '',
    route_ref: b.Ref_Tuyen || '',
    bus_route_ref: b.Ref_TuyenBuyt || '',
    issue_date: b.NgayCap || '',
    expiry_date: b.NgayHetHan || '',
    issue_type: fixEncoding(b.LoaiCap),
    reissue_reason: fixEncoding(b.LyDoCapLai),
    old_badge_number: b.SoPhuHieuCu || '',
    status: fixEncoding(b.TrangThai),
    email_sent: b.GuiEmailbao === 'true' || b.GuiEmailbao === '1',
    revoke_decision: b.QDThuHoi || '',
    revoke_reason: fixEncoding(b.LyDoThuHoi),
    revoke_date: b.NgayThuHoi || '',
    replacement_vehicle: b.XeThayThe || '',
    badge_color: fixEncoding(b.MauPhuHieu),
    notes: fixEncoding(b.GhiChu),
    user: b.User || '',
    import_time: b.ThoiGianNhap || '',
    need_reissue_popup: b.CanCapLaiPopup === 'true' || b.CanCapLaiPopup === '1',
    vehicle_replaced: b.Xebithaythe || '',
    issue_deadline: b.Hancap || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

// Main sync function
export async function syncBadgesFromSheets(): Promise<{ success: boolean; count: number; error?: string }> {
  if (isSyncing) {
    return { success: false, count: 0, error: 'Sync already in progress' }
  }
  
  isSyncing = true
  
  try {
    console.log('[BadgeSync] Starting sync from Google Sheets...')
    
    const csv = await fetchCSV(SHEET_URL)
    const sheetBadges = parseCSV(csv)
    console.log(`[BadgeSync] Found ${sheetBadges.length} badges in sheet`)
    
    const firebaseBadges: Record<string, any> = {}
    sheetBadges.forEach(b => {
      const fbB = toFirebaseFormat(b)
      firebaseBadges[b.ID_PhuHieu] = fbB
    })
    
    await firebaseDb.ref('datasheet/PHUHIEUXE').set(firebaseBadges)
    
    // Invalidate cache
    invalidateBadgeCache()
    
    lastSyncTime = new Date()
    lastSyncCount = sheetBadges.length
    
    console.log(`[BadgeSync] ✅ Successfully synced ${sheetBadges.length} badges at ${lastSyncTime.toISOString()}`)
    
    return { success: true, count: sheetBadges.length }
  } catch (error: any) {
    console.error('[BadgeSync] ❌ Error syncing badges:', error.message)
    return { success: false, count: 0, error: error.message }
  } finally {
    isSyncing = false
  }
}

// Start the cron job
export function startBadgeSyncCron(intervalMs: number = SYNC_INTERVAL): void {
  if (syncTimer) {
    console.log('[BadgeSync] Cron already running, skipping start')
    return
  }
  
  console.log(`[BadgeSync] Starting cron job (interval: ${intervalMs / 1000 / 60} minutes)`)
  
  // Don't run initial sync - data was just synced manually
  // syncBadgesFromSheets()
  
  syncTimer = setInterval(() => {
    syncBadgesFromSheets()
  }, intervalMs)
  
  console.log('[BadgeSync] Cron job started successfully')
}

// Stop the cron job
export function stopBadgeSyncCron(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
    console.log('[BadgeSync] Cron job stopped')
  }
}

// Get sync status
export function getBadgeSyncStatus(): {
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
