import { Request, Response } from 'express'
import { firebase } from '../config/database.js'
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

    // Query from service_formulas table directly (Firebase doesn't support views)
    let query = firebase
      .from('service_formulas')
      .select('*')

    if (formulaType) {
      query = query.eq('formula_type', formulaType as string)
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    // Get formula usage data
    const { data: usageData } = await firebase
      .from('service_formula_usage')
      .select('*')

    // Get services data to get service names
    const { data: servicesData } = await firebase
      .from('services')
      .select('*')

    // Create a map of formula_id -> service names
    const formulaUsageMap: Record<string, { count: number; serviceNames: string[] }> = {}

    if (usageData && servicesData) {
      const servicesMap = new Map(servicesData.map((s: any) => [s.id, s.name]))

      usageData.forEach((usage: any) => {
        const formulaId = usage.formula_id
        const serviceName = servicesMap.get(usage.service_id) as string

        if (!formulaUsageMap[formulaId]) {
          formulaUsageMap[formulaId] = { count: 0, serviceNames: [] }
        }

        formulaUsageMap[formulaId].count++
        if (serviceName && !formulaUsageMap[formulaId].serviceNames.includes(serviceName)) {
          formulaUsageMap[formulaId].serviceNames.push(serviceName)
        }
      })
    }

    // Sort in memory since Firebase query builder may not support multiple order by
    const sortedData = (data || []).sort((a: any, b: any) => {
      if (a.formula_type !== b.formula_type) {
        return a.formula_type.localeCompare(b.formula_type)
      }
      return (a.code || '').localeCompare(b.code || '')
    })

    const formulas = sortedData.map((formula: any) => {
      const usage = formulaUsageMap[formula.id] || { count: 0, serviceNames: [] }
      return {
        id: formula.id,
        code: formula.code,
        name: formula.name,
        description: formula.description,
        formulaType: formula.formula_type,
        formulaExpression: formula.formula_expression,
        isActive: formula.is_active,
        usageCount: usage.count,
        usedByServices: usage.serviceNames.join(', '),
        createdAt: formula.created_at,
        updatedAt: formula.updated_at,
      }
    })

    return res.json(formulas)
  } catch (error: any) {
    console.error('Error fetching service formulas:', error)
    return res.status(500).json({ error: 'Failed to fetch service formulas' })
  }
}

export const getServiceFormulaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Query formula directly (Firebase doesn't support SQL-style joins)
    const { data, error } = await firebase
      .from('service_formulas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service formula not found' })
    }

    // Get usage data for this formula
    const { data: usageData } = await firebase
      .from('service_formula_usage')
      .select('*')
      .eq('formula_id', id)

    // Get service names
    let usageCount = 0
    const serviceNames: string[] = []

    if (usageData && usageData.length > 0) {
      usageCount = usageData.length
      const serviceIds = usageData.map((u: any) => u.service_id)

      const { data: servicesData } = await firebase
        .from('services')
        .select('*')

      if (servicesData) {
        servicesData.forEach((s: any) => {
          if (serviceIds.includes(s.id) && !serviceNames.includes(s.name)) {
            serviceNames.push(s.name)
          }
        })
      }
    }

    return res.json({
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      formulaType: data.formula_type,
      formulaExpression: data.formula_expression,
      isActive: data.is_active,
      usageCount: usageCount,
      usedByServices: serviceNames.join(', '),
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

    const { data, error } = await firebase
      .from('service_formulas')
      .insert({
        code: validated.code,
        name: validated.name,
        description: validated.description,
        formula_type: validated.formulaType,
        formula_expression: validated.formulaExpression,
        is_active: validated.isActive,
      })
      .select('*')
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

    const { data, error } = await firebase
      .from('service_formulas')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Service formula not found' })
    }

    return res.json({
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
    console.error('Error updating service formula:', error)
    return res.status(500).json({ error: 'Failed to update service formula' })
  }
}

export const deleteServiceFormula = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Delete formula directly (usage check skipped for Firebase - can be added later)
    const { error } = await firebase
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

