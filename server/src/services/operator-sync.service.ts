/**
 * Operator Sync Service
 * Automatically syncs operators from Google Sheets to Firebase
 * Runs every 5 minutes (configurable)
 */

import https from 'https'
import { firebaseDb } from '../config/database.js'
import { invalidateOperatorCache } from '../controllers/operator.controller.js'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DCH1-efRqLMSXoIr_jm-5v_C1XpPrnWKultMp7FXn3g/gviz/tq?tqx=out:csv&sheet=THONGTINDONVIVANTAI'
const SYNC_INTERVAL = 30 * 60 * 1000 // 30 minutes

let syncTimer: NodeJS.Timeout | null = null
let lastSyncTime: Date | null = null
let lastSyncCount: number = 0
let isSyncing = false

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
  const operators: any[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj: any = {}
    
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || ''
    })
    
    // Skip empty rows and invalid IDs
    const id = obj.IDDoanhNghiep
    const name = obj.TenDoanhNghiep
    
    // Validate ID - must be alphanumeric and not contain special prefixes
    const isValidId = id && 
        id.length > 0 &&
        id.length < 50 && 
        !id.includes(',') && 
        !id.includes('.') && 
        !id.includes('#') && 
        !id.includes('$') && 
        !id.includes('/') && 
        !id.includes('[') && 
        !id.includes(']') &&
        !id.includes(':') &&      // Exclude keys like "CQCapDKKD: ..."
        !id.includes('→') &&      // Exclude keys with arrow
        !id.startsWith('•') &&    // Exclude bullet points
        !id.startsWith('DiaChi') &&
        !id.startsWith('SoNha') &&
        !id.startsWith('CQCap')
    
    // Validate name - must have actual content
    const isValidName = name && name.trim().length > 2
    
    if (isValidId && isValidName) {
      operators.push(obj)
    }
  }
  
  return operators
}

// Convert sheet operator to Firebase format
function toFirebaseFormat(op: any) {
  const addressParts = [
    op.SoNha_TDP,
    op.XaPhuongThiTran,
    op.QuanHuyen,
    op.TinhThanh
  ].filter(p => p && p.trim())
  
  return {
    id: op.IDDoanhNghiep,
    name: op.TenDoanhNghiep,
    province: op.TinhThanh || '',
    district: op.QuanHuyen || '',
    ward: op.XaPhuongThiTran || '',
    address: op.SoNha_TDP || '',
    full_address: op.DiachiDayDu || addressParts.join(', '),
    phone: op.SoDienThoai || '',
    email: op.Email || '',
    tax_code: op.MaSoThue || '',
    business_license: op.SoDKKD || '',
    business_license_date: op.NgayCap || '',
    business_license_authority: op.CQCapDKKD || '',
    representative_name: op.NguoiDaiDienTheoPhapLuat || '',
    business_type: op.LoaiHinh || '',
    registration_province: op.TinhDangKyHoatDong || '',
    source: 'google_sheets',
    synced_at: new Date().toISOString()
  }
}

// Main sync function
export async function syncOperatorsFromSheets(): Promise<{ success: boolean; count: number; error?: string }> {
  if (isSyncing) {
    return { success: false, count: 0, error: 'Sync already in progress' }
  }
  
  isSyncing = true
  
  try {
    console.log('[OperatorSync] Starting sync from Google Sheets...')
    
    // Fetch CSV
    const csv = await fetchCSV(SHEET_URL)
    
    // Parse CSV
    const sheetOperators = parseCSV(csv)
    console.log(`[OperatorSync] Found ${sheetOperators.length} operators in sheet`)
    
    // Convert to Firebase format
    const firebaseOperators: Record<string, any> = {}
    sheetOperators.forEach(op => {
      const fbOp = toFirebaseFormat(op)
      firebaseOperators[op.IDDoanhNghiep] = fbOp
    })
    
    // Upload to Firebase
    await firebaseDb.ref('datasheet/DONVIVANTAI').set(firebaseOperators)
    
    // Invalidate operator cache so next API call gets fresh data
    invalidateOperatorCache()
    
    lastSyncTime = new Date()
    lastSyncCount = sheetOperators.length
    
    console.log(`[OperatorSync] ✅ Successfully synced ${sheetOperators.length} operators at ${lastSyncTime.toISOString()}`)
    
    return { success: true, count: sheetOperators.length }
  } catch (error: any) {
    console.error('[OperatorSync] ❌ Error syncing operators:', error.message)
    return { success: false, count: 0, error: error.message }
  } finally {
    isSyncing = false
  }
}

// Start the cron job
export function startOperatorSyncCron(intervalMs: number = SYNC_INTERVAL): void {
  if (syncTimer) {
    console.log('[OperatorSync] Cron already running, skipping start')
    return
  }
  
  console.log(`[OperatorSync] Starting cron job (interval: ${intervalMs / 1000 / 60} minutes)`)
  
  // Run initial sync
  syncOperatorsFromSheets()
  
  // Set up interval
  syncTimer = setInterval(() => {
    syncOperatorsFromSheets()
  }, intervalMs)
  
  console.log('[OperatorSync] Cron job started successfully')
}

// Stop the cron job
export function stopOperatorSyncCron(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
    console.log('[OperatorSync] Cron job stopped')
  }
}

// Get sync status
export function getOperatorSyncStatus(): {
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
