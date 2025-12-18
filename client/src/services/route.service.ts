import { firebaseClient } from '@/lib/firebase'
import type { Route, RouteInput } from '@/types'

interface FirebaseRoute {
  id: string
  route_code: string
  route_name: string
  origin_id: string
  destination_id: string
  distance_km: number
  estimated_duration_minutes: number
  route_type: string
  planned_frequency: string
  boarding_point: string
  journey_description: string
  departure_times_description: string
  rest_stops: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const routeService = {
  // Support legacy call: getAll(operatorId?, limit?, isActive?)
  getAll: async (_operatorId?: string, _limit?: number, isActive?: boolean): Promise<Route[]> => {
    const data = await firebaseClient.getAsArray<FirebaseRoute>('routes')
    const locations = await firebaseClient.get<Record<string, any>>('locations') || {}
    
    let filtered = data
    if (isActive !== undefined) {
      filtered = filtered.filter(r => r.is_active === isActive)
    }

    return filtered.map(r => {
      const origin = locations[r.origin_id]
      const destination = locations[r.destination_id]
      
      return {
        id: r.id,
        routeCode: r.route_code,
        routeName: r.route_name,
        originId: r.origin_id,
        origin: origin ? {
          id: r.origin_id,
          name: origin.name,
          code: origin.code,
          stationType: origin.station_type,
          province: origin.province,
          district: origin.district,
          address: origin.address,
          phone: origin.phone,
          email: origin.email,
          latitude: origin.latitude,
          longitude: origin.longitude,
          isActive: origin.is_active,
          createdAt: origin.created_at,
        } : undefined,
        originName: origin?.name || '',
        destinationId: r.destination_id,
        destination: destination ? {
          id: r.destination_id,
          name: destination.name,
          code: destination.code,
          stationType: destination.station_type,
          province: destination.province,
          district: destination.district,
          address: destination.address,
          phone: destination.phone,
          email: destination.email,
          latitude: destination.latitude,
          longitude: destination.longitude,
          isActive: destination.is_active,
          createdAt: destination.created_at,
        } : undefined,
        destinationName: destination?.name || '',
        distanceKm: r.distance_km,
        estimatedDurationMinutes: r.estimated_duration_minutes,
        routeType: r.route_type,
        plannedFrequency: r.planned_frequency,
        boardingPoint: r.boarding_point,
        journeyDescription: r.journey_description,
        departureTimesDescription: r.departure_times_description,
        restStops: r.rest_stops,
        isActive: r.is_active,
        createdAt: r.created_at,
      }
    }).sort((a, b) => a.routeName.localeCompare(b.routeName))
  },

  getById: async (id: string): Promise<Route> => {
    const data = await firebaseClient.get<FirebaseRoute>(`routes/${id}`)
    if (!data) throw new Error('Route not found')
    
    const locations = await firebaseClient.get<Record<string, any>>('locations') || {}
    const origin = locations[data.origin_id]
    const destination = locations[data.destination_id]
    
    return {
      id,
      routeCode: data.route_code,
      routeName: data.route_name,
      originId: data.origin_id,
      origin: origin ? {
        id: data.origin_id,
        name: origin.name,
        code: origin.code,
        stationType: origin.station_type,
        province: origin.province,
        district: origin.district,
        address: origin.address,
        phone: origin.phone,
        email: origin.email,
        latitude: origin.latitude,
        longitude: origin.longitude,
        isActive: origin.is_active,
        createdAt: origin.created_at,
      } : undefined,
      originName: origin?.name || '',
      destinationId: data.destination_id,
      destination: destination ? {
        id: data.destination_id,
        name: destination.name,
        code: destination.code,
        stationType: destination.station_type,
        province: destination.province,
        district: destination.district,
        address: destination.address,
        phone: destination.phone,
        email: destination.email,
        latitude: destination.latitude,
        longitude: destination.longitude,
        isActive: destination.is_active,
        createdAt: destination.created_at,
      } : undefined,
      destinationName: destination?.name || '',
      distanceKm: data.distance_km,
      estimatedDurationMinutes: data.estimated_duration_minutes,
      routeType: data.route_type,
      plannedFrequency: data.planned_frequency,
      boardingPoint: data.boarding_point,
      journeyDescription: data.journey_description,
      departureTimesDescription: data.departure_times_description,
      restStops: data.rest_stops,
      isActive: data.is_active,
      createdAt: data.created_at,
    }
  },

  create: async (input: RouteInput): Promise<Route> => {
    const id = firebaseClient.generateId()
    const now = new Date().toISOString()
    
    const data: FirebaseRoute = {
      id,
      route_code: input.routeCode,
      route_name: input.routeName,
      origin_id: input.originId || '',
      destination_id: input.destinationId || '',
      distance_km: input.distanceKm || 0,
      estimated_duration_minutes: input.estimatedDurationMinutes || 0,
      route_type: input.routeType || '',
      planned_frequency: input.plannedFrequency || '',
      boarding_point: input.boardingPoint || '',
      journey_description: input.journeyDescription || '',
      departure_times_description: input.departureTimesDescription || '',
      rest_stops: input.restStops || '',
      is_active: input.isActive !== false,
      created_at: now,
      updated_at: now,
    }
    
    await firebaseClient.set(`routes/${id}`, data)
    return routeService.getById(id)
  },

  update: async (id: string, input: Partial<RouteInput>): Promise<Route> => {
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (input.routeCode !== undefined) updateData.route_code = input.routeCode
    if (input.routeName !== undefined) updateData.route_name = input.routeName
    if (input.originId !== undefined) updateData.origin_id = input.originId
    if (input.destinationId !== undefined) updateData.destination_id = input.destinationId
    if (input.distanceKm !== undefined) updateData.distance_km = input.distanceKm
    if (input.estimatedDurationMinutes !== undefined) updateData.estimated_duration_minutes = input.estimatedDurationMinutes
    if (input.routeType !== undefined) updateData.route_type = input.routeType
    if (input.plannedFrequency !== undefined) updateData.planned_frequency = input.plannedFrequency
    if (input.boardingPoint !== undefined) updateData.boarding_point = input.boardingPoint
    if (input.journeyDescription !== undefined) updateData.journey_description = input.journeyDescription
    if (input.departureTimesDescription !== undefined) updateData.departure_times_description = input.departureTimesDescription
    if (input.restStops !== undefined) updateData.rest_stops = input.restStops
    if (input.isActive !== undefined) updateData.is_active = input.isActive

    await firebaseClient.update(`routes/${id}`, updateData)
    return routeService.getById(id)
  },

  delete: async (id: string): Promise<void> => {
    await firebaseClient.delete(`routes/${id}`)
  },
}
