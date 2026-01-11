import { Request, Response } from 'express'
import { db } from '../db/drizzle.js'
import { routes } from '../db/schema/index.js'
import { eq, asc, and } from 'drizzle-orm'
import { z } from 'zod'

// Cache for legacy routes
let legacyRoutesCache: { data: any[]; timestamp: number } | null = null
const LEGACY_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

const routeSchema = z.object({
  routeCode: z.string().min(1, 'Route code is required'),
  routeCodeOld: z.string().optional(),
  departureProvince: z.string().optional(),
  departureStation: z.string().optional(),
  departureStationRef: z.string().optional(),
  arrivalProvince: z.string().optional(),
  arrivalStation: z.string().optional(),
  arrivalStationRef: z.string().optional(),
  distanceKm: z.number().int().positive().optional(),
  itinerary: z.string().optional(),
  routeType: z.string().optional(),
  totalTripsPerMonth: z.number().int().optional(),
  tripsOperated: z.number().int().optional(),
  remainingCapacity: z.number().int().optional(),
  minIntervalMinutes: z.number().int().optional(),
  decisionNumber: z.string().optional(),
  decisionDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  operationStatus: z.string().optional(),
})

export const getAllRoutes = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { departureStation, arrivalStation, isActive } = req.query

    // Build conditions
    const conditions = []

    if (departureStation) {
      conditions.push(eq(routes.departureStation, departureStation as string))
    }
    if (arrivalStation) {
      conditions.push(eq(routes.arrivalStation, arrivalStation as string))
    }
    if (isActive !== undefined) {
      conditions.push(eq(routes.isActive, isActive === 'true'))
    }

    // Build and execute query
    const routesData = conditions.length === 0
      ? await db.select().from(routes).orderBy(asc(routes.routeCode))
      : await db.select().from(routes).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(asc(routes.routeCode))

    const routesFormatted = routesData.map((route) => ({
      id: route.id,
      routeCode: route.routeCode,
      routeCodeOld: route.routeCodeOld || null,
      departureProvince: route.departureProvince || null,
      departureStation: route.departureStation || null,
      departureStationRef: route.departureStationRef || null,
      arrivalProvince: route.arrivalProvince || null,
      arrivalStation: route.arrivalStation || null,
      arrivalStationRef: route.arrivalStationRef || null,
      distanceKm: route.distanceKm || null,
      itinerary: route.itinerary || null,
      routeType: route.routeType || null,
      totalTripsPerMonth: route.totalTripsPerMonth || null,
      tripsOperated: route.tripsOperated || null,
      remainingCapacity: route.remainingCapacity || null,
      minIntervalMinutes: route.minIntervalMinutes || null,
      decisionNumber: route.decisionNumber || null,
      decisionDate: route.decisionDate || null,
      issuingAuthority: route.issuingAuthority || null,
      operationStatus: route.operationStatus || null,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    }))

    return res.json(routesFormatted)
  } catch (error) {
    console.error('Error fetching routes:', error)
    return res.status(500).json({ error: 'Failed to fetch routes' })
  }
}

export const getRouteById = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    const [route] = await db
      .select()
      .from(routes)
      .where(eq(routes.id, id))
      .limit(1)

    if (!route) {
      return res.status(404).json({ error: 'Route not found' })
    }

    return res.json({
      id: route.id,
      routeCode: route.routeCode,
      routeCodeOld: route.routeCodeOld || null,
      departureProvince: route.departureProvince || null,
      departureStation: route.departureStation || null,
      departureStationRef: route.departureStationRef || null,
      arrivalProvince: route.arrivalProvince || null,
      arrivalStation: route.arrivalStation || null,
      arrivalStationRef: route.arrivalStationRef || null,
      distanceKm: route.distanceKm || null,
      itinerary: route.itinerary || null,
      routeType: route.routeType || null,
      totalTripsPerMonth: route.totalTripsPerMonth || null,
      tripsOperated: route.tripsOperated || null,
      remainingCapacity: route.remainingCapacity || null,
      minIntervalMinutes: route.minIntervalMinutes || null,
      decisionNumber: route.decisionNumber || null,
      decisionDate: route.decisionDate || null,
      issuingAuthority: route.issuingAuthority || null,
      operationStatus: route.operationStatus || null,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching route:', error)
    return res.status(500).json({ error: 'Failed to fetch route' })
  }
}

