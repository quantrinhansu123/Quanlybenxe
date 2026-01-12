import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.js'
import { db } from '../db/drizzle.js'
import { vehicles, vehicleDocuments, operators, vehicleTypes, auditLogs, users } from '../db/schema/index.js'
import { eq, inArray, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { syncVehicleChanges } from '../utils/denormalization-sync.js'
import { cachedData } from '../services/cached-data.service.js'
import { vehicleCacheService } from '../modules/fleet/services/vehicle-cache.service.js'

const vehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Plate number is required'),
  vehicleTypeId: z.string().min(1).optional(),
  operatorId: z.string().min(1, 'Invalid operator ID').optional(),
  seatCount: z.number().int().positive('Seat capacity must be positive'),
  bedCapacity: z.number().int().optional(),
  chassisNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),

  insuranceExpiry: z.string().optional(),
  roadWorthinessExpiry: z.string().optional(),
  
  cargoLength: z.number().optional(),
  cargoWidth: z.number().optional(),
  cargoHeight: z.number().optional(),
  
  gpsProvider: z.string().optional(),
  gpsUsername: z.string().optional(),
  gpsPassword: z.string().optional(),
  
  province: z.string().optional(),

  notes: z.string().optional(),
  documents: z.object({
    registration: z.object({
      number: z.string(),
      issueDate: z.string(),
      expiryDate: z.string(),
      issuingAuthority: z.string().optional(),
      documentUrl: z.string().optional(),
      notes: z.string().optional(),
    }).optional(),
    inspection: z.object({
      number: z.string(),
      issueDate: z.string(),
      expiryDate: z.string(),
      issuingAuthority: z.string().optional(),
      documentUrl: z.string().optional(),
      notes: z.string().optional(),
    }).optional(),
    insurance: z.object({
      number: z.string(),
      issueDate: z.string(),
      expiryDate: z.string(),
      issuingAuthority: z.string().optional(),
      documentUrl: z.string().optional(),
      notes: z.string().optional(),
    }).optional(),
    operation_permit: z.object({
      number: z.string(),
      issueDate: z.string(),
      expiryDate: z.string(),
      issuingAuthority: z.string().optional(),
      documentUrl: z.string().optional(),
      notes: z.string().optional(),
    }).optional(),
    emblem: z.object({
      number: z.string(),
      issueDate: z.string(),
      expiryDate: z.string(),
      issuingAuthority: z.string().optional(),
      documentUrl: z.string().optional(),
      notes: z.string().optional(),
    }).optional(),
  }).optional(),
})

