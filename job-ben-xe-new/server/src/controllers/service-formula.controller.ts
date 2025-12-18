import { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { z } from 'zod'

const serviceFormulaSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  formulaType: z.enum(['quantity', 'price'], {
    errorMap: () => ({ message: 'Formula type must be either quantity or price' }),
  }),
  formulaExpression: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const getAllServiceFormulas = async (req: Request, res: Response) => {
  try {
    const { formulaType, isActive } = req.query

    // Use the view to get formulas with usage information
    let query = supabase
      .from('service_formulas_status')
      .select('*')
      .order('formula_type', { ascending: true })
      .order('code', { ascending: true })

    if (formulaType) {
      query = query.eq('formula_type', formulaType as string)
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    const formulas = data.map((formula: any) => ({
      id: formula.id,
      code: formula.code,
      name: formula.name,
      description: formula.description,
      formulaType: formula.formula_type,
      formulaExpression: formula.formula_expression,
      isActive: formula.is_active,
      usageCount: formula.usage_count || 0,
      usedByServices: formula.used_by_services || '',
      createdAt: formula.created_at,
      updatedAt: formula.updated_at,
    }))

    return res.json(formulas)
  } catch (error: any) {
    console.error('Error fetching service formulas:', error)
    return res.status(500).json({ error: 'Failed to fetch service formulas' })
  }
}

export const getServiceFormulaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('service_formulas')
      .select(`
        *,
        service_formula_usage!inner(
          service_id,
          services:service_id(name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service formula not found' })
    }

    // Get usage information
    const { data: usageData } = await supabase
      .from('service_formula_usage')
      .select(`
        service_id,
        services:service_id(name)
      `)
      .eq('formula_id', id)

    const usedByServices = usageData
      ?.map((usage: any) => usage.services?.name)
      .filter(Boolean)
      .join(', ') || ''

    return res.json({
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      formulaType: data.formula_type,
      formulaExpression: data.formula_expression,
      isActive: data.is_active,
      usageCount: usageData?.length || 0,
      usedByServices,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error fetching service formula:', error)
    return res.status(500).json({ error: 'Failed to fetch service formula' })
  }
}

export const createServiceFormula = async (req: Request, res: Response) => {
  try {
    const validated = serviceFormulaSchema.parse(req.body)

    const { data, error } = await supabase
      .from('service_formulas')
      .insert({
        code: validated.code,
        name: validated.name,
        description: validated.description,
        formula_type: validated.formulaType,
        formula_expression: validated.formulaExpression,
        is_active: validated.isActive,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      formulaType: data.formula_type,
      formulaExpression: data.formula_expression,
      isActive: data.is_active,
      usageCount: 0,
      usedByServices: '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Formula code already exists' })
    }
    console.error('Error creating service formula:', error)
    return res.status(500).json({ error: 'Failed to create service formula' })
  }
}

export const updateServiceFormula = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = serviceFormulaSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.code !== undefined) updateData.code = validated.code
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.description !== undefined) updateData.description = validated.description
    if (validated.formulaType !== undefined) updateData.formula_type = validated.formulaType
    if (validated.formulaExpression !== undefined) updateData.formula_expression = validated.formulaExpression
    if (validated.isActive !== undefined) updateData.is_active = validated.isActive

    const { data, error } = await supabase
      .from('service_formulas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service formula not found' })
    }

    // Get usage information
    const { data: usageData } = await supabase
      .from('service_formula_usage')
      .select(`
        service_id,
        services:service_id(name)
      `)
      .eq('formula_id', id)

    const usedByServices = usageData
      ?.map((usage: any) => usage.services?.name)
      .filter(Boolean)
      .join(', ') || ''

    return res.json({
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      formulaType: data.formula_type,
      formulaExpression: data.formula_expression,
      isActive: data.is_active,
      usageCount: usageData?.length || 0,
      usedByServices,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Formula code already exists' })
    }
    console.error('Error updating service formula:', error)
    return res.status(500).json({ error: 'Failed to update service formula' })
  }
}

export const deleteServiceFormula = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Check if formula is being used
    const { data: usageData, error: usageError } = await supabase
      .from('service_formula_usage')
      .select('service_id')
      .eq('formula_id', id)

    if (usageError) throw usageError

    if (usageData && usageData.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete formula that is being used by services',
        usageCount: usageData.length
      })
    }

    const { error } = await supabase
      .from('service_formulas')
      .delete()
      .eq('id', id)

    if (error) throw error

    return res.status(204).send()
  } catch (error: any) {
    console.error('Error deleting service formula:', error)
    return res.status(500).json({ error: 'Failed to delete service formula' })
  }
}

