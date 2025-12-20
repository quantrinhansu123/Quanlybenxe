import { Request, Response } from 'express'
import { firebase, firebaseDb } from '../config/database.js'
import { z } from 'zod'

// Cache for legacy operators
let legacyOperatorsCache: { data: any[]; timestamp: number } | null = null
const LEGACY_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

const operatorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  taxCode: z.string().optional(),
  
  isTicketDelegated: z.boolean().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  representativeName: z.string().optional(),
  representativePosition: z.string().optional(),
})

export const getAllOperators = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query

    let query = firebase
      .from('operators')
      .select('*')
      .order('created_at', { ascending: false })

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    const operators = data.map((op: any) => ({
      id: op.id,
      name: op.name,
      code: op.code,
      taxCode: op.tax_code,
      
      isTicketDelegated: op.is_ticket_delegated,
      province: op.province,
      district: op.district,
      address: op.address,
      
      phone: op.phone,
      email: op.email,
      representativeName: op.representative_name,
      representativePosition: op.representative_position,
      
      isActive: op.is_active,
      createdAt: op.created_at,
      updatedAt: op.updated_at,
    }))

    return res.json(operators)
  } catch (error) {
    console.error('Error fetching operators:', error)
    return res.status(500).json({ error: 'Failed to fetch operators' })
  }
}

/**
 * Get legacy operators from datasheet/Xe (unique owner_name values)
 * Combined with regular operators for complete list
 */
export const getLegacyOperators = async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    
    // Check cache
    if (!forceRefresh && legacyOperatorsCache && Date.now() - legacyOperatorsCache.timestamp < LEGACY_CACHE_TTL) {
      return res.json(legacyOperatorsCache.data)
    }
    
    // Load regular operators first
    const { data: regularOps } = await firebase
      .from('operators')
      .select('*')
      .eq('is_active', true)
    
    const regularOperators = (regularOps || []).map((op: any) => ({
      id: op.id,
      name: op.name,
      code: op.code,
      isActive: true,
      source: 'database',
    }))
    
    // Load unique owner_name from datasheet/Xe
    const snapshot = await firebaseDb.ref('datasheet/Xe').once('value')
    const xeData = snapshot.val()
    
    const ownerSet = new Map<string, string>() // name -> generated id
    if (xeData) {
      Object.entries(xeData).forEach(([key, v]: [string, any]) => {
        const name = (v.owner_name || v.TenDangKyXe || '').trim()
        if (name && !ownerSet.has(name)) {
          ownerSet.set(name, `legacy_op_${key}`)
        }
      })
    }
    
    // Convert to operator format
    const legacyOperators = Array.from(ownerSet.entries()).map(([name, id]) => ({
      id,
      name,
      code: '', // No code for legacy
      isActive: true,
      source: 'legacy',
    }))
    
    // Merge: regular operators first, then legacy (avoid duplicates by name)
    const regularNames = new Set(regularOperators.map((o: any) => o.name.toLowerCase()))
    const uniqueLegacy = legacyOperators.filter(o => !regularNames.has(o.name.toLowerCase()))
    
    const allOperators = [...regularOperators, ...uniqueLegacy]
    
    // Sort by name
    allOperators.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    
    // Update cache
    legacyOperatorsCache = { data: allOperators, timestamp: Date.now() }
    
    return res.json(allOperators)
  } catch (error) {
    console.error('Error fetching legacy operators:', error)
    // Return stale cache if available
    if (legacyOperatorsCache) {
      return res.json(legacyOperatorsCache.data)
    }
    return res.status(500).json({ error: 'Failed to fetch operators' })
  }
}

export const getOperatorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await firebase
      .from('operators')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Operator not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      code: data.code,
      taxCode: data.tax_code,
      
      isTicketDelegated: data.is_ticket_delegated,
      province: data.province,
      district: data.district,
      address: data.address,
      
      phone: data.phone,
      email: data.email,
      representativeName: data.representative_name,
      representativePosition: data.representative_position,
      
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error) {
    console.error('Error fetching operator:', error)
    return res.status(500).json({ error: 'Failed to fetch operator' })
  }
}

export const createOperator = async (req: Request, res: Response) => {
  try {
    const validated = operatorSchema.parse(req.body)

    const { data, error } = await firebase
      .from('operators')
      .insert({
        name: validated.name,
        code: validated.code,
        tax_code: validated.taxCode || null,
        
        is_ticket_delegated: validated.isTicketDelegated || false,
        province: validated.province && validated.province.trim() !== '' ? validated.province.trim() : null,
        district: validated.district && validated.district.trim() !== '' ? validated.district.trim() : null,
        address: validated.address || null,
        
        phone: validated.phone || null,
        email: validated.email || null,
        representative_name: validated.representativeName || null,
        representative_position: validated.representativePosition || null,
        
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({
      id: data.id,
      name: data.name,
      code: data.code,
      taxCode: data.tax_code,
      
      isTicketDelegated: data.is_ticket_delegated,
      province: data.province,
      district: data.district,
      address: data.address,
      
      phone: data.phone,
      email: data.email,
      representativeName: data.representative_name,
      representativePosition: data.representative_position,
      
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error creating operator:', error)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Operator with this code already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create operator' })
  }
}

export const updateOperator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const validated = operatorSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.name) updateData.name = validated.name
    if (validated.code) updateData.code = validated.code
    if (validated.taxCode !== undefined) updateData.tax_code = validated.taxCode || null
    
    if (validated.isTicketDelegated !== undefined) updateData.is_ticket_delegated = validated.isTicketDelegated
    if (validated.province !== undefined) updateData.province = validated.province && validated.province.trim() !== '' ? validated.province.trim() : null
    if (validated.district !== undefined) updateData.district = validated.district && validated.district.trim() !== '' ? validated.district.trim() : null
    if (validated.address !== undefined) updateData.address = validated.address || null
    
    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.email !== undefined) updateData.email = validated.email || null
    if (validated.representativeName !== undefined) updateData.representative_name = validated.representativeName || null
    if (validated.representativePosition !== undefined) updateData.representative_position = validated.representativePosition || null

    const { data, error } = await firebase
      .from('operators')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Operator not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      code: data.code,
      taxCode: data.tax_code,
      
      isTicketDelegated: data.is_ticket_delegated,
      province: data.province,
      district: data.district,
      address: data.address,
      
      phone: data.phone,
      email: data.email,
      representativeName: data.representative_name,
      representativePosition: data.representative_position,
      
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Error updating operator:', error)
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update operator' })
  }
}

export const deleteOperator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await firebase
      .from('operators')
      .delete()
      .eq('id', id)

    if (error) throw error

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting operator:', error)
    return res.status(500).json({ error: 'Failed to delete operator' })
  }
}

