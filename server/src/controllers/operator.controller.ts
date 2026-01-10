import { Request, Response } from 'express'
import { firebaseDb } from '../config/database.js'
import { db } from '../db/drizzle.js'
import { operators } from '../db/schema/operators.js'
import { eq, desc } from 'drizzle-orm'
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
    if (!db) throw new Error('Database not initialized')

    const { isActive } = req.query

    let query = db.select().from(operators).orderBy(desc(operators.createdAt))

    // Apply isActive filter if provided
    const data = await query

    const filteredData = isActive !== undefined
      ? data.filter(op => op.isActive === (isActive === 'true'))
      : data

    const operatorsData = filteredData.map((op: any) => ({
      id: op.id,
      name: op.name,
      code: op.code,
      taxCode: op.taxCode,

      isTicketDelegated: op.isTicketDelegated,
      province: op.province,
      district: op.district,
      address: op.address,

      phone: op.phone,
      email: op.email,
      representativeName: op.representative,
      representativePosition: op.representativePosition,

      isActive: op.isActive,
      createdAt: op.createdAt,
      updatedAt: op.updatedAt,
    }))

    return res.json(operatorsData)
  } catch (error) {
    console.error('Error fetching operators:', error)
    return res.status(500).json({ error: 'Failed to fetch operators' })
  }
}

/**
 * Get all operators from Google Sheets (datasheet/DONVIVANTAI)
 * Filtered to only include operators that have badges of type "Buýt" or "Tuyến cố định"
 * Uses Ref_DonViCapPhuHieu from badges to match operators
 */
export const getLegacyOperators = async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    
    // Check cache
    if (!forceRefresh && legacyOperatorsCache && Date.now() - legacyOperatorsCache.timestamp < LEGACY_CACHE_TTL) {
      return res.json(legacyOperatorsCache.data)
    }
    
    // Allowed badge types
    const allowedBadgeTypes = ['Buýt', 'Tuyến cố định']
    
    // Load badges and operators data in parallel
    const [badgeSnapshot, operatorSnapshot] = await Promise.all([
      firebaseDb.ref('datasheet/PHUHIEUXE').once('value'),
      firebaseDb.ref('datasheet/DONVIVANTAI').once('value')
    ])
    
    const badgeData = badgeSnapshot.val()
    const sheetData = operatorSnapshot.val()
    
    // Find unique operator IDs from badges with allowed types (via Ref_DonViCapPhuHieu)
    const operatorIdsWithBadges = new Set<string>()
    if (badgeData) {
      for (const [, badge] of Object.entries(badgeData)) {
        const b = badge as Record<string, unknown>
        if (!b) continue
        
        const badgeType = (b.badge_type || b.LoaiPH || '') as string
        if (!allowedBadgeTypes.includes(badgeType)) continue
        
        // Get the operator ref from badge
        const operatorRef = (b.issuing_authority_ref || b.Ref_DonViCapPhuHieu || '') as string
        if (operatorRef) {
          operatorIdsWithBadges.add(operatorRef)
        }
      }
    }
    
    console.log(`[getLegacyOperators] Found ${operatorIdsWithBadges.size} unique operators with Buýt/Tuyến cố định badges`)
    
    // Convert sheet operators to standard format, filtering by operator IDs from badges
    const operators: any[] = []
    let totalCount = 0
    
    if (sheetData) {
      Object.entries(sheetData).forEach(([key, v]: [string, any]) => {
        totalCount++
        const operatorId = v.id || key
        
        // Only include operators that have badges with allowed types
        if (!operatorIdsWithBadges.has(operatorId)) {
          return
        }
        
        // Normalize province name
        let province = (v.province || '').trim()
        province = province.replace(/^\s*→\s*"?/g, '').replace(/"$/g, '').trim()
        if (province.includes('Tỉnh Tỉnh')) province = province.replace('Tỉnh Tỉnh', 'Tỉnh')
        
        operators.push({
          id: operatorId,
          name: v.name || '',
          code: '',
          province: province,
          district: v.district || '',
          ward: v.ward || '',
          address: v.address || '',
          fullAddress: v.full_address || '',
          phone: v.phone || '',
          email: v.email || '',
          taxCode: v.tax_code || '',
          businessLicense: v.business_license || '',
          representativeName: v.representative_name || '',
          businessType: v.business_type || '',
          registrationProvince: v.registration_province || '',
          isActive: true,
          source: 'google_sheets',
        })
      })
    }
    
    console.log(`[getLegacyOperators] Filtered to ${operators.length} operators (out of ${totalCount} total)`)
    
    // Sort by name
    operators.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    
    // Update cache
    legacyOperatorsCache = { data: operators, timestamp: Date.now() }
    
    return res.json(operators)
  } catch (error) {
    console.error('Error fetching operators:', error)
    // Return stale cache if available
    if (legacyOperatorsCache) {
      return res.json(legacyOperatorsCache.data)
    }
    return res.status(500).json({ error: 'Failed to fetch operators' })
  }
}

