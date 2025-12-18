/**
 * Denormalization Sync Utilities for Firebase RTDB
 *
 * These functions handle propagating changes from source entities (vehicles, drivers, routes)
 * to the denormalized fields in dispatch_records.
 *
 * When source data changes, we need to update all dispatch_records that reference
 * that entity to keep the denormalized data consistent.
 */

import { firebase, firebaseDb } from '../config/database.js'

/**
 * Sync vehicle changes to all dispatch records that reference this vehicle
 *
 * Call this when:
 * - Vehicle plate number changes
 * - Vehicle operator assignment changes
 *
 * @param vehicleId - The ID of the vehicle that changed
 * @param changes - The fields that changed
 */
export async function syncVehicleChanges(vehicleId: string, changes: {
  plateNumber?: string
  operatorId?: string | null
  operatorName?: string | null
  operatorCode?: string | null
}): Promise<{ updated: number; failed: number }> {
  try {
    // Find all dispatch records for this vehicle
    const { data: records } = await firebase
      .from('dispatch_records')
      .select('id')
      .eq('vehicle_id', vehicleId)

    if (!records || records.length === 0) {
      return { updated: 0, failed: 0 }
    }

    // Build update object
    const updates: Record<string, any> = {}
    if (changes.plateNumber !== undefined) updates.vehicle_plate_number = changes.plateNumber
    if (changes.operatorId !== undefined) updates.vehicle_operator_id = changes.operatorId
    if (changes.operatorName !== undefined) updates.vehicle_operator_name = changes.operatorName
    if (changes.operatorCode !== undefined) updates.vehicle_operator_code = changes.operatorCode

    if (Object.keys(updates).length === 0) {
      return { updated: 0, failed: 0 }
    }

    // Batch update all affected records
    let updated = 0
    let failed = 0

    await Promise.all(records.map(async (r: any) => {
      try {
        await firebaseDb.update(`dispatch_records/${r.id}`, updates)
        updated++
      } catch (err) {
        console.error(`Failed to sync vehicle change to dispatch record ${r.id}:`, err)
        failed++
      }
    }))

    console.log(`[Denorm Sync] Vehicle ${vehicleId}: Updated ${updated} dispatch records (${failed} failed)`)
    return { updated, failed }
  } catch (error) {
    console.error(`[Denorm Sync] Failed to sync vehicle changes for ${vehicleId}:`, error)
    return { updated: 0, failed: 0 }
  }
}

/**
 * Sync driver changes to all dispatch records that reference this driver
 *
 * Call this when:
 * - Driver full name changes
 *
 * @param driverId - The ID of the driver that changed
 * @param fullName - The new full name
 */
export async function syncDriverChanges(driverId: string, fullName: string): Promise<{ updated: number; failed: number }> {
  try {
    // Find all dispatch records for this driver
    const { data: records } = await firebase
      .from('dispatch_records')
      .select('id')
      .eq('driver_id', driverId)

    if (!records || records.length === 0) {
      return { updated: 0, failed: 0 }
    }

    // Batch update all affected records
    let updated = 0
    let failed = 0

    await Promise.all(records.map(async (r: any) => {
      try {
        await firebaseDb.update(`dispatch_records/${r.id}`, { driver_full_name: fullName })
        updated++
      } catch (err) {
        console.error(`Failed to sync driver change to dispatch record ${r.id}:`, err)
        failed++
      }
    }))

    console.log(`[Denorm Sync] Driver ${driverId}: Updated ${updated} dispatch records (${failed} failed)`)
    return { updated, failed }
  } catch (error) {
    console.error(`[Denorm Sync] Failed to sync driver changes for ${driverId}:`, error)
    return { updated: 0, failed: 0 }
  }
}

/**
 * Sync route changes to all dispatch records that reference this route
 *
 * Call this when:
 * - Route name changes
 * - Route type changes
 * - Route destination changes
 *
 * @param routeId - The ID of the route that changed
 * @param changes - The fields that changed
 */
