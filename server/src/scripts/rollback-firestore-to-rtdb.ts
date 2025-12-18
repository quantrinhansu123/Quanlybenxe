/**
 * Rollback Script: Cloud Firestore to Firebase Realtime Database
 *
 * This script copies data from Firestore back to RTDB in case
 * of issues during migration. It serves as a safety net.
 *
 * Run with: npx tsx src/scripts/rollback-firestore-to-rtdb.ts
 *
 * Optional flags:
 * --collections=dispatch_records,vehicles  (rollback specific collections)
 * --dry-run                                 (simulate without writing)
 * --batch-size=100                          (custom batch size)
 * --overwrite                               (overwrite existing RTDB data)
 */

import { firebaseDb } from '../config/database.js'
import { getFirestoreInstance } from '../config/firestore.js'

// Collections to rollback
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

// Configuration
interface RollbackConfig {
  batchSize: number
  dryRun: boolean
  collections: string[]
  overwrite: boolean
}

// Statistics
interface RollbackStats {
  collection: string
  total: number
  rolled: number
  skipped: number
  failed: number
  errors: string[]
}

// Parse command line arguments
function parseArgs(): RollbackConfig {
  const args = process.argv.slice(2)
  const config: RollbackConfig = {
    batchSize: 100,
    dryRun: false,
    collections: [...COLLECTIONS],
    overwrite: false,
  }

  for (const arg of args) {
    if (arg === '--dry-run') {
      config.dryRun = true
    } else if (arg === '--overwrite') {
      config.overwrite = true
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--collections=')) {
      config.collections = arg.split('=')[1].split(',')
    }
  }

  return config
}

// Rollback a single collection
async function rollbackCollection(
  collectionName: string,
  config: RollbackConfig
): Promise<RollbackStats> {
  const stats: RollbackStats = {
    collection: collectionName,
    total: 0,
    rolled: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  console.log(`\n  Rolling back: ${collectionName}`)

  try {
    // Get Firestore instance
    const firestoreDb = getFirestoreInstance()
    const collectionRef = firestoreDb.collection(collectionName)

    // Get all documents from Firestore
    const snapshot = await collectionRef.get()

    if (snapshot.empty) {
      console.log(`    No data found in Firestore`)
      return stats
    }

    stats.total = snapshot.docs.length
    console.log(`    Found ${stats.total} documents in Firestore`)

    if (config.dryRun) {
      console.log(`    [DRY RUN] Would rollback ${stats.total} documents`)
      stats.rolled = stats.total
      return stats
    }

    // Process in batches
    const docs = snapshot.docs
    const totalBatches = Math.ceil(docs.length / config.batchSize)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * config.batchSize
      const endIdx = Math.min(startIdx + config.batchSize, docs.length)
      const batchDocs = docs.slice(startIdx, endIdx)

      for (const doc of batchDocs) {
        try {
          const id = doc.id
          const data = doc.data()

          // Check if document exists in RTDB
          if (!config.overwrite) {
            const existingData = await firebaseDb.get(`${collectionName}/${id}`)
            if (existingData) {
              stats.skipped++
              continue
            }
          }

          // Remove 'id' field from data (it's stored as key in RTDB)
          const { id: _id, ...rtdbData } = data

          // Write to RTDB
          await firebaseDb.set(`${collectionName}/${id}`, rtdbData)
          stats.rolled++
        } catch (err: any) {
          stats.failed++
          stats.errors.push(`${doc.id}: ${err.message}`)
        }
      }

      // Progress update
      const progress = (((batchIndex + 1) / totalBatches) * 100).toFixed(1)
      process.stdout.write(`\r    Progress: ${progress}% (${stats.rolled} rolled back, ${stats.skipped} skipped, ${stats.failed} failed)`)
    }

    console.log() // New line after progress
  } catch (error: any) {
    console.error(`    Error: ${error.message}`)
    stats.errors.push(`Collection error: ${error.message}`)
  }

  return stats
}

// Main rollback function
async function runRollback() {
  const config = parseArgs()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  FIRESTORE TO RTDB ROLLBACK')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`  Mode: ${config.dryRun ? 'DRY RUN (no writes)' : 'LIVE ROLLBACK'}`)
  console.log(`  Overwrite: ${config.overwrite ? 'YES (will overwrite existing RTDB data)' : 'NO (skip existing)'}`)
  console.log(`  Batch size: ${config.batchSize}`)
  console.log(`  Collections: ${config.collections.join(', ')}`)
  console.log('')

  if (!config.dryRun) {
    console.log('  WARNING: This will write data to RTDB!')
    console.log('  Press Ctrl+C within 5 seconds to cancel...')
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  const startTime = Date.now()
  const allStats: RollbackStats[] = []

  // Rollback each collection
  for (const collection of config.collections) {
    if (!COLLECTIONS.includes(collection)) {
      console.log(`  Skipping unknown collection: ${collection}`)
      continue
    }

    const stats = await rollbackCollection(collection, config)
    allStats.push(stats)
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  const totalRolled = allStats.reduce((sum, s) => sum + s.rolled, 0)
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, 0)
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, 0)

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  ROLLBACK SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // Table header
  console.log('  Collection            | Total | Rolled | Skipped | Failed')
  console.log('  ----------------------|-------|--------|---------|-------')

  // Table rows
  for (const stats of allStats) {
    const name = stats.collection.padEnd(20)
    const total = String(stats.total).padStart(5)
    const rolled = String(stats.rolled).padStart(6)
    const skipped = String(stats.skipped).padStart(7)
    const failed = String(stats.failed).padStart(6)
    console.log(`  ${name} | ${total} | ${rolled} | ${skipped} | ${failed}`)
  }

  console.log('  ----------------------|-------|--------|---------|-------')

  // Totals
  const totalRecords = allStats.reduce((sum, s) => sum + s.total, 0)
  console.log(`  ${'TOTAL'.padEnd(20)} | ${String(totalRecords).padStart(5)} | ${String(totalRolled).padStart(6)} | ${String(totalSkipped).padStart(7)} | ${String(totalFailed).padStart(6)}`)

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
    console.log('  Some documents failed to rollback. Review errors above.')
    process.exit(1)
  } else if (config.dryRun) {
    console.log('  Dry run complete. Run without --dry-run to perform actual rollback.')
  } else {
    console.log('  Rollback completed successfully!')
  }
}

// Run rollback
console.log('')
runRollback()
  .then(() => {
    console.log('')
    console.log('Rollback script finished.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Unhandled error:', err)
    process.exit(1)
  })
