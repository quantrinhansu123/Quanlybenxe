/**
 * Migration Script: Old Firebase RTDB to New RTDB
 * 
 * Migrates data from webbenxe-default-rtdb to benxe-management-20251218-default-rtdb:
 * - datasheet/Xe -> datasheet/Xe
 * - datasheet/DANHMUCTUYENCODINH -> datasheet/DANHMUCTUYENCODINH
 * 
 * Uses REST API to read from old RTDB and Firebase Admin SDK to write to new RTDB
 * 
 * Run with: npx tsx src/scripts/migrate-old-rtdb-to-firestore.ts
 * 
 * Optional flags:
 * --dry-run    (simulate without writing)
 * --xe-only    (migrate only Xe)
 * --tuyen-only (migrate only DANHMUCTUYENCODINH)
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getDatabase, Database } from 'firebase-admin/database'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config()

// Old RTDB URL (REST API - source)
const OLD_RTDB_REST_URL = 'https://webbenxe-default-rtdb.asia-southeast1.firebasedatabase.app'

// New RTDB URL (target)
const NEW_RTDB_URL = process.env.RTDB_URL || 'https://benxe-management-20251218-default-rtdb.asia-southeast1.firebasedatabase.app'

// Service account path
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH

let app: App | null = null
let newDb: Database | null = null

// Initialize Firebase for new RTDB (target database)
function initializeNewRTDB() {
  if (app) return

  if (!getApps().length) {
    if (SERVICE_ACCOUNT_PATH) {
      const absolutePath = resolve(process.cwd(), SERVICE_ACCOUNT_PATH)
      const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf-8'))
      app = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: NEW_RTDB_URL
      })
    } else {
      app = initializeApp({
        databaseURL: NEW_RTDB_URL
      })
    }
  } else {
    app = getApps()[0]
  }

  newDb = getDatabase(app)
}

// Fetch data from old RTDB using REST API
async function fetchFromOldRTDB(path: string): Promise<any> {
  const url = `${OLD_RTDB_REST_URL}/${path}.json`
  console.log(`    Fetching from ${url}...`)
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    xeOnly: args.includes('--xe-only'),
    tuyenOnly: args.includes('--tuyen-only'),
  }
}

// Transform Xe data - based on actual field names from old RTDB
function transformXe(key: string, data: any) {
  if (!data) return null // Skip null records
  
  return {
    id: key,
    plate_number: data.BienSo || '',
    vehicle_type: data.LoaiXe || '',
    vehicle_category: data.LoaiPhuongTien || '',
    seat_count: parseInt(data.SoCho || '0', 10) || 0,
    load_capacity: parseFloat(data.TaiTrong || '0') || 0,
    manufacturer: data.NhanHieu || '',
    manufacture_year: parseInt(data.NamSanXuat || '0', 10) || 0,
    color: data.MauSon || '',
    engine_number: data.SoMay || '',
    chassis_number: data.SoKhung || '',
    owner_name: data.TenDangKyXe || '',
    owner_address: data.DiaChiChuXe || '',
    has_transport_business: data.CoKDVT || '',
    is_identified_plate: data.LaBienDinhDanh || '',
    identified_plate_status: data.TrangThaiBienDinhDanh || '',
    identified_plate_revoke_reason: data.LyDoThuBienDinhDanh || '',
    validity_years: data.NienHan || data.Nienhan || '',
    import_time: data.ThoiGianNhap || '',
    registration_info: data.ThongTinDangKyXe || '',
    import_status: data.Column_26 || '',
    user: data.User || '',
    internal_id: data.IDXe || '',
    // Keep original data for reference
    _original: data,
    _migrated_at: new Date().toISOString(),
    _source: 'webbenxe-default-rtdb/datasheet/Xe'
  }
}

// Transform DANHMUCTUYENCODINH data - based on actual field names from old RTDB
function transformTuyen(key: string, data: any) {
  if (!data) return null // Skip null records
  
  return {
    id: key,
    route_code: data.MaSoTuyen || '',
    route_code_old: data.MaSoTuyen_Cu || '',
    route_code_fixed: data.MaSoTuyen_Fix || '',
    route_type: data.PhanLoaiTuyen || '',
    departure_station: data.BenDi || '',
    departure_station_ref: data.BenDi_Ref || '',
    departure_province: data.TinhDi || '',
    departure_province_old: data.TinhDi_Cu || '',
    arrival_station: data.BenDen || '',
    arrival_station_ref: data.BenDen_Ref || '',
    arrival_province: data.TinhDen || '',
    arrival_province_old: data.TinhDen_Cu || '',
    route_path: data.HanhTrinh || '',
    distance_km: parseFloat(data.CuLyTuyen_km || '0') || 0,
    min_interval_minutes: parseInt(data.GianCachToiThieu_phut || '0', 10) || 0,
    total_trips_month: parseInt(data.TongChuyenThang || '0', 10) || 0,
    trips_in_operation: parseInt(data.ChuyenDaKhaiThac || '0', 10) || 0,
    remaining_capacity: parseInt(data.LuuLuongConLai || '0', 10) || 0,
    operation_status: data.TinhTrangKhaiThac || '',
    decision_number: data.SoQuyetDinh || '',
    decision_date: data.NgayBanHanh || '',
    issuing_authority: data.DonViBanHanh || '',
    calendar_type: data.Kieulich || '',
    file_path: data.File || '',
    notes: data.Ghichu || '',
    original_info: data.ThongTinTuyenGoc || '',
    import_time: data.ThoiGianNhap || '',
    user: data.User || '',
    // Province codes
    departure_province_code_new: data.TinhdiN || '',
    departure_province_code_old: data.TinhdiO || '',
    arrival_province_code_new: data.TinhdenN || '',
    arrival_province_code_old: data.TinhdenO || '',
    departure_station_code_new: data.BendiN || '',
    departure_station_code_old: data.BendiO || '',
    arrival_station_code_new: data.BendenN || '',
    arrival_station_code_old: data.BendenO || '',
    province_code_fo: data.TinhdenFO || '',
    route_class: data.MaO || '',
    // Keep original data for reference
    _original: data,
    _migrated_at: new Date().toISOString(),
    _source: 'webbenxe-default-rtdb/datasheet/DANHMUCTUYENCODINH'
  }
}

// Migrate a collection
async function migrateCollection(
  rtdbPath: string,
  targetPath: string,
  transformer: (key: string, data: any) => any,
  dryRun: boolean
) {
  console.log(`\n  Migrating: ${rtdbPath} -> ${targetPath}`)
  
  const stats = { total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] as string[] }

  try {
    // Fetch from old RTDB via REST API
    const data = await fetchFromOldRTDB(rtdbPath)

    if (!data) {
      console.log(`    No data found`)
      return stats
    }

    const keys = Object.keys(data)
    stats.total = keys.length
    console.log(`    Found ${stats.total} records`)

    // Filter out null records
    const validKeys = keys.filter(k => data[k] !== null)
    const nullCount = keys.length - validKeys.length
    if (nullCount > 0) {
      console.log(`    Skipping ${nullCount} null records`)
    }
    stats.total = validKeys.length

    if (dryRun) {
      console.log(`    [DRY RUN] Would migrate ${stats.total} valid records`)
      // Show sample data
      const sampleKey = validKeys[0]
      if (sampleKey) {
        console.log(`    Sample record (${sampleKey}):`)
        const sample = transformer(sampleKey, data[sampleKey])
        console.log(JSON.stringify(sample, null, 2).split('\n').slice(0, 20).join('\n'))
      }
      stats.migrated = stats.total
      return stats
    }

    // Check what already exists in target
    console.log(`    Checking existing data in target...`)
    const existingSnap = await newDb!.ref(targetPath).once('value')
    const existingData = existingSnap.val() || {}
    const existingKeys = new Set(Object.keys(existingData))
    
    // Filter keys that don't exist yet
    const keysToMigrate = validKeys.filter(k => !existingKeys.has(k))
    stats.skipped = validKeys.length - keysToMigrate.length
    
    if (stats.skipped > 0) {
      console.log(`    Skipping ${stats.skipped} existing records`)
    }
    
    if (keysToMigrate.length === 0) {
      console.log(`    All records already exist, nothing to migrate`)
      return stats
    }

    // Write to new RTDB in batches
    const batchSize = 1000
    const totalBatches = Math.ceil(keysToMigrate.length / batchSize)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize
      const endIdx = Math.min(startIdx + batchSize, keysToMigrate.length)
      const batchKeys = keysToMigrate.slice(startIdx, endIdx)

      // Build batch update object
      const updates: Record<string, any> = {}

      for (const key of batchKeys) {
        try {
          const transformed = transformer(key, data[key])
          if (transformed) {
            updates[key] = transformed
            stats.migrated++
          }
        } catch (err: any) {
          stats.failed++
          stats.errors.push(`${key}: ${err.message}`)
        }
      }

      // Write batch to RTDB
      if (Object.keys(updates).length > 0) {
        await newDb!.ref(targetPath).update(updates)
      }

      const progress = (((batchIndex + 1) / totalBatches) * 100).toFixed(1)
      process.stdout.write(`\r    Progress: ${progress}% (${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.failed} failed)`)
    }

    console.log() // New line
  } catch (error: any) {
    console.error(`    Error: ${error.message}`)
    stats.errors.push(`Collection error: ${error.message}`)
  }

  return stats
}

// Main
async function main() {
  const { dryRun, xeOnly, tuyenOnly } = parseArgs()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  OLD RTDB TO FIRESTORE MIGRATION')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`  Source: ${OLD_RTDB_REST_URL}`)
  console.log(`  Target: ${NEW_RTDB_URL}`)
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE MIGRATION'}`)
  console.log('')

  initializeNewRTDB()

  const startTime = Date.now()
  const allStats = []

  // Migrate Xe
  if (!tuyenOnly) {
    const xeStats = await migrateCollection(
      'datasheet/Xe',
      'datasheet/Xe',
      transformXe,
      dryRun
    )
    allStats.push({ name: 'datasheet/Xe', ...xeStats })
  }

  // Migrate DANHMUCTUYENCODINH
  if (!xeOnly) {
    const tuyenStats = await migrateCollection(
      'datasheet/DANHMUCTUYENCODINH',
      'datasheet/DANHMUCTUYENCODINH',
      transformTuyen,
      dryRun
    )
    allStats.push({ name: 'datasheet/DANHMUCTUYENCODINH', ...tuyenStats })
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  MIGRATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  for (const stats of allStats) {
    console.log(`  ${stats.name}`)
    console.log(`    Total: ${stats.total} | Migrated: ${stats.migrated} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`)
    if (stats.errors.length > 0) {
      console.log(`    Errors: ${stats.errors.slice(0, 3).join(', ')}`)
    }
    console.log('')
  }

  console.log(`  Duration: ${duration}s`)
  console.log('')

  if (dryRun) {
    console.log('  Dry run complete. Run without --dry-run to perform actual migration.')
  } else {
    console.log('  Migration completed!')
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