export const getAllVehicles = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { operatorId, isActive } = req.query
    const activeOnly = isActive !== 'all' && isActive !== 'false'

    // Use cached data for vehicles, operators, and vehicle types
    let vehicles = await cachedData.getAllVehicles(activeOnly)
    
    // Filter by operatorId if provided
    if (operatorId) {
      vehicles = vehicles.filter((v: any) => v.operatorId === operatorId)
    }

    // Filter inactive if specifically requested
    if (isActive === 'false') {
      vehicles = vehicles.filter((v: any) => v.isActive === false)
    }

    // Use cached operators and vehicle types (parallel fetch)
    const [operatorMap, vehicleTypeMap] = await Promise.all([
      cachedData.getOperatorsMap(),
      cachedData.getVehicleTypesMap(),
    ])

    // Fetch documents
    if (!db) throw new Error('Database not initialized')

    const vehicleIds = vehicles.map((v: any) => v.id)
    const documents = await db.select().from(vehicleDocuments).where(inArray(vehicleDocuments.vehicleId, vehicleIds))

    const vehiclesWithDocs = vehicles.map((vehicle: any) => {
      const vehicleDocs = documents?.filter((doc: any) => doc.vehicleId === vehicle.id) || []
      const docsMap: any = {}
      const today = new Date().toISOString().split('T')[0]
      vehicleDocs.forEach((doc: any) => {
        docsMap[doc.documentType] = {
          number: doc.documentNumber,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          issuingAuthority: doc.issuingAuthority,
          documentUrl: doc.documentUrl,
          notes: doc.notes,
          isValid: doc.expiryDate >= today,
        }
      })

      // Manual join with operators and vehicle_types
      const operator = vehicle.operatorId ? operatorMap.get(vehicle.operatorId) as any : null
      const vehicleType = vehicle.vehicleTypeId ? vehicleTypeMap.get(vehicle.vehicleTypeId) as any : null

      return {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vehicleTypeId: vehicle.vehicleTypeId,
        vehicleType: vehicleType ? {
          id: vehicleType.id,
          name: vehicleType.name,
        } : undefined,
        operatorId: vehicle.operatorId,
        operator: operator ? {
          id: operator.id,
          name: operator.name,
          code: operator.code,
        } : undefined,
        seatCapacity: vehicle.seatCount,
        bedCapacity: vehicle.bedCapacity,
        manufactureYear: vehicle.yearOfManufacture,
        chassisNumber: vehicle.chassisNumber,
        engineNumber: vehicle.engineNumber,
        color: vehicle.color,
        imageUrl: vehicle.imageUrl,
        insuranceExpiryDate: vehicle.insuranceExpiry,
        inspectionExpiryDate: vehicle.roadWorthinessExpiry,
        cargoLength: vehicle.cargoLength,
        cargoWidth: vehicle.cargoWidth,
        cargoHeight: vehicle.cargoHeight,
        gpsProvider: vehicle.gpsProvider,
        gpsUsername: vehicle.gpsUsername,
        gpsPassword: vehicle.gpsPassword,
        province: vehicle.province,
        isActive: vehicle.isActive,
        notes: vehicle.notes,
        documents: {
          registration: docsMap.registration || undefined,
          inspection: docsMap.inspection || undefined,
          insurance: docsMap.insurance || undefined,
          operation_permit: docsMap.operation_permit || undefined,
          emblem: docsMap.emblem || undefined,
        },
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt,
      }
    })

    return res.json(vehiclesWithDocs)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch vehicles' })
  }
}

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id))

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    // Fetch operator and vehicle_type for manual join
    if (!db) throw new Error('Database not initialized')

    let operator = null
    let vehicleType = null

    if (vehicle.operatorId) {
      const [op] = await db.select().from(operators).where(eq(operators.id, vehicle.operatorId))
      operator = op
    }
    if (vehicle.vehicleTypeId) {
      const [vt] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, vehicle.vehicleTypeId))
      vehicleType = vt
    }

    const documents = await db.select().from(vehicleDocuments).where(eq(vehicleDocuments.vehicleId, id))

    const docsMap: any = {}
    const today = new Date().toISOString().split('T')[0]
    documents?.forEach((doc: any) => {
      docsMap[doc.documentType] = {
        number: doc.documentNumber,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        issuingAuthority: doc.issuingAuthority,
        documentUrl: doc.documentUrl,
        notes: doc.notes,
        isValid: doc.expiryDate >= today,
      }
    })

    return res.json({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleTypeId: vehicle.vehicleTypeId,
      vehicleType: vehicleType ? {
        id: vehicleType.id,
        name: vehicleType.name,
      } : undefined,
      operatorId: vehicle.operatorId,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
      } : undefined,
      seatCount: vehicle.seatCount,
      bedCapacity: vehicle.bedCapacity,
      yearOfManufacture: vehicle.yearOfManufacture,
      chassisNumber: vehicle.chassisNumber,
      engineNumber: vehicle.engineNumber,
      color: vehicle.color,
      imageUrl: vehicle.imageUrl,

      insuranceExpiry: vehicle.insuranceExpiry,
      roadWorthinessExpiry: vehicle.roadWorthinessExpiry,

      cargoLength: vehicle.cargoLength,
      cargoWidth: vehicle.cargoWidth,
      cargoHeight: vehicle.cargoHeight,

      gpsProvider: vehicle.gpsProvider,
      gpsUsername: vehicle.gpsUsername,
      gpsPassword: vehicle.gpsPassword,

      province: vehicle.province,

      isActive: vehicle.isActive,
      notes: vehicle.notes,
      documents: {
        registration: docsMap.registration || undefined,
        inspection: docsMap.inspection || undefined,
        insurance: docsMap.insurance || undefined,
        operation_permit: docsMap.operation_permit || undefined,
        emblem: docsMap.emblem || undefined,
      },
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch vehicle' })
  }
}

