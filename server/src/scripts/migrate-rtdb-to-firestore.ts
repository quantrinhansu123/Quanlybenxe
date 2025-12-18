/**
 * Migration Script: Firebase Realtime Database to Cloud Firestore
 *
 * This script migrates all data from RTDB to Firestore while:
 * - Preserving document IDs
 * - Applying data transformations where needed
 * - Providing progress updates and error handling
 * - Supporting resume from failures
 *
 * Run with: npx tsx src/scripts/migrate-rtdb-to-firestore.ts
 *
 * Optional flags:
 * --collections=dispatch_records,vehicles  (migrate specific collections)
 * --dry-run                                 (simulate without writing)
 * --batch-size=100                          (custom batch size)
 */

import { firebaseDb } from '../config/database.js'
import { getFirestoreInstance } from '../config/firestore.js'

// Collections to migrate
const COLLECTIONS = [
  'users',
  'operators',
  'locations',
  'vehicles',
  'drivers',
  'driver_operators',
  'routes',
  'route_stops',
  'schedules',
  'dispatch_records',
]

// Migration configuration
interface MigrationConfig {
  batchSize: number
  dryRun: boolean
  collections: string[]
}

// Migration statistics
interface MigrationStats {
  collection: string
  total: number
  migrated: number
  failed: number
  skipped: number
  errors: string[]
}

// Data transformers for specific collections
const dataTransformers: Record<string, (data: any) => any> = {
  // Transform dispatch_records to ensure proper field names
  dispatch_records: (data: any) => ({
    ...data,
    // Ensure denormalized fields exist (from Phase 1)
    vehicle_plate_number: data.vehicle_plate_number || '',
    vehicle_operator_id: data.vehicle_operator_id || null,
    vehicle_operator_name: data.vehicle_operator_name || null,
    vehicle_operator_code: data.vehicle_operator_code || null,
    driver_full_name: data.driver_full_name || '',
    route_name: data.route_name || null,
    route_type: data.route_type || null,
    route_destination_id: data.route_destination_id || null,
    route_destination_name: data.route_destination_name || null,
    route_destination_code: data.route_destination_code || null,
    // Ensure status field
    status: data.status || 'entered',
  }),

  // Ensure vehicles have required fields
  vehicles: (data: any) => ({
    ...data,
    is_active: data.is_active !== false,
    vehicle_type: data.vehicle_type || 'bus',
  }),

  // Ensure drivers have required fields
  drivers: (data: any) => ({
    ...data,
    is_active: data.is_active !== false,
  }),

  // Ensure routes have required fields
  routes: (data: any) => ({
    ...data,
    is_active: data.is_active !== false,
  }),

  // Ensure operators have required fields
  operators: (data: any) => ({
    ...data,
    is_active: data.is_active !== false,
  }),

  // Ensure locations have required fields
  locations: (data: any) => ({
    ...data,
    type: data.type || 'station',
  }),

  // Ensure users have required fields
  users: (data: any) => ({
    ...data,
    is_active: data.is_active !== false,
    role: data.role || 'user',
  }),

  // Ensure schedules have required fields
  schedules: (data: any) => ({
    ...data,
    is_active: data.is_active !== false,
  }),
}

// Parse command line arguments
function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2)
  const config: MigrationConfig = {
    batchSize: 100,
    dryRun: false,
    collections: [...COLLECTIONS],
  }

  for (const arg of args) {
    if (arg === '--dry-run') {
      config.dryRun = true
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--collections=')) {
      config.collections = arg.split('=')[1].split(',')
    }
  }

  return config
}

