/**
 * Migration Script: Copy data from old Firebase (webbenxe) to new Firebase (benxe-management-20251218)
 *
 * Usage:
 *   1. Place the old Firebase service account JSON file as: ./webbenxe-firebase-adminsdk.json
 *   2. Ensure new Firebase service account is configured in .env (SERVICE_ACCOUNT_PATH)
 *   3. Run: npx tsx src/scripts/migrate-from-old-firebase.ts
 *
 * Data paths to migrate:
 *   - datasheet/PHUHIEUXE (vehicle badges - ~10,000 records)
 *   - users (if needed)
 */

import { initializeApp, cert, App, deleteApp } from 'firebase-admin/app'
import { getDatabase, Database } from 'firebase-admin/database'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config()

// Configuration
const CONFIG = {
  // Old Firebase (source)
  OLD_DATABASE_URL: 'https://webbenxe-default-rtdb.asia-southeast1.firebasedatabase.app/',
  OLD_SERVICE_ACCOUNT_PATH: './webbenxe-firebase-adminsdk.json',

  // New Firebase (destination) - uses .env config
  NEW_DATABASE_URL: process.env.RTDB_URL || 'https://benxe-management-20251218-default-rtdb.asia-southeast1.firebasedatabase.app/',
  NEW_SERVICE_ACCOUNT_PATH: process.env.SERVICE_ACCOUNT_PATH || './benxe-management-20251218-firebase-adminsdk.json',

  // Data paths to migrate
  PATHS_TO_MIGRATE: [
    'datasheet/PHUHIEUXE',  // Vehicle badges (~10,000 records)
    // 'users',              // Uncomment if you want to migrate users too
  ],

  // Batch size for writing (to avoid timeout)
  BATCH_SIZE: 500,
}

let oldApp: App | null = null
let newApp: App | null = null
let oldDb: Database | null = null
let newDb: Database | null = null

/**
 * Initialize Firebase apps
 */
async function initializeFirebaseApps(): Promise<void> {
  console.log('🔧 Initializing Firebase apps...\n')

  // Check if old service account exists
  const oldServiceAccountPath = resolve(process.cwd(), CONFIG.OLD_SERVICE_ACCOUNT_PATH)
  if (!existsSync(oldServiceAccountPath)) {
    throw new Error(`
❌ Old Firebase service account not found!

Please download the service account JSON from Firebase Console:
1. Go to: https://console.firebase.google.com/project/webbenxe/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Save the file as: ${oldServiceAccountPath}
`)
  }

  // Check if new service account exists
  const newServiceAccountPath = resolve(process.cwd(), CONFIG.NEW_SERVICE_ACCOUNT_PATH)
  if (!existsSync(newServiceAccountPath)) {
    throw new Error(`
❌ New Firebase service account not found!

Please ensure SERVICE_ACCOUNT_PATH in .env points to a valid service account JSON file.
Expected path: ${newServiceAccountPath}
`)
  }

  // Initialize old Firebase app
  const oldServiceAccount = JSON.parse(readFileSync(oldServiceAccountPath, 'utf-8'))
  oldApp = initializeApp({
    credential: cert(oldServiceAccount),
    databaseURL: CONFIG.OLD_DATABASE_URL
  }, 'old-firebase')
  oldDb = getDatabase(oldApp)
  console.log(`✅ Connected to OLD Firebase: ${CONFIG.OLD_DATABASE_URL}`)

  // Initialize new Firebase app
  const newServiceAccount = JSON.parse(readFileSync(newServiceAccountPath, 'utf-8'))
  newApp = initializeApp({
    credential: cert(newServiceAccount),
    databaseURL: CONFIG.NEW_DATABASE_URL
  }, 'new-firebase')
  newDb = getDatabase(newApp)
  console.log(`✅ Connected to NEW Firebase: ${CONFIG.NEW_DATABASE_URL}`)
  console.log('')
}

/**
 * Cleanup Firebase apps
 */
async function cleanupFirebaseApps(): Promise<void> {
  if (oldApp) {
    await deleteApp(oldApp)
  }
  if (newApp) {
    await deleteApp(newApp)
  }
}

/**
 * Count records in a path
 */
async function countRecords(db: Database, path: string): Promise<number> {
  const snapshot = await db.ref(path).once('value')
  const data = snapshot.val()
  if (!data) return 0
  return Object.keys(data).length
}

