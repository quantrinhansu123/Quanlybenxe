/**
 * Denormalization utilities for Firebase RTDB optimization
 *
 * These utilities help fetch and build denormalized data for dispatch_records
 * to reduce the number of queries needed when reading dispatch data.
 */

import { firebase } from '../config/database.js'

export interface DenormalizedVehicleData {
  plateNumber: string
  operatorId: string | null
  operatorName: string | null
  operatorCode: string | null
}

export interface DenormalizedDriverData {
  fullName: string
}

export interface DenormalizedRouteData {
  name: string | null
  type: string | null
  destinationId: string | null
  destinationName: string | null
  destinationCode: string | null
}

export interface DenormalizedUserData {
  fullName: string | null
}

export interface DenormalizedData {
  vehicle: DenormalizedVehicleData
  driver: DenormalizedDriverData
  route: DenormalizedRouteData | null
  user: DenormalizedUserData | null
}

/**
 * Fetches denormalized data for a dispatch record in parallel
 * to minimize database round trips while capturing all related entity names
 */
export async function fetchDenormalizedData(params: {
  vehicleId: string
  driverId?: string | null  // Optional - bypass driver requirement
  routeId?: string | null
  userId?: string | null
}): Promise<DenormalizedData> {
  // Fetch base entities first
  const [vehicleResult, driverResult, routeResult, userResult] = await Promise.all([
    firebase.from('vehicles')
      .select('id, plate_number, operator_id')
      .eq('id', params.vehicleId)
      .single(),
    params.driverId ? firebase.from('drivers')
      .select('id, full_name')
      .eq('id', params.driverId)
      .single() : Promise.resolve({ data: null }),
    params.routeId ? firebase.from('routes')
      .select('id, route_name, route_type, destination_id')
      .eq('id', params.routeId)
      .single() : Promise.resolve({ data: null }),
    params.userId ? firebase.from('users')
      .select('id, full_name')
      .eq('id', params.userId)
      .single() : Promise.resolve({ data: null })
  ])

  const vehicle = vehicleResult.data
  const driver = driverResult.data
  const route = routeResult.data
  const user = userResult.data

  // Manual join: fetch operator and destination separately (Firebase RTDB doesn't support joins)
  let operatorData = null
  let destinationData = null

  if (vehicle?.operator_id) {
    const { data: op } = await firebase.from('operators').select('id, name, code').eq('id', vehicle.operator_id).single()
    operatorData = op
  }

  if (route?.destination_id) {
    const { data: dest } = await firebase.from('destinations').select('id, name, code').eq('id', route.destination_id).single()
    destinationData = dest
  }

  return {
    vehicle: {
      plateNumber: vehicle?.plate_number || '',
      operatorId: vehicle?.operator_id || null,
      operatorName: operatorData?.name || null,
      operatorCode: operatorData?.code || null,
    },
    driver: {
      fullName: driver?.full_name || '',
    },
    route: route ? {
      name: route.route_name || null,
      type: route.route_type || null,
      destinationId: destinationData?.id || null,
      destinationName: destinationData?.name || null,
      destinationCode: destinationData?.code || null,
    } : null,
    user: user ? {
      fullName: user.full_name || null,
    } : null,
  }
}

/**
 * Builds the denormalized fields object for database insert/update
 */
export function buildDenormalizedFields(data: DenormalizedData) {
  return {
    // Vehicle denormalized data
    vehicle_plate_number: data.vehicle.plateNumber,
    vehicle_operator_id: data.vehicle.operatorId,
    vehicle_operator_name: data.vehicle.operatorName,
    vehicle_operator_code: data.vehicle.operatorCode,

    // Driver denormalized data
    driver_full_name: data.driver.fullName,

    // Route denormalized data
    route_name: data.route?.name || null,
    route_type: data.route?.type || null,
    route_destination_id: data.route?.destinationId || null,
    route_destination_name: data.route?.destinationName || null,
    route_destination_code: data.route?.destinationCode || null,
  }
}

/**
 * Fetches user name by ID for workflow functions
 * Returns null if userId is not provided or user not found
 */
export async function fetchUserName(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null

  const { data } = await firebase
    .from('users')
    .select('id, full_name')
    .eq('id', userId)
    .single()

  return data?.full_name || null
}

/**
 * Fetches route denormalized data by ID
 * Used when route is updated during workflow
 */
export async function fetchRouteData(routeId: string | null | undefined): Promise<DenormalizedRouteData | null> {
  if (!routeId) return null

  const { data: route } = await firebase
    .from('routes')
    .select('id, route_name, route_type, destination:destination_id(id, name, code)')
    .eq('id', routeId)
    .single()

  if (!route) return null

  const destinationData = route.destination
    ? (Array.isArray(route.destination) ? route.destination[0] : route.destination)
    : null

  return {
    name: route.route_name || null,
    type: route.route_type || null,
    destinationId: destinationData?.id || null,
    destinationName: destinationData?.name || null,
    destinationCode: destinationData?.code || null,
  }
}

/**
 * Builds route denormalized fields for database update
 */
export function buildRouteDenormalizedFields(routeData: DenormalizedRouteData | null) {
  if (!routeData) {
    return {
      route_name: null,
      route_type: null,
      route_destination_id: null,
      route_destination_name: null,
      route_destination_code: null,
    }
  }

  return {
    route_name: routeData.name,
    route_type: routeData.type,
    route_destination_id: routeData.destinationId,
    route_destination_name: routeData.destinationName,
    route_destination_code: routeData.destinationCode,
  }
}
