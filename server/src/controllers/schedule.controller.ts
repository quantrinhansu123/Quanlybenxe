import { Request, Response } from 'express'
import { db } from '../db/drizzle.js'
import { schedules, routes, operators } from '../db/schema/index.js'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const scheduleSchema = z.object({
  scheduleCode: z.string().optional(), // Optional - will be auto-generated if not provided
  routeId: z.string().uuid('Invalid route ID'),
  operatorId: z.string().uuid('Invalid operator ID'),
  departureTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  frequencyType: z.enum(['daily', 'weekly', 'specific_days']),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).optional(),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional(),
})

export const getAllSchedules = async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' })
    }

    const { routeId, operatorId, isActive } = req.query

    // Build where conditions
    const conditions = []
    if (routeId) {
      conditions.push(eq(schedules.routeId, routeId as string))
    }
    if (operatorId) {
      conditions.push(eq(schedules.operatorId, operatorId as string))
    }
    if (isActive !== undefined) {
      conditions.push(eq(schedules.isActive, isActive === 'true'))
    }

    // Query with joins
    const data = await db
      .select({
        id: schedules.id,
        scheduleCode: schedules.scheduleCode,
        routeId: schedules.routeId,
        operatorId: schedules.operatorId,
        departureTime: schedules.departureTime,
        frequencyType: schedules.frequencyType,
        daysOfWeek: schedules.daysOfWeek,
        effectiveFrom: schedules.effectiveFrom,
        effectiveTo: schedules.effectiveTo,
        isActive: schedules.isActive,
        createdAt: schedules.createdAt,
        updatedAt: schedules.updatedAt,
        route: {
          id: routes.id,
          routeName: routes.routeCode,
          routeCode: routes.routeCode,
        },
        operator: {
          id: operators.id,
          name: operators.name,
          code: operators.code,
        },
      })
      .from(schedules)
      .leftJoin(routes, eq(schedules.routeId, routes.id))
      .leftJoin(operators, eq(schedules.operatorId, operators.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schedules.departureTime)

    const result = data.map((item) => ({
      id: item.id,
      scheduleCode: item.scheduleCode,
      routeId: item.routeId,
      route: item.route?.id ? item.route : undefined,
      operatorId: item.operatorId,
      operator: item.operator?.id ? item.operator : undefined,
      departureTime: item.departureTime,
      frequencyType: item.frequencyType,
      daysOfWeek: (item.daysOfWeek as number[]) || [],
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return res.json(result)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch schedules' })
  }
}

export const getScheduleById = async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' })
    }

    const { id } = req.params

    const data = await db
      .select({
        id: schedules.id,
        scheduleCode: schedules.scheduleCode,
        routeId: schedules.routeId,
        operatorId: schedules.operatorId,
        departureTime: schedules.departureTime,
        frequencyType: schedules.frequencyType,
        daysOfWeek: schedules.daysOfWeek,
        effectiveFrom: schedules.effectiveFrom,
        effectiveTo: schedules.effectiveTo,
        isActive: schedules.isActive,
        createdAt: schedules.createdAt,
        updatedAt: schedules.updatedAt,
        route: {
          id: routes.id,
          routeName: routes.routeCode,
          routeCode: routes.routeCode,
        },
        operator: {
          id: operators.id,
          name: operators.name,
          code: operators.code,
        },
      })
      .from(schedules)
      .leftJoin(routes, eq(schedules.routeId, routes.id))
      .leftJoin(operators, eq(schedules.operatorId, operators.id))
      .where(eq(schedules.id, id))
      .limit(1)

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' })
    }

    const item = data[0]
    return res.json({
      id: item.id,
      scheduleCode: item.scheduleCode,
      routeId: item.routeId,
      route: item.route?.id ? item.route : undefined,
      operatorId: item.operatorId,
      operator: item.operator?.id ? item.operator : undefined,
      departureTime: item.departureTime,
      frequencyType: item.frequencyType,
      daysOfWeek: (item.daysOfWeek as number[]) || [],
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch schedule' })
  }
}

