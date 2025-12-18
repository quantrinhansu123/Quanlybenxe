import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  stationType: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

export const getAllLocations = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query

    let query = supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true })

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    const locations = data.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      stationType: loc.station_type,
      phone: loc.phone,
      email: loc.email,
      address: loc.address,
      latitude: loc.latitude ? parseFloat(loc.latitude) : null,
      longitude: loc.longitude ? parseFloat(loc.longitude) : null,
      isActive: loc.is_active,
      createdAt: loc.created_at,
    }))

    return res.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
    return res.status(500).json({ error: 'Failed to fetch locations' })
  }
}

export const getLocationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Location not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      code: data.code,
      stationType: data.station_type,
      phone: data.phone,
      email: data.email,
      address: data.address,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      isActive: data.is_active,
      createdAt: data.created_at,
    })
  } catch (error) {
    console.error('Error fetching location:', error)
    return res.status(500).json({ error: 'Failed to fetch location' })
  }
}

export const createLocation = async (req: Request, res: Response) => {
  try {
    const validated = locationSchema.parse(req.body)

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: validated.name,
        code: validated.code,
        station_type: validated.stationType || null,
        phone: validated.phone || null,
        email: validated.email || null,
        address: validated.address || null,
        latitude: validated.latitude || null,
        longitude: validated.longitude || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      name: data.name,
      code: data.code,
      stationType: data.station_type,
      phone: data.phone,
      email: data.email,
      province: data.province,
      district: data.district,
      address: data.address,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      isActive: data.is_active,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    console.error('Error creating location:', error)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Location with this code already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create location' })
  }
}

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = locationSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.name) updateData.name = validated.name
    if (validated.code) updateData.code = validated.code
    if (validated.stationType !== undefined) updateData.station_type = validated.stationType || null
    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.email !== undefined) updateData.email = validated.email || null
    if (validated.address !== undefined) updateData.address = validated.address || null
    if (validated.latitude !== undefined) updateData.latitude = validated.latitude || null
    if (validated.longitude !== undefined) updateData.longitude = validated.longitude || null

    const { data, error } = await supabase
      .from('locations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Location not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      code: data.code,
      stationType: data.station_type,
      phone: data.phone,
      email: data.email,
      address: data.address,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      isActive: data.is_active,
      createdAt: data.created_at,
    })
  } catch (error: any) {
    console.error('Error updating location:', error)
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update location' })
  }
}

export const deleteLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id)

    if (error) throw error

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting location:', error)
    return res.status(500).json({ error: 'Failed to delete location' })
  }
}

