import { Request, Response } from 'express'
import { firebase } from '../config/database.js'
import { z } from 'zod'
import { syncRouteChanges } from '../utils/denormalization-sync.js'

const routeSchema = z.object({
  routeCode: z.string().min(1, 'Route code is required'),
  routeName: z.string().min(1, 'Route name is required'),
  originId: z.string().min(1, 'Invalid origin ID'),
  destinationId: z.string().min(1, 'Invalid destination ID'),
  distanceKm: z.number().positive().optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  
  plannedFrequency: z.string().optional(),
  boardingPoint: z.string().optional(),
  journeyDescription: z.string().optional(),
  departureTimesDescription: z.string().optional(),
  restStops: z.string().optional(),
  
  stops: z.array(z.object({
    locationId: z.string().min(1),
    stopOrder: z.number().int().positive(),
    distanceFromOriginKm: z.number().optional(),
    estimatedMinutesFromOrigin: z.number().int().optional(),
  })).optional(),
})

export const getAllRoutes = async (req: Request, res: Response) => {
  try {
    const { originId, destinationId, isActive } = req.query

    let query = firebase
      .from('routes')
      .select(`
        *,
        origin:origin_id(id, name, code),
        destination:destination_id(id, name, code)
      `)
      .order('route_name', { ascending: true })

    if (originId) {
      query = query.eq('origin_id', originId as string)
    }
    if (destinationId) {
      query = query.eq('destination_id', destinationId as string)
    }
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: routes, error } = await query

    if (error) throw error

    // Fetch stops for all routes
    const routeIds = routes.map((r: any) => r.id)
    const { data: stops } = await firebase
      .from('route_stops')
      .select('*')
      .in('route_id', routeIds)
      .order('stop_order', { ascending: true })

    const routesWithStops = routes.map((route: any) => {
      const routeStops = stops?.filter((s: any) => s.route_id === route.id) || []
      return {
        id: route.id,
        routeCode: route.route_code,
        routeName: route.route_name,
        originId: route.origin_id,
        origin: route.origin ? {
          id: route.origin.id,
          name: route.origin.name,
          code: route.origin.code,
        } : undefined,
        destinationId: route.destination_id,
        destination: route.destination ? {
          id: route.destination.id,
          name: route.destination.name,
          code: route.destination.code,
        } : undefined,
        distanceKm: route.distance_km ? parseFloat(route.distance_km) : null,
        estimatedDurationMinutes: route.estimated_duration_minutes,
        
        plannedFrequency: route.planned_frequency,
        boardingPoint: route.boarding_point,
        journeyDescription: route.journey_description,
        departureTimesDescription: route.departure_times_description,
        restStops: route.rest_stops,
        
        isActive: route.is_active,
        stops: routeStops.map((stop: any) => ({
          id: stop.id,
          locationId: stop.location_id,
          stopOrder: stop.stop_order,
          distanceFromOriginKm: stop.distance_from_origin_km ? parseFloat(stop.distance_from_origin_km) : null,
          estimatedMinutesFromOrigin: stop.estimated_minutes_from_origin,
          createdAt: stop.created_at,
        })),
        createdAt: route.created_at,
        updatedAt: route.updated_at,
      }
    })

    return res.json(routesWithStops)
  } catch (error) {
    console.error('Error fetching routes:', error)
    return res.status(500).json({ error: 'Failed to fetch routes' })
  }
}