export const getOperatorById = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    const [data] = await db.select().from(operators).where(eq(operators.id, id))

    if (!data) {
      return res.status(404).json({ error: 'Operator not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      code: data.code,
      taxCode: data.taxCode,

      isTicketDelegated: data.isTicketDelegated,
      province: data.province,
      district: data.district,
      address: data.address,

      phone: data.phone,
      email: data.email,
      representativeName: data.representative,
      representativePosition: data.representativePosition,

      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching operator:', error)
    return res.status(500).json({ error: 'Failed to fetch operator' })
  }
}

export const createOperator = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const validated = operatorSchema.parse(req.body)

    const [data] = await db.insert(operators).values({
      name: validated.name,
      code: validated.code,
      taxCode: validated.taxCode || null,

      isTicketDelegated: validated.isTicketDelegated || false,
      province: validated.province && validated.province.trim() !== '' ? validated.province.trim() : null,
      district: validated.district && validated.district.trim() !== '' ? validated.district.trim() : null,
      address: validated.address || null,

      phone: validated.phone || null,
      email: validated.email || null,
      representative: validated.representativeName || null,
      representativePosition: validated.representativePosition || null,

      isActive: true,
    }).returning()

    return res.status(201).json({
      id: data.id,
      name: data.name,
      code: data.code,
      taxCode: data.taxCode,

      isTicketDelegated: data.isTicketDelegated,
      province: data.province,
      district: data.district,
      address: data.address,

      phone: data.phone,
      email: data.email,
      representativeName: data.representative,
      representativePosition: data.representativePosition,

      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const validated = operatorSchema.partial().parse(req.body)

    const updateData: any = {}
    if (validated.name) updateData.name = validated.name
    if (validated.code) updateData.code = validated.code
    if (validated.taxCode !== undefined) updateData.taxCode = validated.taxCode || null

    if (validated.isTicketDelegated !== undefined) updateData.isTicketDelegated = validated.isTicketDelegated
    if (validated.province !== undefined) updateData.province = validated.province && validated.province.trim() !== '' ? validated.province.trim() : null
    if (validated.district !== undefined) updateData.district = validated.district && validated.district.trim() !== '' ? validated.district.trim() : null
    if (validated.address !== undefined) updateData.address = validated.address || null

    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.email !== undefined) updateData.email = validated.email || null
    if (validated.representativeName !== undefined) updateData.representative = validated.representativeName || null
    if (validated.representativePosition !== undefined) updateData.representativePosition = validated.representativePosition || null

    const [data] = await db.update(operators).set(updateData).where(eq(operators.id, id)).returning()

    if (!data) {
      return res.status(404).json({ error: 'Operator not found' })
    }

    return res.json({
      id: data.id,
      name: data.name,
      code: data.code,
      taxCode: data.taxCode,

      isTicketDelegated: data.isTicketDelegated,
      province: data.province,
      district: data.district,
      address: data.address,

      phone: data.phone,
      email: data.email,
      representativeName: data.representative,
      representativePosition: data.representativePosition,

      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    await db.delete(operators).where(eq(operators.id, id))

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting operator:', error)
    return res.status(500).json({ error: 'Failed to delete operator' })
  }
}

/**
 * Update operator in RTDB (Google Sheets data)
 */
export const updateLegacyOperator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Get existing operator
    const snapshot = await firebaseDb.ref(`datasheet/DONVIVANTAI/${id}`).once('value')
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Operator not found' })
    }

    // Update operator in RTDB
    const updateData: any = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.email !== undefined) updateData.email = updates.email
    if (updates.address !== undefined) updateData.address = updates.address
    if (updates.province !== undefined) updateData.province = updates.province
    if (updates.district !== undefined) updateData.district = updates.district
    if (updates.representativeName !== undefined) updateData.representative_name = updates.representativeName
    if (updates.taxCode !== undefined) updateData.tax_code = updates.taxCode
    if (updates.businessLicense !== undefined) updateData.business_license = updates.businessLicense
    updateData.updated_at = new Date().toISOString()

    await firebaseDb.ref(`datasheet/DONVIVANTAI/${id}`).update(updateData)

    // Invalidate cache
    legacyOperatorsCache = null

    // Return updated operator
    const updatedSnapshot = await firebaseDb.ref(`datasheet/DONVIVANTAI/${id}`).once('value')
    const data = updatedSnapshot.val()

    return res.json({
      id: id,
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      province: data.province || '',
      district: data.district || '',
      representativeName: data.representative_name || '',
      taxCode: data.tax_code || '',
      businessLicense: data.business_license || '',
      businessType: data.business_type || '',
      isActive: true,
      source: 'google_sheets',
    })
  } catch (error: any) {
    console.error('Error updating legacy operator:', error)
    return res.status(500).json({ error: error.message || 'Failed to update operator' })
  }
}

/**
 * Delete operator from RTDB (Google Sheets data)
 */
export const deleteLegacyOperator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Check if operator exists
    const snapshot = await firebaseDb.ref(`datasheet/DONVIVANTAI/${id}`).once('value')
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Operator not found' })
    }

    // Delete from RTDB
    await firebaseDb.ref(`datasheet/DONVIVANTAI/${id}`).remove()

    // Invalidate cache
    legacyOperatorsCache = null

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting legacy operator:', error)
    return res.status(500).json({ error: 'Failed to delete operator' })
  }
}

