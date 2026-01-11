/**
 * Import Vehicle Badges from Firebase Export
 * Level 3: Depends on vehicles
 */
import { db } from '../../drizzle'
import { vehicleBadges, vehicles } from '../../schema'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  storeIdMapping,
  getPostgresId,
  parseBoolean,
  parseDate,
  logProgress,
  ensureDbInitialized,
  logInvalidFK,
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

      // Log invalid FK
      if (item.vehicle_id && !vehicleId) {
        await logInvalidFK(exportDir, 'vehicle_badges', item.id, 'vehicle_id', item.vehicle_id, 'vehicles')
      }

      const badgeNumber = item.badge_number || item.SOPHUHIEU || item.id

      // Get plateNumber from vehicle if vehicleId exists, otherwise use BIENSOXE or fallback
      let plateNumber = item.BIENSOXE || `UNKNOWN_${item.id}`
      if (vehicleId) {
        const [vehicle] = await db!.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1)
        if (vehicle?.plateNumber) {
          plateNumber = vehicle.plateNumber
        }
      }

      const [inserted] = await db!.insert(vehicleBadges).values({
        firebaseId: item._firebase_id || item.id,
        badgeNumber: badgeNumber.substring(0, 50),
        plateNumber: plateNumber.substring(0, 20),
        vehicleId,
        expiryDate: item.expiry_date || null,
        issueDate: item.issue_date || null,
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