export const createRoute = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const validated = routeSchema.parse(req.body)

    const [route] = await db
      .insert(routes)
      .values({
        routeCode: validated.routeCode,
        routeCodeOld: validated.routeCodeOld || null,
        departureProvince: validated.departureProvince || null,
        departureStation: validated.departureStation || null,
        departureStationRef: validated.departureStationRef || null,
        arrivalProvince: validated.arrivalProvince || null,
        arrivalStation: validated.arrivalStation || null,
        arrivalStationRef: validated.arrivalStationRef || null,
        distanceKm: validated.distanceKm || null,
        itinerary: validated.itinerary || null,
        routeType: validated.routeType || null,
        totalTripsPerMonth: validated.totalTripsPerMonth || null,
        tripsOperated: validated.tripsOperated || null,
        remainingCapacity: validated.remainingCapacity || null,
        minIntervalMinutes: validated.minIntervalMinutes || null,
        decisionNumber: validated.decisionNumber || null,
        decisionDate: validated.decisionDate || null,
        issuingAuthority: validated.issuingAuthority || null,
        operationStatus: validated.operationStatus || null,
        isActive: true,
      })
      .returning()

    return res.status(201).json({
      id: route.id,
      routeCode: route.routeCode,
      routeCodeOld: route.routeCodeOld || null,
      departureProvince: route.departureProvince || null,
      departureStation: route.departureStation || null,
      departureStationRef: route.departureStationRef || null,
      arrivalProvince: route.arrivalProvince || null,
      arrivalStation: route.arrivalStation || null,
      arrivalStationRef: route.arrivalStationRef || null,
      distanceKm: route.distanceKm || null,
      itinerary: route.itinerary || null,
      routeType: route.routeType || null,
      totalTripsPerMonth: route.totalTripsPerMonth || null,
      tripsOperated: route.tripsOperated || null,
      remainingCapacity: route.remainingCapacity || null,
      minIntervalMinutes: route.minIntervalMinutes || null,
      decisionNumber: route.decisionNumber || null,
      decisionDate: route.decisionDate || null,
      issuingAuthority: route.issuingAuthority || null,
      operationStatus: route.operationStatus || null,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const validated = routeSchema.partial().parse(req.body)

    // Build update object
    const updateData: any = {}
    if (validated.routeCode !== undefined) updateData.routeCode = validated.routeCode
    if (validated.routeCodeOld !== undefined) updateData.routeCodeOld = validated.routeCodeOld || null
    if (validated.departureProvince !== undefined) updateData.departureProvince = validated.departureProvince || null
    if (validated.departureStation !== undefined) updateData.departureStation = validated.departureStation || null
    if (validated.departureStationRef !== undefined) updateData.departureStationRef = validated.departureStationRef || null
    if (validated.arrivalProvince !== undefined) updateData.arrivalProvince = validated.arrivalProvince || null
    if (validated.arrivalStation !== undefined) updateData.arrivalStation = validated.arrivalStation || null
    if (validated.arrivalStationRef !== undefined) updateData.arrivalStationRef = validated.arrivalStationRef || null
    if (validated.distanceKm !== undefined) updateData.distanceKm = validated.distanceKm || null
    if (validated.itinerary !== undefined) updateData.itinerary = validated.itinerary || null
    if (validated.routeType !== undefined) updateData.routeType = validated.routeType || null
    if (validated.totalTripsPerMonth !== undefined) updateData.totalTripsPerMonth = validated.totalTripsPerMonth || null
    if (validated.tripsOperated !== undefined) updateData.tripsOperated = validated.tripsOperated || null
    if (validated.remainingCapacity !== undefined) updateData.remainingCapacity = validated.remainingCapacity || null
    if (validated.minIntervalMinutes !== undefined) updateData.minIntervalMinutes = validated.minIntervalMinutes || null
    if (validated.decisionNumber !== undefined) updateData.decisionNumber = validated.decisionNumber || null
    if (validated.decisionDate !== undefined) updateData.decisionDate = validated.decisionDate || null
    if (validated.issuingAuthority !== undefined) updateData.issuingAuthority = validated.issuingAuthority || null
    if (validated.operationStatus !== undefined) updateData.operationStatus = validated.operationStatus || null

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date()
      await db
        .update(routes)
        .set(updateData)
        .where(eq(routes.id, id))
    }

    // Fetch updated route
    const [route] = await db
      .select()
      .from(routes)
      .where(eq(routes.id, id))
      .limit(1)

    if (!route) {
      return res.status(404).json({ error: 'Route not found' })
    }

    return res.json({
      id: route.id,
      routeCode: route.routeCode,
      routeCodeOld: route.routeCodeOld || null,
      departureProvince: route.departureProvince || null,
      departureStation: route.departureStation || null,
      departureStationRef: route.departureStationRef || null,
      arrivalProvince: route.arrivalProvince || null,
      arrivalStation: route.arrivalStation || null,
      arrivalStationRef: route.arrivalStationRef || null,
      distanceKm: route.distanceKm || null,
      itinerary: route.itinerary || null,
      routeType: route.routeType || null,
      totalTripsPerMonth: route.totalTripsPerMonth || null,
      tripsOperated: route.tripsOperated || null,
      remainingCapacity: route.remainingCapacity || null,
      minIntervalMinutes: route.minIntervalMinutes || null,
      decisionNumber: route.decisionNumber || null,
      decisionDate: route.decisionDate || null,
      issuingAuthority: route.issuingAuthority || null,
      operationStatus: route.operationStatus || null,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    await db
      .delete(routes)
      .where(eq(routes.id, id))

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete route' })
  }
}

// Get legacy routes from Drizzle routes table
export const getLegacyRoutes = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const forceRefresh = req.query.refresh === 'true'

    // Check cache
    if (!forceRefresh && legacyRoutesCache && Date.now() - legacyRoutesCache.timestamp < LEGACY_CACHE_TTL) {
      return res.json(legacyRoutesCache.data)
    }

    // Get routes from database
    const routesData = await db
      .select()
      .from(routes)
      .orderBy(asc(routes.routeCode))

    const routesFormatted = routesData.map((route) => ({
      id: route.id,
      routeCode: route.routeCode || '',
      routeCodeOld: route.routeCodeOld || '',
      routeCodeFixed: route.routeCode || '',
      routeClass: '',
      routeType: route.routeType || '',
      routePath: route.itinerary || '',

      departureStation: route.departureStation || '',
      departureStationRef: route.departureStationRef || '',
      departureProvince: route.departureProvince || '',
      departureProvinceOld: route.departureProvince || '',

      arrivalStation: route.arrivalStation || '',
      arrivalStationRef: route.arrivalStationRef || '',
      arrivalProvince: route.arrivalProvince || '',
      arrivalProvinceOld: route.arrivalProvince || '',

      distanceKm: route.distanceKm || 0,
      minIntervalMinutes: route.minIntervalMinutes || 0,
      totalTripsMonth: route.totalTripsPerMonth || 0,
      tripsInOperation: route.tripsOperated || 0,
      remainingCapacity: route.remainingCapacity || 0,

      operationStatus: route.operationStatus || '',
      calendarType: '',

      decisionNumber: route.decisionNumber || '',
      decisionDate: route.decisionDate || '',
      issuingAuthority: route.issuingAuthority || '',

      notes: '',
      filePath: '',

      _source: 'drizzle',
    }))

    // Update cache
    legacyRoutesCache = { data: routesFormatted, timestamp: Date.now() }

    return res.json(routesFormatted)
  } catch (error: any) {
    console.error('Error fetching legacy routes:', error)
    return res.status(500).json({ error: 'Failed to fetch legacy routes' })
  }
}

