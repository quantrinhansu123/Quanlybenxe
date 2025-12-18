import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth.js'

const violationSchema = z.object({
  dispatchRecordId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  violationTypeId: z.string().uuid('Invalid violation type ID'),
  violationDate: z.string().datetime('Invalid violation date'),
  description: z.string().optional(),
})

export const getAllViolations = async (req: Request, res: Response) => {
  try {
    const { vehicleId, driverId, dispatchRecordId, resolutionStatus } = req.query

    let query = supabase
      .from('violations')
      .select(`
        *,
        violation_types:violation_type_id(id, code, name, severity)
      `)
      .order('violation_date', { ascending: false })

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId as string)
    }
    if (driverId) {
      query = query.eq('driver_id', driverId as string)
    }
    if (dispatchRecordId) {
      query = query.eq('dispatch_record_id', dispatchRecordId as string)
    }
    if (resolutionStatus) {
      query = query.eq('resolution_status', resolutionStatus as string)
    }

    const { data, error } = await query

    if (error) throw error

    const violations = data.map((violation: any) => ({
      id: violation.id,
      dispatchRecordId: violation.dispatch_record_id,
      vehicleId: violation.vehicle_id,
      driverId: violation.driver_id,
      violationTypeId: violation.violation_type_id,
      violationType: violation.violation_types ? {
        id: violation.violation_types.id,
        code: violation.violation_types.code,
        name: violation.violation_types.name,
        severity: violation.violation_types.severity,
      } : undefined,
      violationDate: violation.violation_date,
      description: violation.description,
      resolutionStatus: violation.resolution_status,
      resolutionNotes: violation.resolution_notes,
      recordedBy: violation.recorded_by,
      createdAt: violation.created_at,
      updatedAt: violation.updated_at,
    }))

    return res.json(violations)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch violations' })
  }
}

export const getViolationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('violations')
      .select(`
        *,
        violation_types:violation_type_id(id, code, name, severity)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Violation not found' })
    }

    return res.json({
      id: data.id,
      dispatchRecordId: data.dispatch_record_id,
      vehicleId: data.vehicle_id,
      driverId: data.driver_id,
      violationTypeId: data.violation_type_id,
      violationType: data.violation_types ? {
        id: data.violation_types.id,
        code: data.violation_types.code,
        name: data.violation_types.name,
        severity: data.violation_types.severity,
      } : undefined,
      violationDate: data.violation_date,
      description: data.description,
      resolutionStatus: data.resolution_status,
      resolutionNotes: data.resolution_notes,
      recordedBy: data.recorded_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch violation' })
  }
}

export const createViolation = async (req: AuthRequest, res: Response) => {
  try {
    const validated = violationSchema.parse(req.body)
    const userId = req.user?.id

    const { data, error } = await supabase
      .from('violations')
      .insert({
        dispatch_record_id: validated.dispatchRecordId || null,
        vehicle_id: validated.vehicleId || null,
        driver_id: validated.driverId || null,
        violation_type_id: validated.violationTypeId,
        violation_date: validated.violationDate,
        description: validated.description || null,
        resolution_status: 'pending',
        recorded_by: userId || null,
      })
      .select(`
        *,
        violation_types:violation_type_id(id, code, name, severity)
      `)
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      dispatchRecordId: data.dispatch_record_id,
      vehicleId: data.vehicle_id,
      driverId: data.driver_id,
      violationTypeId: data.violation_type_id,
      violationType: data.violation_types ? {
        id: data.violation_types.id,
        code: data.violation_types.code,
        name: data.violation_types.name,
        severity: data.violation_types.severity,
      } : undefined,
      violationDate: data.violation_date,
      description: data.description,
      resolutionStatus: data.resolution_status,
      resolutionNotes: data.resolution_notes,
      recordedBy: data.recorded_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create violation' })
  }
}

export const updateViolation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { resolutionStatus, resolutionNotes } = req.body

    if (!resolutionStatus || !['pending', 'resolved', 'dismissed'].includes(resolutionStatus)) {
      return res.status(400).json({ error: 'Invalid resolution status' })
    }

    const { data, error } = await supabase
      .from('violations')
      .update({
        resolution_status: resolutionStatus,
        resolution_notes: resolutionNotes || null,
      })
      .eq('id', id)
      .select(`
        *,
        violation_types:violation_type_id(id, code, name, severity)
      `)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Violation not found' })
    }

    return res.json({
      id: data.id,
      dispatchRecordId: data.dispatch_record_id,
      vehicleId: data.vehicle_id,
      driverId: data.driver_id,
      violationTypeId: data.violation_type_id,
      violationType: data.violation_types ? {
        id: data.violation_types.id,
        code: data.violation_types.code,
        name: data.violation_types.name,
        severity: data.violation_types.severity,
      } : undefined,
      violationDate: data.violation_date,
      description: data.description,
      resolutionStatus: data.resolution_status,
      resolutionNotes: data.resolution_notes,
      recordedBy: data.recorded_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update violation' })
  }
}

export const getAllViolationTypes = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('violation_types')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    const violationTypes = data.map((vt: any) => ({
      id: vt.id,
      code: vt.code,
      name: vt.name,
      description: vt.description,
      severity: vt.severity,
      createdAt: vt.created_at,
    }))

    res.json(violationTypes)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch violation types' })
  }
}