export const getRouteById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: route, error } = await firebase
      .from('routes')
      .select(`
        *,
        origin:origin_id(id, name, code),
        destination:destination_id(id, name, code)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!route) {
      return res.status(404).json({ error: 'Route not found' })
    }

    const { data: stops } = await firebase
      .from('route_stops')
      .select(`
        *,
        locations:location_id(id, name, code)
      `)
      .eq('route_id', id)
      .order('stop_order', { ascending: true })

    return res.json({
      id: route.id,
      routeCode: route.route_code,
      routeName: route.route_name,
      originId: route.origin_id,
      origin: route.origin ? {
        id: route.origin.id,
        name: route.origin.name,
        code: route.origin.code,
      } : undefined,
      destinationId: route.destination_id,
      destination: route.destination ? {
        id: route.destination.id,
        name: route.destination.name,
        code: route.destination.code,
      } : undefined,
      distanceKm: route.distance_km ? parseFloat(route.distance_km) : null,
      estimatedDurationMinutes: route.estimated_duration_minutes,
      isActive: route.is_active,
      stops: stops?.map((stop: any) => ({
        id: stop.id,
        locationId: stop.location_id,
        location: stop.locations ? {
          id: stop.locations.id,
          name: stop.locations.name,
          code: stop.locations.code,
        } : undefined,
        stopOrder: stop.stop_order,
        distanceFromOriginKm: stop.distance_from_origin_km ? parseFloat(stop.distance_from_origin_km) : null,
        estimatedMinutesFromOrigin: stop.estimated_minutes_from_origin,
        createdAt: stop.created_at,
      })) || [],
      createdAt: route.created_at,
      updatedAt: route.updated_at,
    })
  } catch (error) {
    console.error('Error fetching route:', error)
    return res.status(500).json({ error: 'Failed to fetch route' })
  }
}

export const createRoute = async (req: Request, res: Response) => {
  try {
    const validated = routeSchema.parse(req.body)
    const { 
      routeCode, routeName, originId, destinationId, distanceKm, estimatedDurationMinutes, 
      plannedFrequency, boardingPoint, journeyDescription, departureTimesDescription, restStops,
      stops 
    } = validated

    // Insert route
    const { data: route, error: routeError } = await firebase
      .from('routes')
      .insert({
        route_code: routeCode,
        route_name: routeName,
        origin_id: originId,
        destination_id: destinationId,
        distance_km: distanceKm || null,
        estimated_duration_minutes: estimatedDurationMinutes || null,
        
        planned_frequency: plannedFrequency || null,
        boarding_point: boardingPoint || null,
        journey_description: journeyDescription || null,
        departure_times_description: departureTimesDescription || null,
        rest_stops: restStops || null,
        
        is_active: true,
      })
      .select(`
        *,
        origin:origin_id(id, name, code),
        destination:destination_id(id, name, code)
      `)
      .single()

    if (routeError) throw routeError

    // Insert stops if provided
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map((stop) => ({
        route_id: route.id,
        location_id: stop.locationId,
        stop_order: stop.stopOrder,
        distance_from_origin_km: stop.distanceFromOriginKm || null,
        estimated_minutes_from_origin: stop.estimatedMinutesFromOrigin || null,
      }))

      const { error: stopsError } = await firebase
        .from('route_stops')
        .insert(stopsToInsert)

      if (stopsError) throw stopsError
    }

    // Fetch complete route with stops
    const { data: routeStops } = await firebase
      .from('route_stops')
      .select('*')
      .eq('route_id', route.id)
      .order('stop_order', { ascending: true })

    return res.status(201).json({
      id: route.id,
      routeCode: route.route_code,
      routeName: route.route_name,
      originId: route.origin_id,
      origin: route.origin ? {
        id: route.origin.id,
        name: route.origin.name,
        code: route.origin.code,
      } : undefined,
      destinationId: route.destination_id,
      destination: route.destination ? {
        id: route.destination.id,
        name: route.destination.name,
        code: route.destination.code,
      } : undefined,
      distanceKm: route.distance_km ? parseFloat(route.distance_km) : null,
      estimatedDurationMinutes: route.estimated_duration_minutes,
      
      plannedFrequency: route.planned_frequency,
      boardingPoint: route.boarding_point,
      journeyDescription: route.journey_description,
      departureTimesDescription: route.departure_times_description,
      restStops: route.rest_stops,
      
      isActive: route.is_active,
      stops: routeStops?.map((stop: any) => ({
        id: stop.id,
        locationId: stop.location_id,
        stopOrder: stop.stop_order,
        distanceFromOriginKm: stop.distance_from_origin_km ? parseFloat(stop.distance_from_origin_km) : null,
        estimatedMinutesFromOrigin: stop.estimated_minutes_from_origin,
        createdAt: stop.created_at,
      })) || [],
      createdAt: route.created_at,
      updatedAt: route.updated_at,
    })
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Route with this code already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create route' })
  }
}

export const updateRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = routeSchema.partial().parse(req.body)

    // Update route
    const updateData: any = {}
    if (validated.routeCode) updateData.route_code = validated.routeCode
    if (validated.routeName) updateData.route_name = validated.routeName
    if (validated.originId) updateData.origin_id = validated.originId
    if (validated.destinationId) updateData.destination_id = validated.destinationId
    if (validated.distanceKm !== undefined) updateData.distance_km = validated.distanceKm || null
    if (validated.estimatedDurationMinutes !== undefined) updateData.estimated_duration_minutes = validated.estimatedDurationMinutes || null
    
    if (validated.plannedFrequency !== undefined) updateData.planned_frequency = validated.plannedFrequency || null
    if (validated.boardingPoint !== undefined) updateData.boarding_point = validated.boardingPoint || null
    if (validated.journeyDescription !== undefined) updateData.journey_description = validated.journeyDescription || null
    if (validated.departureTimesDescription !== undefined) updateData.departure_times_description = validated.departureTimesDescription || null
    if (validated.restStops !== undefined) updateData.rest_stops = validated.restStops || null

    if (Object.keys(updateData).length > 0) {
      const { error: routeError } = await firebase
        .from('routes')
        .update(updateData)
        .eq('id', id)

      if (routeError) throw routeError
    }

    // Update stops if provided
    if (validated.stops) {
      // Delete existing stops
      await firebase
        .from('route_stops')
        .delete()
        .eq('route_id', id)

      // Insert new stops
      if (validated.stops.length > 0) {
        const stopsToInsert = validated.stops.map((stop) => ({
          route_id: id,
          location_id: stop.locationId,
          stop_order: stop.stopOrder,
          distance_from_origin_km: stop.distanceFromOriginKm || null,
          estimated_minutes_from_origin: stop.estimatedMinutesFromOrigin || null,
        }))

        const { error: stopsError } = await firebase
          .from('route_stops')
          .insert(stopsToInsert)

        if (stopsError) throw stopsError
      }
    }

    // Fetch updated route
    const { data: route } = await firebase
      .from('routes')
      .select(`
        *,
        origin:origin_id(id, name, code),
        destination:destination_id(id, name, code)
      `)
      .eq('id', id)
      .single()

    // Sync denormalized data to dispatch_records if route_name or destination changed
    if (updateData.route_name || updateData.destination_id) {
      const destData = route.destination
        ? (Array.isArray(route.destination) ? route.destination[0] : route.destination)
        : null

      // Run sync in background (non-blocking)
      syncRouteChanges(id, {
        routeName: route.route_name,
        routeType: route.route_type,
        destinationId: route.destination_id,
        destinationName: destData?.name || null,
        destinationCode: destData?.code || null,
      }).catch((err) => {
        console.error('[Route Update] Failed to sync denormalized data:', err)
      })
    }

    const { data: stops } = await firebase
      .from('route_stops')
      .select('*')
      .eq('route_id', id)
      .order('stop_order', { ascending: true })

    return res.json({
      id: route.id,
      routeCode: route.route_code,
      routeName: route.route_name,
      originId: route.origin_id,
      origin: route.origin ? {
        id: route.origin.id,
        name: route.origin.name,
        code: route.origin.code,
      } : undefined,
      destinationId: route.destination_id,
      destination: route.destination ? {
        id: route.destination.id,
        name: route.destination.name,
        code: route.destination.code,
      } : undefined,
      distanceKm: route.distance_km ? parseFloat(route.distance_km) : null,
      estimatedDurationMinutes: route.estimated_duration_minutes,
      isActive: route.is_active,
      stops: stops?.map((stop: any) => ({
        id: stop.id,
        locationId: stop.location_id,
        stopOrder: stop.stop_order,
        distanceFromOriginKm: stop.distance_from_origin_km ? parseFloat(stop.distance_from_origin_km) : null,
        estimatedMinutesFromOrigin: stop.estimated_minutes_from_origin,
        createdAt: stop.created_at,
      })) || [],
      createdAt: route.created_at,
      updatedAt: route.updated_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update route' })
  }
}

export const deleteRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await firebase
      .from('routes')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete route' })
  }
}

