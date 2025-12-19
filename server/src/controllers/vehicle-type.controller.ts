import { Request, Response } from 'express'
import { firebase } from '../config/database.js'
import { z } from 'zod'

const vehicleTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  defaultSeatCapacity: z.number().int().min(0).optional(),
  defaultBedCapacity: z.number().int().min(0).optional(),
})

export const getAllVehicleTypes = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await firebase
      .from('vehicle_types')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    const vehicleTypes = data.map((vt: any) => ({
      id: vt.id,
      name: vt.name,
      description: vt.description,
      defaultSeatCapacity: vt.default_seat_capacity ?? null,
      defaultBedCapacity: vt.default_bed_capacity ?? null,
      createdAt: vt.created_at,
    }))

    return res.json(vehicleTypes)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch vehicle types' })
  }
}

export const getVehicleTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await firebase
      .from('vehicle_types')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Vehicle type not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      description: data.description,
      defaultSeatCapacity: data.default_seat_capacity ?? null,
      defaultBedCapacity: data.default_bed_capacity ?? null,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch vehicle type' })
  }
}

export const createVehicleType = async (req: Request, res: Response) => {
  try {
    const validated = vehicleTypeSchema.parse(req.body)

    const { data, error } = await firebase
      .from('vehicle_types')
      .insert({
        name: validated.name,
        description: validated.description || null,
        default_seat_capacity: validated.defaultSeatCapacity ?? null,
        default_bed_capacity: validated.defaultBedCapacity ?? null,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      name: data.name,
      description: data.description,
      defaultSeatCapacity: data.default_seat_capacity ?? null,
      defaultBedCapacity: data.default_bed_capacity ?? null,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create vehicle type' })
  }
}

export const updateVehicleType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = vehicleTypeSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.name) updateData.name = validated.name
    if (validated.description !== undefined) updateData.description = validated.description || null
    if (validated.defaultSeatCapacity !== undefined) updateData.default_seat_capacity = validated.defaultSeatCapacity
    if (validated.defaultBedCapacity !== undefined) updateData.default_bed_capacity = validated.defaultBedCapacity

    const { data, error } = await firebase
      .from('vehicle_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Vehicle type not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      description: data.description,
      defaultSeatCapacity: data.default_seat_capacity ?? null,
      defaultBedCapacity: data.default_bed_capacity ?? null,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update vehicle type' })
  }
}

export const deleteVehicleType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await firebase
      .from('vehicle_types')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete vehicle type' })
  }
}

