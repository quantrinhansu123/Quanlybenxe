import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'

const shiftSchema = z.object({
  name: z.string().min(1, 'Tên ca trực là bắt buộc'),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Giờ bắt đầu không hợp lệ (HH:mm)'),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Giờ kết thúc không hợp lệ (HH:mm)'),
})

export const getAllShifts = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_active', true)
      .order('start_time', { ascending: true })

    if (error) throw error

    const shifts = data.map((shift: any) => ({
      id: shift.id,
      name: shift.name,
      startTime: shift.start_time.substring(0, 5), // Format TIME to HH:mm
      endTime: shift.end_time.substring(0, 5), // Format TIME to HH:mm
      createdAt: shift.created_at,
      updatedAt: shift.updated_at,
    }))

    return res.json(shifts)
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Không thể tải danh sách ca trực' })
  }
}

export const getShiftById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Ca trực không tồn tại' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      startTime: data.start_time.substring(0, 5), // Format TIME to HH:mm
      endTime: data.end_time.substring(0, 5), // Format TIME to HH:mm
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Không thể tải thông tin ca trực' })
  }
}

export const createShift = async (req: Request, res: Response) => {
  try {
    const validated = shiftSchema.parse(req.body)

    // Convert HH:mm to TIME format (HH:mm:ss)
    const startTime = `${validated.startTime}:00`
    const endTime = `${validated.endTime}:00`

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        name: validated.name,
        start_time: startTime,
        end_time: endTime,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      name: data.name,
      startTime: data.start_time.substring(0, 5),
      endTime: data.end_time.substring(0, 5),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Tên ca trực đã tồn tại' })
    }
    return res.status(500).json({ error: error.message || 'Không thể tạo ca trực' })
  }
}

export const updateShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = shiftSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.name) updateData.name = validated.name
    if (validated.startTime) updateData.start_time = `${validated.startTime}:00`
    if (validated.endTime) updateData.end_time = `${validated.endTime}:00`

    const { data, error } = await supabase
      .from('shifts')
      .update(updateData)
      .eq('id', id)
      .eq('is_active', true)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Ca trực không tồn tại' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      startTime: data.start_time.substring(0, 5),
      endTime: data.end_time.substring(0, 5),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Tên ca trực đã tồn tại' })
    }
    return res.status(500).json({ error: error.message || 'Không thể cập nhật ca trực' })
  }
}

export const deleteShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('shifts')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error

    return res.status(204).send()
  } catch (error: any) {
    // Check if shift is being referenced by other tables
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Không thể xóa ca trực. Ca trực này đang được sử dụng trong hệ thống.' })
    }
    return res.status(500).json({ error: error.message || 'Không thể xóa ca trực' })
  }
}