// Migrate a single collection
async function migrateCollection(
  collectionName: string,
  config: MigrationConfig
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: collectionName,
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n  Migrating: ${collectionName}`)

  try {
    // Fetch all data from RTDB
    const rtdbData = await firebaseDb.get(collectionName)

    if (!rtdbData) {
      console.log(`    No data found in RTDB`)
      return stats
    }

    // Convert to array
    const records = Object.entries(rtdbData).map(([id, data]: [string, any]) => ({
      id,
      ...data,
    }))

    stats.total = records.length
    console.log(`    Found ${stats.total} records`)

    if (config.dryRun) {
      console.log(`    [DRY RUN] Would migrate ${stats.total} records`)
      stats.migrated = stats.total
      return stats
    }

    // Get Firestore instance
    const db = getFirestoreInstance()
    const collectionRef = db.collection(collectionName)

    // Get transformer for this collection
    const transformer = dataTransformers[collectionName] || ((d: any) => d)

    // Process in batches
    const totalBatches = Math.ceil(records.length / config.batchSize)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * config.batchSize
      const endIdx = Math.min(startIdx + config.batchSize, records.length)
      const batchRecords = records.slice(startIdx, endIdx)

      const batch = db.batch()

      for (const record of batchRecords) {
        try {
          // Check if document already exists in Firestore
          const existingDoc = await collectionRef.doc(record.id).get()

          if (existingDoc.exists) {
            stats.skipped++
            continue
          }

          // Transform data
          const transformedData = transformer(record)

          // Add to batch
          batch.set(collectionRef.doc(record.id), transformedData)
          stats.migrated++
        } catch (err: any) {
          stats.failed++
          stats.errors.push(`${record.id}: ${err.message}`)
        }
      }

      // Commit batch
      await batch.commit()

      // Progress update
      const progress = (((batchIndex + 1) / totalBatches) * 100).toFixed(1)
      process.stdout.write(`\r    Progress: ${progress}% (${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.failed} failed)`)
    }

    console.log() // New line after progress
  } catch (error: any) {
    console.error(`    Error: ${error.message}`)
    stats.errors.push(`Collection error: ${error.message}`)
  }

  return stats
}

// Main migration function
async function runMigration() {
  const config = parseArgs()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  RTDB TO FIRESTORE MIGRATION')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`  Mode: ${config.dryRun ? 'DRY RUN (no writes)' : 'LIVE MIGRATION'}`)
  console.log(`  Batch size: ${config.batchSize}`)
  console.log(`  Collections: ${config.collections.join(', ')}`)
  console.log('')

  const startTime = Date.now()
  const allStats: MigrationStats[] = []

  // Migrate each collection
  for (const collection of config.collections) {
    if (!COLLECTIONS.includes(collection)) {
      console.log(`  Skipping unknown collection: ${collection}`)
      continue
    }

    const stats = await migrateCollection(collection, config)
    allStats.push(stats)
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  const totalMigrated = allStats.reduce((sum, s) => sum + s.migrated, 0)
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, 0)
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, 0)

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  MIGRATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // Table header
  console.log('  Collection            | Total | Migrated | Skipped | Failed')
  console.log('  ----------------------|-------|----------|---------|-------')

  // Table rows
  for (const stats of allStats) {
    const name = stats.collection.padEnd(20)
    const total = String(stats.total).padStart(5)
    const migrated = String(stats.migrated).padStart(8)
    const skipped = String(stats.skipped).padStart(7)
    const failed = String(stats.failed).padStart(6)
    console.log(`  ${name} | ${total} | ${migrated} | ${skipped} | ${failed}`)
  }

  console.log('  ----------------------|-------|----------|---------|-------')

  // Totals
  const totalRecords = allStats.reduce((sum, s) => sum + s.total, 0)
  console.log(`  ${'TOTAL'.padEnd(20)} | ${String(totalRecords).padStart(5)} | ${String(totalMigrated).padStart(8)} | ${String(totalSkipped).padStart(7)} | ${String(totalFailed).padStart(6)}`)

  console.log('')
  console.log(`  Duration: ${duration}s`)
  console.log('')

  // Errors
  const allErrors = allStats.flatMap(s => s.errors)
  if (allErrors.length > 0) {
    console.log('  ERRORS:')
    allErrors.slice(0, 10).forEach(err => console.log(`    - ${err}`))
    if (allErrors.length > 10) {
      console.log(`    ... and ${allErrors.length - 10} more errors`)
    }
    console.log('')
  }

  if (totalFailed > 0) {
    console.log('  Some records failed to migrate. Review errors above.')
    process.exit(1)
  } else if (config.dryRun) {
    console.log('  Dry run complete. Run without --dry-run to perform actual migration.')
  } else {
    console.log('  Migration completed successfully!')
  }
}

// Run migration
console.log('')
runMigration()
  .then(() => {
    console.log('')
    console.log('Migration script finished.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Unhandled error:', err)
    process.exit(1)
  })
