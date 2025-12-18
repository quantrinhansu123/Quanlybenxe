import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'

const serviceChargeSchema = z.object({
  dispatchRecordId: z.string().uuid('Invalid dispatch record ID'),
  serviceTypeId: z.string().uuid('Invalid service ID'), // Giữ tên cũ để tương thích với frontend
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  totalAmount: z.number().nonnegative('Total amount must be non-negative'),
})

export const getAllServiceCharges = async (req: Request, res: Response) => {
  try {
    const { dispatchRecordId } = req.query

    let query = supabase
      .from('service_charges')
      .select(`
        *,
        services:service_id(id, code, name, base_price, unit, description)
      `)
      .order('created_at', { ascending: false })

    if (dispatchRecordId) {
      query = query.eq('dispatch_record_id', dispatchRecordId as string)
    }

    const { data, error } = await query

    if (error) throw error

    const serviceCharges = data.map((charge: any) => ({
      id: charge.id,
      dispatchRecordId: charge.dispatch_record_id,
      serviceTypeId: charge.service_id, // Map từ service_id nhưng giữ tên serviceTypeId để tương thích
      serviceType: charge.services ? {
        id: charge.services.id,
        code: charge.services.code,
        name: charge.services.name,
        basePrice: parseFloat(charge.services.base_price || 0),
        unit: charge.services.unit,
        description: charge.services.description,
      } : undefined,
      quantity: parseFloat(charge.quantity),
      unitPrice: parseFloat(charge.unit_price),
      totalAmount: parseFloat(charge.total_amount),
      createdAt: charge.created_at,
    }))

    return res.json(serviceCharges)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch service charges' })
  }
}

export const getServiceChargeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('service_charges')
      .select(`
        *,
        services:service_id(id, code, name, base_price, unit, description)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service charge not found' })
    }

    return res.json({
      id: data.id,
      dispatchRecordId: data.dispatch_record_id,
      serviceTypeId: data.service_id, // Map từ service_id nhưng giữ tên serviceTypeId để tương thích
      serviceType: data.services ? {
        id: data.services.id,
        code: data.services.code,
        name: data.services.name,
        basePrice: parseFloat(data.services.base_price || 0),
        unit: data.services.unit,
        description: data.services.description,
      } : undefined,
      quantity: parseFloat(data.quantity),
      unitPrice: parseFloat(data.unit_price),
      totalAmount: parseFloat(data.total_amount),
      createdAt: data.created_at,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch service charge' })
  }
}

export const createServiceCharge = async (req: Request, res: Response) => {
  try {
    const validated = serviceChargeSchema.parse(req.body)

    const { data, error } = await supabase
      .from('service_charges')
      .insert({
        dispatch_record_id: validated.dispatchRecordId,
        service_id: validated.serviceTypeId, // Map serviceTypeId từ request vào service_id trong DB
        quantity: validated.quantity,
        unit_price: validated.unitPrice,
        total_amount: validated.totalAmount,
      })
      .select(`
        *,
        services:service_id(id, code, name, base_price, unit, description)
      `)
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      dispatchRecordId: data.dispatch_record_id,
      serviceTypeId: data.service_id, // Map từ service_id nhưng giữ tên serviceTypeId để tương thích
      serviceType: data.services ? {
        id: data.services.id,
        code: data.services.code,
        name: data.services.name,
        basePrice: parseFloat(data.services.base_price || 0),
        unit: data.services.unit,
        description: data.services.description,
      } : undefined,
      quantity: parseFloat(data.quantity),
      unitPrice: parseFloat(data.unit_price),
      totalAmount: parseFloat(data.total_amount),
      createdAt: data.created_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create service charge' })
  }
}

export const deleteServiceCharge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('service_charges')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete service charge' })
  }
}

export const getAllServiceTypes = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query

    // Lấy từ bảng services (bảng chính) thay vì service_types
    let query = supabase
      .from('services')
      .select('id, code, name, description, base_price, unit, is_active, created_at, updated_at')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    // Map từ services sang ServiceType format để tương thích với frontend
    const serviceTypes = data.map((svc: any) => ({
      id: svc.id,
      code: svc.code,
      name: svc.name,
      description: svc.description,
      basePrice: parseFloat(svc.base_price || 0),
      unit: svc.unit,
      isActive: svc.is_active,
      createdAt: svc.created_at,
      updatedAt: svc.updated_at,
    }))

    res.json(serviceTypes)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch service types' })
  }
}