export const createVehicle = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const validated = vehicleSchema.parse(req.body)
    const {
      plateNumber, vehicleTypeId, operatorId, seatCount, bedCapacity,
      chassisNumber, engineNumber, imageUrl,
      insuranceExpiry, roadWorthinessExpiry,
      cargoLength, cargoWidth, cargoHeight,
      gpsProvider, gpsUsername, gpsPassword,
      province,
      notes, documents
    } = validated

    // Insert vehicle
    const [vehicle] = await db.insert(vehicles).values({
      plateNumber,
      vehicleTypeId: vehicleTypeId || null,
      operatorId: operatorId || null,
      seatCount,
      bedCapacity: bedCapacity || 0,
      chassisNumber: chassisNumber || null,
      engineNumber: engineNumber || null,
      imageUrl: imageUrl || null,

      insuranceExpiry: insuranceExpiry || null,
      roadWorthinessExpiry: roadWorthinessExpiry || null,

      cargoLength: cargoLength || null,
      cargoWidth: cargoWidth || null,
      cargoHeight: cargoHeight || null,

      gpsProvider: gpsProvider || null,
      gpsUsername: gpsUsername || null,
      gpsPassword: gpsPassword || null,

      province: province || null,

      notes: notes || null,
      isActive: true,
    }).returning()

    // Fetch operator and vehicle_type for manual join
    if (!db) throw new Error('Database not initialized')

    let operator = null
    let vehicleType = null

    if (vehicle.operatorId) {
      const [op] = await db.select().from(operators).where(eq(operators.id, vehicle.operatorId))
      operator = op
    }
    if (vehicle.vehicleTypeId) {
      const [vt] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, vehicle.vehicleTypeId))
      vehicleType = vt
    }

    // Insert documents
    if (documents) {
      const documentTypes = ['registration', 'inspection', 'insurance', 'operation_permit', 'emblem'] as const
      const documentsToInsert = documentTypes
        .filter((type) => documents[type])
        .map((type) => ({
          vehicleId: vehicle.id,
          documentType: type,
          documentNumber: documents[type]!.number,
          issueDate: documents[type]!.issueDate,
          expiryDate: documents[type]!.expiryDate,
          issuingAuthority: documents[type]!.issuingAuthority || null,
          documentUrl: documents[type]!.documentUrl || null,
          notes: documents[type]!.notes || null,
        }))

      if (documentsToInsert.length > 0) {
        await db.insert(vehicleDocuments).values(documentsToInsert)
      }
    }

    // Fetch the complete vehicle with documents
    const allDocs = await db.select().from(vehicleDocuments).where(eq(vehicleDocuments.vehicleId, vehicle.id))

    const docsMap: any = {}
    const today = new Date().toISOString().split('T')[0]
    allDocs?.forEach((doc: any) => {
      docsMap[doc.documentType] = {
        number: doc.documentNumber,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        issuingAuthority: doc.issuingAuthority,
        documentUrl: doc.documentUrl,
        notes: doc.notes,
        isValid: doc.expiryDate >= today,
      }
    })

    // Invalidate vehicle cache after create
    cachedData.invalidateVehicles()

    return res.status(201).json({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleTypeId: vehicle.vehicleTypeId,
      vehicleType: vehicleType ? {
        id: vehicleType.id,
        name: vehicleType.name,
      } : undefined,
      operatorId: vehicle.operatorId,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
      } : undefined,
      seatCount: vehicle.seatCount,
      bedCapacity: vehicle.bedCapacity,
      chassisNumber: vehicle.chassisNumber,
      engineNumber: vehicle.engineNumber,

      insuranceExpiry: vehicle.insuranceExpiry,
      roadWorthinessExpiry: vehicle.roadWorthinessExpiry,

      cargoLength: vehicle.cargoLength,
      cargoWidth: vehicle.cargoWidth,
      cargoHeight: vehicle.cargoHeight,

      gpsProvider: vehicle.gpsProvider,
      gpsUsername: vehicle.gpsUsername,
      gpsPassword: vehicle.gpsPassword,

      province: vehicle.province,

      isActive: vehicle.isActive,
      notes: vehicle.notes,
      documents: {
        registration: docsMap.registration || undefined,
        inspection: docsMap.inspection || undefined,
        insurance: docsMap.insurance || undefined,
        operation_permit: docsMap.operation_permit || undefined,
        emblem: docsMap.emblem || undefined,
      },
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    })
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Vehicle with this plate number already exists' })
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to create vehicle' })
  }
}