export async function syncRouteChanges(routeId: string, changes: {
  routeName?: string | null
  routeType?: string | null
  destinationId?: string | null
  destinationName?: string | null
  destinationCode?: string | null
}): Promise<{ updated: number; failed: number }> {
  try {
    // Find all dispatch records for this route
    const { data: records } = await firebase
      .from('dispatch_records')
      .select('id')
      .eq('route_id', routeId)

    if (!records || records.length === 0) {
      return { updated: 0, failed: 0 }
    }

    // Build update object
    const updates: Record<string, any> = {}
    if (changes.routeName !== undefined) updates.route_name = changes.routeName
    if (changes.routeType !== undefined) updates.route_type = changes.routeType
    if (changes.destinationId !== undefined) updates.route_destination_id = changes.destinationId
    if (changes.destinationName !== undefined) updates.route_destination_name = changes.destinationName
    if (changes.destinationCode !== undefined) updates.route_destination_code = changes.destinationCode

    if (Object.keys(updates).length === 0) {
      return { updated: 0, failed: 0 }
    }

    // Batch update all affected records
    let updated = 0
    let failed = 0

    await Promise.all(records.map(async (r: any) => {
      try {
        await firebaseDb.update(`dispatch_records/${r.id}`, updates)
        updated++
      } catch (err) {
        console.error(`Failed to sync route change to dispatch record ${r.id}:`, err)
        failed++
      }
    }))

    console.log(`[Denorm Sync] Route ${routeId}: Updated ${updated} dispatch records (${failed} failed)`)
    return { updated, failed }
  } catch (error) {
    console.error(`[Denorm Sync] Failed to sync route changes for ${routeId}:`, error)
    return { updated: 0, failed: 0 }
  }
}

/**
 * Sync operator changes to all vehicles that reference this operator,
 * then cascade to all dispatch records
 *
 * Call this when:
 * - Operator name changes
 * - Operator code changes
 *
 * @param operatorId - The ID of the operator that changed
 * @param changes - The fields that changed
 */
export async function syncOperatorChanges(operatorId: string, changes: {
  name?: string
  code?: string
}): Promise<{ vehiclesUpdated: number; dispatchUpdated: number; failed: number }> {
  try {
    // Find all vehicles with this operator
    const { data: vehicles } = await firebase
      .from('vehicles')
      .select('id')
      .eq('operator_id', operatorId)

    if (!vehicles || vehicles.length === 0) {
      return { vehiclesUpdated: 0, dispatchUpdated: 0, failed: 0 }
    }

    let dispatchUpdated = 0
    let failed = 0

    // For each vehicle, sync the operator changes to their dispatch records
    await Promise.all(vehicles.map(async (v: any) => {
      const result = await syncVehicleChanges(v.id, {
        operatorName: changes.name,
        operatorCode: changes.code,
      })
      dispatchUpdated += result.updated
      failed += result.failed
    }))

    console.log(`[Denorm Sync] Operator ${operatorId}: Affected ${vehicles.length} vehicles, ${dispatchUpdated} dispatch records (${failed} failed)`)
    return { vehiclesUpdated: vehicles.length, dispatchUpdated, failed }
  } catch (error) {
    console.error(`[Denorm Sync] Failed to sync operator changes for ${operatorId}:`, error)
    return { vehiclesUpdated: 0, dispatchUpdated: 0, failed: 0 }
  }
}

/**
 * Sync destination (location) changes to all routes that reference this location,
 * then cascade to all dispatch records
 *
 * Call this when:
 * - Location name changes
 * - Location code changes
 *
 * @param locationId - The ID of the location that changed
 * @param changes - The fields that changed
 */
export async function syncDestinationChanges(locationId: string, changes: {
  name?: string
  code?: string
}): Promise<{ routesUpdated: number; dispatchUpdated: number; failed: number }> {
  try {
    // Find all routes with this destination
    const { data: routes } = await firebase
      .from('routes')
      .select('id')
      .eq('destination_id', locationId)

    if (!routes || routes.length === 0) {
      return { routesUpdated: 0, dispatchUpdated: 0, failed: 0 }
    }

    let dispatchUpdated = 0
    let failed = 0

    // For each route, sync the destination changes to their dispatch records
    await Promise.all(routes.map(async (r: any) => {
      const result = await syncRouteChanges(r.id, {
        destinationName: changes.name,
        destinationCode: changes.code,
      })
      dispatchUpdated += result.updated
      failed += result.failed
    }))

    console.log(`[Denorm Sync] Destination ${locationId}: Affected ${routes.length} routes, ${dispatchUpdated} dispatch records (${failed} failed)`)
    return { routesUpdated: routes.length, dispatchUpdated, failed }
  } catch (error) {
    console.error(`[Denorm Sync] Failed to sync destination changes for ${locationId}:`, error)
    return { routesUpdated: 0, dispatchUpdated: 0, failed: 0 }
  }
}
