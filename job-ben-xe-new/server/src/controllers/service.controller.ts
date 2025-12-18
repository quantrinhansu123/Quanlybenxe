import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'

const serviceSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  unit: z.string().min(1, 'Unit is required'),
  taxPercentage: z.number().min(0).max(100),
  materialType: z.string().min(1, 'Material type is required'),
  useQuantityFormula: z.boolean().default(false),
  usePriceFormula: z.boolean().default(false),
  displayOrder: z.number().int().min(0),
  isDefault: z.boolean().default(false),
  autoCalculateQuantity: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const getAllServices = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query

    let query = supabase
      .from('services')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    const services = data.map((svc: any) => ({
      id: svc.id,
      code: svc.code,
      name: svc.name,
      unit: svc.unit,
      taxPercentage: parseFloat(svc.tax_percentage) || 0,
      materialType: svc.material_type,
      useQuantityFormula: svc.use_quantity_formula,
      usePriceFormula: svc.use_price_formula,
      displayOrder: svc.display_order,
      isDefault: svc.is_default,
      autoCalculateQuantity: svc.auto_calculate_quantity,
      isActive: svc.is_active,
      createdAt: svc.created_at,
      updatedAt: svc.updated_at,
    }))

    return res.json(services)
  } catch (error) {
    console.error('Error fetching services:', error)
    return res.status(500).json({ error: 'Failed to fetch services' })
  }
}

export const getServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // Lấy thông tin biểu thức đã chọn
    const { data: usageData } = await supabase
      .from('service_formula_usage')
      .select('formula_id, usage_type')
      .eq('service_id', id)

    let quantityFormulaId = ''
    let priceFormulaId = ''
    
    if (usageData) {
      const quantityUsage = usageData.find((u: any) => u.usage_type === 'quantity')
      const priceUsage = usageData.find((u: any) => u.usage_type === 'price')
      quantityFormulaId = quantityUsage?.formula_id || ''
      priceFormulaId = priceUsage?.formula_id || ''
    }

    return res.json({
      id: data.id,
      code: data.code,
      name: data.name,
      unit: data.unit,
      taxPercentage: parseFloat(data.tax_percentage) || 0,
      materialType: data.material_type,
      useQuantityFormula: data.use_quantity_formula,
      usePriceFormula: data.use_price_formula,
      displayOrder: data.display_order,
      isDefault: data.is_default,
      autoCalculateQuantity: data.auto_calculate_quantity,
      isActive: data.is_active,
      quantityFormulaExpression: quantityFormulaId,
      priceFormulaExpression: priceFormulaId,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error) {
    console.error('Error fetching service:', error)
    return res.status(500).json({ error: 'Failed to fetch service' })
  }
}

export const createService = async (req: Request, res: Response) => {
  try {
    const validated = serviceSchema.parse(req.body)
    const { quantityFormulaExpression, priceFormulaExpression } = req.body

    const { data, error } = await supabase
      .from('services')
      .insert({
        code: validated.code,
        name: validated.name,
        unit: validated.unit,
        tax_percentage: validated.taxPercentage,
        material_type: validated.materialType,
        use_quantity_formula: validated.useQuantityFormula,
        use_price_formula: validated.usePriceFormula,
        display_order: validated.displayOrder,
        is_default: validated.isDefault,
        auto_calculate_quantity: validated.autoCalculateQuantity,
        is_active: validated.isActive,
      })
      .select()
      .single()

    if (error) throw error

    // Lưu mối quan hệ với biểu thức vào service_formula_usage
    // Lưu nếu có chọn biểu thức (không cần kiểm tra checkbox)
    const usageInserts: any[] = []
    
    if (quantityFormulaExpression) {
      usageInserts.push({
        service_id: data.id,
        formula_id: quantityFormulaExpression,
        usage_type: 'quantity',
      })
    }
    
    if (priceFormulaExpression) {
      usageInserts.push({
        service_id: data.id,
        formula_id: priceFormulaExpression,
        usage_type: 'price',
      })
    }

    if (usageInserts.length > 0) {
      const { error: usageError } = await supabase
        .from('service_formula_usage')
        .insert(usageInserts)

      if (usageError) {
        console.error('Error creating service formula usage:', usageError)
        // Không throw error, chỉ log vì service đã được tạo thành công
      }
    }

    return res.status(201).json({
      id: data.id,
      code: data.code,
      name: data.name,
      unit: data.unit,
      taxPercentage: parseFloat(data.tax_percentage) || 0,
      materialType: data.material_type,
      useQuantityFormula: data.use_quantity_formula,
      usePriceFormula: data.use_price_formula,
      displayOrder: data.display_order,
      isDefault: data.is_default,
      autoCalculateQuantity: data.auto_calculate_quantity,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error creating service:', error)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Service with this code already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create service' })
  }
}

export const updateService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = serviceSchema.partial().parse(req.body)
    const { quantityFormulaExpression, priceFormulaExpression } = req.body

    const updateData: any = {}
    if (validated.code !== undefined) updateData.code = validated.code
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.unit !== undefined) updateData.unit = validated.unit
    if (validated.taxPercentage !== undefined) updateData.tax_percentage = validated.taxPercentage
    if (validated.materialType !== undefined) updateData.material_type = validated.materialType
    if (validated.useQuantityFormula !== undefined) updateData.use_quantity_formula = validated.useQuantityFormula
    if (validated.usePriceFormula !== undefined) updateData.use_price_formula = validated.usePriceFormula
    if (validated.displayOrder !== undefined) updateData.display_order = validated.displayOrder
    if (validated.isDefault !== undefined) updateData.is_default = validated.isDefault
    if (validated.autoCalculateQuantity !== undefined) updateData.auto_calculate_quantity = validated.autoCalculateQuantity
    if (validated.isActive !== undefined) updateData.is_active = validated.isActive
    
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // Cập nhật mối quan hệ với biểu thức
    // Xóa các usage cũ
    await supabase
      .from('service_formula_usage')
      .delete()
      .eq('service_id', id)

    // Tạo lại các usage mới
    // Lưu nếu có chọn biểu thức (không cần kiểm tra checkbox)
    const usageInserts: any[] = []
    
    if (quantityFormulaExpression) {
      usageInserts.push({
        service_id: id,
        formula_id: quantityFormulaExpression,
        usage_type: 'quantity',
      })
    }
    
    if (priceFormulaExpression) {
      usageInserts.push({
        service_id: id,
        formula_id: priceFormulaExpression,
        usage_type: 'price',
      })
    }

    if (usageInserts.length > 0) {
      const { error: usageError } = await supabase
        .from('service_formula_usage')
        .insert(usageInserts)

      if (usageError) {
        console.error('Error updating service formula usage:', usageError)
        // Không throw error, chỉ log vì service đã được cập nhật thành công
      }
    }

    return res.json({
      id: data.id,
      code: data.code,
      name: data.name,
      unit: data.unit,
      taxPercentage: parseFloat(data.tax_percentage) || 0,
      materialType: data.material_type,
      useQuantityFormula: data.use_quantity_formula,
      usePriceFormula: data.use_price_formula,
      displayOrder: data.display_order,
      isDefault: data.is_default,
      autoCalculateQuantity: data.auto_calculate_quantity,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error updating service:', error)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Service with this code already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update service' })
  }
}

export const deleteService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)

    if (error) throw error

    return res.status(204).send()
  } catch (error: any) {
    console.error('Error deleting service:', error)
    // Check if service is referenced by other tables
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete service as it is being used' })
    }
    return res.status(500).json({ error: 'Failed to delete service' })
  }
}

