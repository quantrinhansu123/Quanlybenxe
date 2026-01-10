/**
 * Import Vehicle Badges from Firebase Export
 * Level 3: Depends on vehicles
 */
import { db } from '../../drizzle'
import { vehicleBadges } from '../../schema'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  storeIdMapping,
  getPostgresId,
  parseBoolean,
  parseDate,
  logProgress,
  ensureDbInitialized,
} from './etl-helpers'

interface FirebaseVehicleBadge {
  _firebase_id: string
  id: string
  badge_number?: string
  vehicle_id?: string
  expiry_date?: string
  issue_date?: string
  is_active?: boolean | string
  metadata?: Record<string, unknown>
  synced_at?: string
  source?: string
  created_at?: string
  updated_at?: string
  // Alternative field names from datasheet
  SOPHUHIEU?: string
  BIENSOXE?: string
}

export async function importVehicleBadges(exportDir: string): Promise<number> {
  ensureDbInitialized()

  const filePath = join(exportDir, 'vehicle_badges.json')
  let data: FirebaseVehicleBadge[]

  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    console.log('  ⚠ vehicle_badges.json not found, skipping...')
    return 0
  }

  console.log(`  Importing ${data.length} vehicle badges...`)

  let imported = 0
  let skipped = 0

  for (let i = 0; i < data.length; i++) {
    const item = data[i]

    try {
      const vehicleId = await getPostgresId(item.vehicle_id, 'vehicles')

      const badgeNumber = item.badge_number || item.SOPHUHIEU || item.id

      const [inserted] = await db!.insert(vehicleBadges).values({
        firebaseId: item._firebase_id || item.id,
        badgeNumber: badgeNumber.substring(0, 50),
        vehicleId,
        expiryDate: item.expiry_date?.substring(0, 20) || null,
        issueDate: item.issue_date?.substring(0, 20) || null,
        isActive: parseBoolean(item.is_active),
        metadata: item.metadata || null,
        syncedAt: parseDate(item.synced_at),
        source: item.source?.substring(0, 50) || 'firebase_migration',
        createdAt: parseDate(item.created_at) || new Date(),
        updatedAt: parseDate(item.updated_at) || new Date(),
      }).returning()

      await storeIdMapping(item._firebase_id || item.id, inserted.id, 'vehicle_badges')
      imported++
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!message.includes('duplicate')) {
        console.log(`\n  ✗ Failed: ${item.id} - ${message}`)
      }
      skipped++
    }

    if (i % 500 === 0) {
      logProgress(i + 1, data.length, 'vehicle_badges')
    }
  }

  console.log(`\n  ✓ Vehicle Badges: ${imported} imported, ${skipped} skipped`)
  return imported
}