export const updateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params
    const userId = req.user?.id
    const validated = vehicleSchema.partial().parse(req.body)

    // Update vehicle
    const updateData: any = {}
    if (validated.plateNumber) updateData.plateNumber = validated.plateNumber
    // Allow updating vehicleTypeId even if it's empty to clear the value
    if (validated.vehicleTypeId !== undefined) {
      updateData.vehicleTypeId = validated.vehicleTypeId || null
    }
    // Allow updating operatorId - handle both empty string and undefined
    // Empty string from frontend means clear the operator
    if ('operatorId' in req.body) {
      // Field was explicitly sent (even if empty), so update it
      const operatorId = req.body.operatorId
      updateData.operatorId = (operatorId && operatorId.trim() !== '') ? operatorId : null
    } else if (validated.operatorId !== undefined) {
      // Validated and present in request
      updateData.operatorId = validated.operatorId || null
    }
    if (validated.seatCount) updateData.seatCount = validated.seatCount
    if (validated.bedCapacity !== undefined) updateData.bedCapacity = validated.bedCapacity || 0
    if (validated.chassisNumber !== undefined) updateData.chassisNumber = validated.chassisNumber || null
    if (validated.engineNumber !== undefined) updateData.engineNumber = validated.engineNumber || null
    if (validated.imageUrl !== undefined) updateData.imageUrl = validated.imageUrl || null

    if (validated.insuranceExpiry !== undefined) updateData.insuranceExpiry = validated.insuranceExpiry || null
    if (validated.roadWorthinessExpiry !== undefined) updateData.roadWorthinessExpiry = validated.roadWorthinessExpiry || null

    if (validated.cargoLength !== undefined) updateData.cargoLength = validated.cargoLength || null
    if (validated.cargoWidth !== undefined) updateData.cargoWidth = validated.cargoWidth || null
    if (validated.cargoHeight !== undefined) updateData.cargoHeight = validated.cargoHeight || null

    if (validated.gpsProvider !== undefined) updateData.gpsProvider = validated.gpsProvider || null
    if (validated.gpsUsername !== undefined) updateData.gpsUsername = validated.gpsUsername || null
    if (validated.gpsPassword !== undefined) updateData.gpsPassword = validated.gpsPassword || null

    if (validated.province !== undefined) updateData.province = validated.province || null

    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    if (Object.keys(updateData).length > 0) {
      await db.update(vehicles).set(updateData).where(eq(vehicles.id, id))
    }

    // Update documents if provided
    if (validated.documents) {
      const documentTypes = ['registration', 'inspection', 'insurance', 'operation_permit', 'emblem'] as const

      for (const type of documentTypes) {
        if (validated.documents[type]) {
          const doc = validated.documents[type]!

          // Check if document already exists
          const [existingDoc] = await db.select().from(vehicleDocuments)
            .where(and(eq(vehicleDocuments.vehicleId, id), eq(vehicleDocuments.documentType, type)))

          if (existingDoc) {
            // Update existing document
            await db.update(vehicleDocuments).set({
              documentNumber: doc.number,
              issueDate: doc.issueDate,
              expiryDate: doc.expiryDate,
              issuingAuthority: doc.issuingAuthority || null,
              documentUrl: doc.documentUrl || null,
              notes: doc.notes || null,
              updatedBy: userId || null,
              updatedAt: new Date(),
            }).where(eq(vehicleDocuments.id, existingDoc.id))
          } else {
            // Insert new document
            await db.insert(vehicleDocuments).values({
              vehicleId: id,
              documentType: type,
              documentNumber: doc.number,
              issueDate: doc.issueDate,
              expiryDate: doc.expiryDate,
              issuingAuthority: doc.issuingAuthority || null,
              documentUrl: doc.documentUrl || null,
              notes: doc.notes || null,
              updatedBy: userId || null,
            })
          }
        }
      }
    }

    // Fetch updated vehicle
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id))

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found after update' })
    }

    // Fetch operator and vehicle_type for manual join
    if (!db) throw new Error('Database not initialized')

    let operator = null
    let vehicleType = null

    if (vehicle.operatorId) {
      const [op] = await db.select().from(operators).where(eq(operators.id, vehicle.operatorId))
      operator = op
    }
    if (vehicle.vehicleTypeId) {
      const [vt] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, vehicle.vehicleTypeId))
      vehicleType = vt
    }

    // Sync denormalized data to dispatch_records if plate_number or operator changed
    if (updateData.plateNumber || updateData.operatorId !== undefined) {
      // Run sync in background (non-blocking)
      syncVehicleChanges(id, {
        plateNumber: vehicle.plateNumber,
        operatorId: vehicle.operatorId,
        operatorName: operator?.name || null,
        operatorCode: operator?.code || null,
      }).catch((err) => {
        console.error('[Vehicle Update] Failed to sync denormalized data:', err)
      })
    }

    // Invalidate vehicle cache after update
    cachedData.invalidateVehicles()

    const documents = await db.select().from(vehicleDocuments).where(eq(vehicleDocuments.vehicleId, id))

    const docsMap: any = {}
    const today = new Date().toISOString().split('T')[0]
    documents?.forEach((doc: any) => {
      docsMap[doc.documentType] = {
        number: doc.documentNumber,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        issuingAuthority: doc.issuingAuthority,
        documentUrl: doc.documentUrl,
        notes: doc.notes,
        isValid: doc.expiryDate >= today,
      }
    })

    return res.json({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleTypeId: vehicle.vehicleTypeId,
      vehicleType: vehicleType ? {
        id: vehicleType.id,
        name: vehicleType.name,
      } : undefined,
      operatorId: vehicle.operatorId,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
      } : undefined,
      seatCount: vehicle.seatCount,
      bedCapacity: vehicle.bedCapacity,
      yearOfManufacture: vehicle.yearOfManufacture,
      chassisNumber: vehicle.chassisNumber,
      engineNumber: vehicle.engineNumber,
      color: vehicle.color,
      imageUrl: vehicle.imageUrl,

      insuranceExpiry: vehicle.insuranceExpiry,
      roadWorthinessExpiry: vehicle.roadWorthinessExpiry,

      cargoLength: vehicle.cargoLength,
      cargoWidth: vehicle.cargoWidth,
      cargoHeight: vehicle.cargoHeight,

      gpsProvider: vehicle.gpsProvider,
      gpsUsername: vehicle.gpsUsername,
      gpsPassword: vehicle.gpsPassword,

      province: vehicle.province,

      isActive: vehicle.isActive,
      notes: vehicle.notes,
      documents: {
        registration: docsMap.registration || undefined,
        inspection: docsMap.inspection || undefined,
        insurance: docsMap.insurance || undefined,
        operation_permit: docsMap.operation_permit || undefined,
        emblem: docsMap.emblem || undefined,
      },
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message })
    }
    return res.status(500).json({ error: error.message || 'Failed to update vehicle' })
  }
}