export const createSchedule = async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' })
    }

    const validated = scheduleSchema.parse(req.body)

    // Generate schedule code if not provided
    const scheduleCode = validated.scheduleCode || `SCH-${Date.now()}`

    const [inserted] = await db
      .insert(schedules)
      .values({
        scheduleCode,
        routeId: validated.routeId,
        operatorId: validated.operatorId,
        departureTime: validated.departureTime,
        frequencyType: validated.frequencyType,
        daysOfWeek: validated.daysOfWeek || null,
        effectiveFrom: validated.effectiveFrom,
        effectiveTo: validated.effectiveTo || null,
        isActive: true,
      })
      .returning()

    // Fetch with relations
    const data = await db
      .select({
        id: schedules.id,
        scheduleCode: schedules.scheduleCode,
        routeId: schedules.routeId,
        operatorId: schedules.operatorId,
        departureTime: schedules.departureTime,
        frequencyType: schedules.frequencyType,
        daysOfWeek: schedules.daysOfWeek,
        effectiveFrom: schedules.effectiveFrom,
        effectiveTo: schedules.effectiveTo,
        isActive: schedules.isActive,
        createdAt: schedules.createdAt,
        updatedAt: schedules.updatedAt,
        route: {
          id: routes.id,
          routeName: routes.routeCode,
          routeCode: routes.routeCode,
        },
        operator: {
          id: operators.id,
          name: operators.name,
          code: operators.code,
        },
      })
      .from(schedules)
      .leftJoin(routes, eq(schedules.routeId, routes.id))
      .leftJoin(operators, eq(schedules.operatorId, operators.id))
      .where(eq(schedules.id, inserted.id))
      .limit(1)

    const item = data[0]
    return res.status(201).json({
      id: item.id,
      scheduleCode: item.scheduleCode,
      routeId: item.routeId,
      route: item.route?.id ? item.route : undefined,
      operatorId: item.operatorId,
      operator: item.operator?.id ? item.operator : undefined,
      departureTime: item.departureTime,
      frequencyType: item.frequencyType,
      daysOfWeek: (item.daysOfWeek as number[]) || [],
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Schedule with this code already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create schedule' })
  }
}

export const updateSchedule = async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database connection not available' })
    }

    const { id } = req.params
    const validated = scheduleSchema.partial().parse(req.body)

    const updateData: any = { updatedAt: new Date() }
    if (validated.scheduleCode) updateData.scheduleCode = validated.scheduleCode
    if (validated.routeId) updateData.routeId = validated.routeId
    if (validated.operatorId) updateData.operatorId = validated.operatorId
    if (validated.departureTime) updateData.departureTime = validated.departureTime
    if (validated.frequencyType) updateData.frequencyType = validated.frequencyType
    if (validated.daysOfWeek !== undefined) updateData.daysOfWeek = validated.daysOfWeek || null
    if (validated.effectiveFrom) updateData.effectiveFrom = validated.effectiveFrom
    if (validated.effectiveTo !== undefined) updateData.effectiveTo = validated.effectiveTo || null

    const [updated] = await db
      .update(schedules)
      .set(updateData)
      .where(eq(schedules.id, id))
      .returning()

    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found' })
    }

    // Fetch with relations
    const data = await db
      .select({
        id: schedules.id,
        scheduleCode: schedules.scheduleCode,
        routeId: schedules.routeId,
        operatorId: schedules.operatorId,
        departureTime: schedules.departureTime,
        frequencyType: schedules.frequencyType,
        daysOfWeek: schedules.daysOfWeek,
        effectiveFrom: schedules.effectiveFrom,
        effectiveTo: schedules.effectiveTo,
        isActive: schedules.isActive,
        createdAt: schedules.createdAt,
        updatedAt: schedules.updatedAt,
        route: {
          id: routes.id,
          routeName: routes.routeCode,
          routeCode: routes.routeCode,
        },
        operator: {
          id: operators.id,
          name: operators.name,
          code: operators.code,
        },
      })
      .from(schedules)
      .leftJoin(routes, eq(schedules.routeId, routes.id))
      .leftJoin(operators, eq(schedules.operatorId, operators.id))
      .where(eq(schedules.id, id))
      .limit(1)

    const item = data[0]
    return res.json({
      id: item.id,
      scheduleCode: item.scheduleCode,
      routeId: item.routeId,
      route: item.route?.id ? item.route : undefined,
      operatorId: item.operatorId,
      operator: item.operator?.id ? item.operator : undefined,
      departureTime: item.departureTime,
      frequencyType: item.frequencyType,
      daysOfWeek: (item.daysOfWeek as number[]) || [],
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update schedule' })
  }
}

export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ error: 'Database connection not available' })
      return
    }

    const { id } = req.params

    await db
      .delete(schedules)
      .where(eq(schedules.id, id))

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete schedule' })
  }
}