/**
 * Migrate data from one path
 */
async function migratePath(path: string): Promise<{ success: number; failed: number }> {
  console.log(`\n📦 Migrating: ${path}`)
  console.log('─'.repeat(50))

  // Read from old database
  console.log('   Reading from old database...')
  const snapshot = await oldDb!.ref(path).once('value')
  const data = snapshot.val()

  if (!data) {
    console.log('   ⚠️  No data found at this path')
    return { success: 0, failed: 0 }
  }

  const keys = Object.keys(data)
  const totalRecords = keys.length
  console.log(`   Found ${totalRecords.toLocaleString()} records`)

  // Write to new database in batches
  let success = 0
  let failed = 0
  const totalBatches = Math.ceil(keys.length / CONFIG.BATCH_SIZE)

  for (let i = 0; i < keys.length; i += CONFIG.BATCH_SIZE) {
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1
    const batchKeys = keys.slice(i, i + CONFIG.BATCH_SIZE)
    const batchData: Record<string, any> = {}

    for (const key of batchKeys) {
      batchData[key] = data[key]
    }

    try {
      // Use update to merge data (won't overwrite existing data at other keys)
      await newDb!.ref(path).update(batchData)
      success += batchKeys.length

      const progress = ((i + batchKeys.length) / totalRecords * 100).toFixed(1)
      console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${batchKeys.length} records (${progress}% complete)`)
    } catch (error: any) {
      failed += batchKeys.length
      console.error(`   ❌ Batch ${batchNum}/${totalBatches} failed: ${error.message}`)
    }

    // Small delay to avoid rate limiting
    if (i + CONFIG.BATCH_SIZE < keys.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`   📊 Result: ${success.toLocaleString()} success, ${failed.toLocaleString()} failed`)
  return { success, failed }
}

/**
 * Verify migration
 */
async function verifyMigration(path: string): Promise<boolean> {
  const oldCount = await countRecords(oldDb!, path)
  const newCount = await countRecords(newDb!, path)

  console.log(`   🔍 Verification: Old=${oldCount.toLocaleString()}, New=${newCount.toLocaleString()}`)

  if (oldCount === newCount) {
    console.log(`   ✅ Counts match!`)
    return true
  } else {
    console.log(`   ⚠️  Counts don't match - some records may have been skipped`)
    return false
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('═'.repeat(60))
  console.log('🚀 FIREBASE DATA MIGRATION')
  console.log('   From: webbenxe (old)')
  console.log('   To:   benxe-management-20251218 (new)')
  console.log('═'.repeat(60))
  console.log('')

  try {
    // Initialize Firebase apps
    await initializeFirebaseApps()

    // Show what will be migrated
    console.log('📋 Paths to migrate:')
    for (const path of CONFIG.PATHS_TO_MIGRATE) {
      const count = await countRecords(oldDb!, path)
      console.log(`   - ${path}: ${count.toLocaleString()} records`)
    }
    console.log('')

    // Confirm before proceeding
    console.log('⏳ Starting migration in 3 seconds... (Ctrl+C to cancel)')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Migrate each path
    const results: Record<string, { success: number; failed: number }> = {}

    for (const path of CONFIG.PATHS_TO_MIGRATE) {
      results[path] = await migratePath(path)
      await verifyMigration(path)
    }

    // Summary
    console.log('\n' + '═'.repeat(60))
    console.log('📊 MIGRATION SUMMARY')
    console.log('═'.repeat(60))

    let totalSuccess = 0
    let totalFailed = 0

    for (const path of CONFIG.PATHS_TO_MIGRATE) {
      const result = results[path]
      totalSuccess += result.success
      totalFailed += result.failed
      console.log(`   ${path}: ${result.success.toLocaleString()} success, ${result.failed.toLocaleString()} failed`)
    }

    console.log('─'.repeat(60))
    console.log(`   TOTAL: ${totalSuccess.toLocaleString()} success, ${totalFailed.toLocaleString()} failed`)
    console.log('')

    if (totalFailed === 0) {
      console.log('✅ Migration completed successfully!')
    } else {
      console.log('⚠️  Migration completed with some failures. Please check the logs.')
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await cleanupFirebaseApps()
  }
}

// Run migration
main()