export const getVehicleDocumentAuditLogs = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id: vehicleId } = req.params

    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID is required' })
    }

    // Lấy tất cả vehicle_documents của xe này
    const vehicleDocs = await db.select({ id: vehicleDocuments.id })
      .from(vehicleDocuments)
      .where(eq(vehicleDocuments.vehicleId, vehicleId))

    const docIds = vehicleDocs.map(doc => doc.id)

    if (docIds.length === 0) {
      return res.json([])
    }

    // Lấy audit logs cho các documents này - với manual join
    const logs = await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.tableName, 'vehicle_documents'),
        inArray(auditLogs.recordId, docIds)
      ))
      .orderBy(desc(auditLogs.createdAt))

    // Fetch users for names
    const userIds = [...new Set(logs.map(log => log.userId).filter(Boolean))]
    const usersData = userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds as string[]))
      : []

    const userMap = new Map(
      usersData.map(u => [u.id, u.name || u.email || 'Không xác định'])
    )

    // Format response
    // Convert timestamp to Vietnam timezone (UTC+7) for display
    const formattedLogs = logs.map((log) => {
      let createdAt = log.createdAt?.toISOString() || ''

      // If timestamp is UTC (ends with Z), convert to Vietnam time (add +07:00)
      if (createdAt && typeof createdAt === 'string') {
        if (createdAt.endsWith('Z')) {
          // UTC timestamp, add 7 hours and format as +07:00
          const utcDate = new Date(createdAt)
          const vietnamDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000)
          const year = vietnamDate.getUTCFullYear()
          const month = String(vietnamDate.getUTCMonth() + 1).padStart(2, '0')
          const day = String(vietnamDate.getUTCDate()).padStart(2, '0')
          const hours = String(vietnamDate.getUTCHours()).padStart(2, '0')
          const minutes = String(vietnamDate.getUTCMinutes()).padStart(2, '0')
          const seconds = String(vietnamDate.getUTCSeconds()).padStart(2, '0')
          createdAt = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`
        } else if (!createdAt.includes('+') && !createdAt.includes('Z')) {
          // No timezone info, assume it's already Vietnam time, add +07:00
          createdAt = createdAt.endsWith('+07:00') ? createdAt : `${createdAt}+07:00`
        }
      }

      return {
        id: log.id,
        userId: log.userId,
        userName: log.userId ? (userMap.get(log.userId) || 'Không xác định') : 'Không xác định',
        action: log.action,
        recordId: log.recordId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        createdAt,
      }
    })

    return res.json(formattedLogs)
  } catch (error: any) {
    console.error('Error fetching vehicle document audit logs:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch audit logs' })
  }
}

/**
 * Get all document audit logs for all vehicles (optimized single query)
 */
export const getAllDocumentAuditLogs = async (_req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    // Get all audit logs for vehicle_documents in one query
    const logs = await db.select().from(auditLogs)
      .where(eq(auditLogs.tableName, 'vehicle_documents'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(500)

    if (!logs || logs.length === 0) {
      return res.json([])
    }

    // Get unique vehicle_document IDs
    const docIds = [...new Set(logs.map(log => log.recordId))]

    // Fetch vehicle_documents to get vehicle_id
    const vehicleDocs = await db.select({
      id: vehicleDocuments.id,
      vehicleId: vehicleDocuments.vehicleId
    }).from(vehicleDocuments).where(inArray(vehicleDocuments.id, docIds))

    const docToVehicleMap = new Map(
      vehicleDocs.map(doc => [doc.id, doc.vehicleId])
    )

    // Get unique vehicle IDs
    const vehicleIds = [...new Set(
      vehicleDocs.map(doc => doc.vehicleId).filter(Boolean)
    )]

    // Fetch vehicles to get plate numbers
    const vehiclesData = vehicleIds.length > 0
      ? await db.select({
          id: vehicles.id,
          plateNumber: vehicles.plateNumber
        }).from(vehicles).where(inArray(vehicles.id, vehicleIds as string[]))
      : []

    const vehicleMap = new Map(
      vehiclesData.map(v => [v.id, v.plateNumber])
    )

    // Fetch users for names
    const userIds = [...new Set(logs.map(log => log.userId).filter(Boolean))]
    const usersData = userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds as string[]))
      : []

    const userMap = new Map(
      usersData.map(u => [u.id, u.name || u.email || 'Không xác định'])
    )

    // Format response
    const formattedLogs = logs.map((log) => {
      const vehicleId = docToVehicleMap.get(log.recordId)
      const plateNumber = vehicleId ? vehicleMap.get(vehicleId) : null

      let createdAt = log.createdAt?.toISOString() || ''
      if (createdAt && typeof createdAt === 'string' && createdAt.endsWith('Z')) {
        const utcDate = new Date(createdAt)
        const vietnamDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000)
        createdAt = vietnamDate.toISOString().replace('Z', '+07:00')
      }

      return {
        id: log.id,
        userId: log.userId,
        userName: log.userId ? (userMap.get(log.userId) || 'Không xác định') : 'Không xác định',
        action: log.action,
        recordId: log.recordId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        createdAt,
        vehiclePlateNumber: plateNumber || '-',
      }
    })

    return res.json(formattedLogs)
  } catch (error: any) {
    console.error('Error fetching all document audit logs:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch audit logs' })
  }
}

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { id } = req.params

    // Soft delete: set is_active to false instead of deleting
    const [data] = await db.update(vehicles)
      .set({ isActive: false })
      .where(eq(vehicles.id, id))
      .returning()

    if (!data) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    // Invalidate vehicle cache after delete
    cachedData.invalidateVehicles()

    return res.json({
      id: data.id,
      isActive: data.isActive,
      message: 'Vehicle deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting vehicle:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete vehicle' })
  }
}

/**
 * Lookup vehicle by plate number using cached data
 * Uses VehicleCacheService for fast lookup (30min cache TTL)
 * Returns seat capacity and other info for ANY vehicle
 */
export const lookupVehicleByPlate = async (req: Request, res: Response) => {
  try {
    if (!db) throw new Error('Database not initialized')

    const { plate } = req.params
    if (!plate) {
      return res.status(400).json({ error: 'Plate number is required' })
    }

    // Use cached lookup - much faster than DB query
    let vehicle = await vehicleCacheService.lookupByPlate(plate)

    // Fallback: direct DB query if not found in cache
    if (!vehicle) {
      // Query directly by plate_number (exact match or with common variations)
      const plateVariations = [
        plate,
        plate.replace(/[.\-\s]/g, ''),
        plate.toUpperCase(),
        plate.replace(/[.\-\s]/g, '').toUpperCase(),
      ]

      for (const p of plateVariations) {
        const results = await db.select({
          id: vehicles.id,
          plateNumber: vehicles.plateNumber,
          seatCount: vehicles.seatCount,
          bedCapacity: vehicles.bedCapacity,
          operatorName: vehicles.operatorName,
        }).from(vehicles).where(eq(vehicles.plateNumber, p)).limit(1)

        if (results.length > 0) {
          const v = results[0]
          vehicle = {
            id: v.id,
            plateNumber: v.plateNumber || '',
            seatCapacity: v.seatCount || 0,
            bedCapacity: v.bedCapacity || 0,
            operatorName: v.operatorName || '',
            vehicleType: '',
            source: 'legacy' as const,
          }
          break
        }
      }
    }

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    return res.json({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      seatCapacity: vehicle.seatCapacity || vehicle.bedCapacity || 0,
      operatorName: vehicle.operatorName,
      vehicleType: vehicle.vehicleType,
      source: vehicle.source,
    })
  } catch (error: any) {
    console.error('Error looking up vehicle:', error)
    return res.status(500).json({ error: error.message || 'Failed to lookup vehicle' })
  }
}
