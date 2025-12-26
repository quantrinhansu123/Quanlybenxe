import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.js'
import { firebase } from '../config/database.js'
import { z } from 'zod'
import { syncVehicleChanges } from '../utils/denormalization-sync.js'
import { cachedData } from '../services/cached-data.service.js'
import { vehicleCacheService } from '../modules/fleet/services/vehicle-cache.service.js'

const vehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Plate number is required'),
  vehicleTypeId: z.string().min(1).optional(),
  operatorId: z.string().min(1, 'Invalid operator ID').optional(),
  seatCapacity: z.number().int().positive('Seat capacity must be positive'),
  bedCapacity: z.number().int().optional(),
  chassisNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  
  insuranceExpiryDate: z.string().optional(),
  inspectionExpiryDate: z.string().optional(),
  
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
    const { operatorId, isActive } = req.query
    const activeOnly = isActive !== 'all' && isActive !== 'false'

    // Use cached data for vehicles, operators, and vehicle types
    let vehicles = await cachedData.getAllVehicles(activeOnly)
    
    // Filter by operatorId if provided
    if (operatorId) {
      vehicles = vehicles.filter((v: any) => v.operator_id === operatorId)
    }
    
    // Filter inactive if specifically requested
    if (isActive === 'false') {
      vehicles = vehicles.filter((v: any) => v.is_active === false)
    }

    // Use cached operators and vehicle types (parallel fetch)
    const [operatorMap, vehicleTypeMap] = await Promise.all([
      cachedData.getOperatorsMap(),
      cachedData.getVehicleTypesMap(),
    ])

    // Fetch documents
    const vehicleIds = vehicles.map((v: any) => v.id)
    const { data: documents } = await firebase
      .from('vehicle_documents')
      .select('*')
      .in('vehicle_id', vehicleIds)

    const vehiclesWithDocs = vehicles.map((vehicle: any) => {
      const vehicleDocs = documents?.filter((doc: any) => doc.vehicle_id === vehicle.id) || []
      const docsMap: any = {}
      const today = new Date().toISOString().split('T')[0]
      vehicleDocs.forEach((doc: any) => {
        docsMap[doc.document_type] = {
          number: doc.document_number,
          issueDate: doc.issue_date,
          expiryDate: doc.expiry_date,
          issuingAuthority: doc.issuing_authority,
          documentUrl: doc.document_url,
          notes: doc.notes,
          isValid: doc.expiry_date >= today,
        }
      })

      // Manual join with operators and vehicle_types
      const operator = vehicle.operator_id ? operatorMap.get(vehicle.operator_id) as any : null
      const vehicleType = vehicle.vehicle_type_id ? vehicleTypeMap.get(vehicle.vehicle_type_id) as any : null

      return {
        id: vehicle.id,
        plateNumber: vehicle.plate_number,
        vehicleTypeId: vehicle.vehicle_type_id,
        vehicleType: vehicleType ? {
          id: vehicleType.id,
          name: vehicleType.name,
        } : undefined,
        operatorId: vehicle.operator_id,
        operator: operator ? {
          id: operator.id,
          name: operator.name,
          code: operator.code,
        } : undefined,
        seatCapacity: vehicle.seat_capacity,
        bedCapacity: vehicle.bed_capacity,
        manufactureYear: vehicle.manufacture_year,
        chassisNumber: vehicle.chassis_number,
        engineNumber: vehicle.engine_number,
        color: vehicle.color,
        imageUrl: vehicle.image_url,
        insuranceExpiryDate: vehicle.insurance_expiry_date,
        inspectionExpiryDate: vehicle.inspection_expiry_date,
        cargoLength: vehicle.cargo_length,
        cargoWidth: vehicle.cargo_width,
        cargoHeight: vehicle.cargo_height,
        gpsProvider: vehicle.gps_provider,
        gpsUsername: vehicle.gps_username,
        gpsPassword: vehicle.gps_password,
        province: vehicle.province,
        isActive: vehicle.is_active,
        notes: vehicle.notes,
        documents: {
          registration: docsMap.registration || undefined,
          inspection: docsMap.inspection || undefined,
          insurance: docsMap.insurance || undefined,
          operation_permit: docsMap.operation_permit || undefined,
          emblem: docsMap.emblem || undefined,
        },
        createdAt: vehicle.created_at,
        updatedAt: vehicle.updated_at,
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
    const { id } = req.params

    const { data: vehicle, error: vehicleError } = await firebase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()

    if (vehicleError) throw vehicleError
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    // Fetch operator and vehicle_type for manual join
    let operator = null
    let vehicleType = null
    
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('*').eq('id', vehicle.operator_id).single()
      operator = op
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('*').eq('id', vehicle.vehicle_type_id).single()
      vehicleType = vt
    }

    const { data: documents } = await firebase
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', id)

    const docsMap: any = {}
    const today = new Date().toISOString().split('T')[0]
    documents?.forEach((doc: any) => {
      docsMap[doc.document_type] = {
        number: doc.document_number,
        issueDate: doc.issue_date,
        expiryDate: doc.expiry_date,
        issuingAuthority: doc.issuing_authority,
        documentUrl: doc.document_url,
        notes: doc.notes,
        isValid: doc.expiry_date >= today,
      }
    })

    return res.json({
      id: vehicle.id,
      plateNumber: vehicle.plate_number,
      vehicleTypeId: vehicle.vehicle_type_id,
      vehicleType: vehicleType ? {
        id: vehicleType.id,
        name: vehicleType.name,
      } : undefined,
      operatorId: vehicle.operator_id,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
      } : undefined,
      seatCapacity: vehicle.seat_capacity,
      bedCapacity: vehicle.bed_capacity,
      manufactureYear: vehicle.manufacture_year,
      chassisNumber: vehicle.chassis_number,
      engineNumber: vehicle.engine_number,
      color: vehicle.color,
      imageUrl: vehicle.image_url,

      insuranceExpiryDate: vehicle.insurance_expiry_date,
      inspectionExpiryDate: vehicle.inspection_expiry_date,

      cargoLength: vehicle.cargo_length,
      cargoWidth: vehicle.cargo_width,
      cargoHeight: vehicle.cargo_height,

      gpsProvider: vehicle.gps_provider,
      gpsUsername: vehicle.gps_username,
      gpsPassword: vehicle.gps_password,

      province: vehicle.province,

      isActive: vehicle.is_active,
      notes: vehicle.notes,
      documents: {
        registration: docsMap.registration || undefined,
        inspection: docsMap.inspection || undefined,
        insurance: docsMap.insurance || undefined,
        operation_permit: docsMap.operation_permit || undefined,
        emblem: docsMap.emblem || undefined,
      },
      createdAt: vehicle.created_at,
      updatedAt: vehicle.updated_at,
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
    const validated = vehicleSchema.parse(req.body)
    const { 
      plateNumber, vehicleTypeId, operatorId, seatCapacity, bedCapacity,
      chassisNumber, engineNumber, imageUrl,
      insuranceExpiryDate, inspectionExpiryDate,
      cargoLength, cargoWidth, cargoHeight,
      gpsProvider, gpsUsername, gpsPassword,
      province,
      notes, documents 
    } = validated

    // Insert vehicle
    const { data: vehicle, error: vehicleError } = await firebase
      .from('vehicles')
      .insert({
        plate_number: plateNumber,
        vehicle_type_id: vehicleTypeId || null,
        operator_id: operatorId || null,
        seat_capacity: seatCapacity,
        bed_capacity: bedCapacity || 0,
        chassis_number: chassisNumber || null,
        engine_number: engineNumber || null,
        image_url: imageUrl || null,
        
        insurance_expiry_date: insuranceExpiryDate || null,
        inspection_expiry_date: inspectionExpiryDate || null,
        
        cargo_length: cargoLength || null,
        cargo_width: cargoWidth || null,
        cargo_height: cargoHeight || null,
        
        gps_provider: gpsProvider || null,
        gps_username: gpsUsername || null,
        gps_password: gpsPassword || null,
        
        province: province || null,

        notes: notes || null,
        is_active: true,
      })
      .select('*')
      .single()

    if (vehicleError) throw vehicleError

    // Fetch operator and vehicle_type for manual join
    let operator = null
    let vehicleType = null
    
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('*').eq('id', vehicle.operator_id).single()
      operator = op
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('*').eq('id', vehicle.vehicle_type_id).single()
      vehicleType = vt
    }

    // Insert documents
    if (documents) {
      const documentTypes = ['registration', 'inspection', 'insurance', 'operation_permit', 'emblem'] as const
      const documentsToInsert = documentTypes
        .filter((type) => documents[type])
        .map((type) => ({
          vehicle_id: vehicle.id,
          document_type: type,
          document_number: documents[type]!.number,
          issue_date: documents[type]!.issueDate,
          expiry_date: documents[type]!.expiryDate,
          issuing_authority: documents[type]!.issuingAuthority || null,
          document_url: documents[type]!.documentUrl || null,
          notes: documents[type]!.notes || null,
        }))

      if (documentsToInsert.length > 0) {
        const { error: docsError } = await firebase
          .from('vehicle_documents')
          .insert(documentsToInsert)

        if (docsError) throw docsError
      }
    }

    // Fetch the complete vehicle with documents
    const { data: allDocs } = await firebase
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicle.id)

    const docsMap: any = {}
    const today = new Date().toISOString().split('T')[0]
    allDocs?.forEach((doc: any) => {
      docsMap[doc.document_type] = {
        number: doc.document_number,
        issueDate: doc.issue_date,
        expiryDate: doc.expiry_date,
        issuingAuthority: doc.issuing_authority,
        documentUrl: doc.document_url,
        notes: doc.notes,
        isValid: doc.expiry_date >= today,
      }
    })

    // Invalidate vehicle cache after create
    cachedData.invalidateVehicles()

    return res.status(201).json({
      id: vehicle.id,
      plateNumber: vehicle.plate_number,
      vehicleTypeId: vehicle.vehicle_type_id,
      vehicleType: vehicleType ? {
        id: vehicleType.id,
        name: vehicleType.name,
      } : undefined,
      operatorId: vehicle.operator_id,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
      } : undefined,
      seatCapacity: vehicle.seat_capacity,
      bedCapacity: vehicle.bed_capacity,
      chassisNumber: vehicle.chassis_number,
      engineNumber: vehicle.engine_number,
      
      insuranceExpiryDate: vehicle.insurance_expiry_date,
      inspectionExpiryDate: vehicle.inspection_expiry_date,
      
      cargoLength: vehicle.cargo_length,
      cargoWidth: vehicle.cargo_width,
      cargoHeight: vehicle.cargo_height,
      
      gpsProvider: vehicle.gps_provider,
      gpsUsername: vehicle.gps_username,
      gpsPassword: vehicle.gps_password,
      
      province: vehicle.province,

      isActive: vehicle.is_active,
      notes: vehicle.notes,
      documents: {
        registration: docsMap.registration || undefined,
        inspection: docsMap.inspection || undefined,
        insurance: docsMap.insurance || undefined,
        operation_permit: docsMap.operation_permit || undefined,
        emblem: docsMap.emblem || undefined,
      },
      createdAt: vehicle.created_at,
      updatedAt: vehicle.updated_at,
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
    const { id } = req.params
    const userId = req.user?.id
    const validated = vehicleSchema.partial().parse(req.body)

    // Update vehicle
    const updateData: any = {}
    if (validated.plateNumber) updateData.plate_number = validated.plateNumber
    // Allow updating vehicleTypeId even if it's empty to clear the value
    if (validated.vehicleTypeId !== undefined) {
      updateData.vehicle_type_id = validated.vehicleTypeId || null
    }
    // Allow updating operatorId - handle both empty string and undefined
    // Empty string from frontend means clear the operator
    if ('operatorId' in req.body) {
      // Field was explicitly sent (even if empty), so update it
      const operatorId = req.body.operatorId
      updateData.operator_id = (operatorId && operatorId.trim() !== '') ? operatorId : null
    } else if (validated.operatorId !== undefined) {
      // Validated and present in request
      updateData.operator_id = validated.operatorId || null
    }
    if (validated.seatCapacity) updateData.seat_capacity = validated.seatCapacity
    if (validated.bedCapacity !== undefined) updateData.bed_capacity = validated.bedCapacity || 0
    if (validated.chassisNumber !== undefined) updateData.chassis_number = validated.chassisNumber || null
    if (validated.engineNumber !== undefined) updateData.engine_number = validated.engineNumber || null
    if (validated.imageUrl !== undefined) updateData.image_url = validated.imageUrl || null
    
    if (validated.insuranceExpiryDate !== undefined) updateData.insurance_expiry_date = validated.insuranceExpiryDate || null
    if (validated.inspectionExpiryDate !== undefined) updateData.inspection_expiry_date = validated.inspectionExpiryDate || null
    
    if (validated.cargoLength !== undefined) updateData.cargo_length = validated.cargoLength || null
    if (validated.cargoWidth !== undefined) updateData.cargo_width = validated.cargoWidth || null
    if (validated.cargoHeight !== undefined) updateData.cargo_height = validated.cargoHeight || null
    
    if (validated.gpsProvider !== undefined) updateData.gps_provider = validated.gpsProvider || null
    if (validated.gpsUsername !== undefined) updateData.gps_username = validated.gpsUsername || null
    if (validated.gpsPassword !== undefined) updateData.gps_password = validated.gpsPassword || null
    
    if (validated.province !== undefined) updateData.province = validated.province || null

    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    if (Object.keys(updateData).length > 0) {
      const { error: vehicleError } = await firebase
        .from('vehicles')
        .update(updateData)
        .eq('id', id)

      if (vehicleError) throw vehicleError
    }

    // Update documents if provided
    if (validated.documents) {
      const documentTypes = ['registration', 'inspection', 'insurance', 'operation_permit', 'emblem'] as const
      
      for (const type of documentTypes) {
        if (validated.documents[type]) {
          const doc = validated.documents[type]!
          
          // Check if document already exists
          const { data: existingDoc } = await firebase
            .from('vehicle_documents')
            .select('id')
            .eq('vehicle_id', id)
            .eq('document_type', type)
            .single()

          if (existingDoc) {
            // Update existing document
            const { error: updateError } = await firebase
              .from('vehicle_documents')
              .update({
                document_number: doc.number,
                issue_date: doc.issueDate,
                expiry_date: doc.expiryDate,
                issuing_authority: doc.issuingAuthority || null,
                document_url: doc.documentUrl || null,
                notes: doc.notes || null,
                updated_by: userId || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingDoc.id)

            if (updateError) throw updateError
          } else {
            // Insert new document
            const { error: insertError } = await firebase
              .from('vehicle_documents')
              .insert({
                vehicle_id: id,
                document_type: type,
                document_number: doc.number,
                issue_date: doc.issueDate,
                expiry_date: doc.expiryDate,
                issuing_authority: doc.issuingAuthority || null,
                document_url: doc.documentUrl || null,
                notes: doc.notes || null,
                updated_by: userId || null,
              })

            if (insertError) throw insertError
          }
        }
      }
    }

    // Fetch updated vehicle
    const { data: vehicle } = await firebase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found after update' })
    }

    // Fetch operator and vehicle_type for manual join
    let operator = null
    let vehicleType = null
    
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('*').eq('id', vehicle.operator_id).single()
      operator = op
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('*').eq('id', vehicle.vehicle_type_id).single()
      vehicleType = vt
    }

    // Sync denormalized data to dispatch_records if plate_number or operator changed
    if (updateData.plate_number || updateData.operator_id !== undefined) {
      // Run sync in background (non-blocking)
      syncVehicleChanges(id, {
        plateNumber: vehicle.plate_number,
        operatorId: vehicle.operator_id,
        operatorName: operator?.name || null,
        operatorCode: operator?.code || null,
      }).catch((err) => {
        console.error('[Vehicle Update] Failed to sync denormalized data:', err)
      })
    }

    // Invalidate vehicle cache after update
    cachedData.invalidateVehicles()

    const { data: documents } = await firebase
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', id)

    const docsMap: any = {}
    const today = new Date().toISOString().split('T')[0]
    documents?.forEach((doc: any) => {
      docsMap[doc.document_type] = {
        number: doc.document_number,
        issueDate: doc.issue_date,
        expiryDate: doc.expiry_date,
        issuingAuthority: doc.issuing_authority,
        documentUrl: doc.document_url,
        notes: doc.notes,
        isValid: doc.expiry_date >= today,
      }
    })

    return res.json({
      id: vehicle.id,
      plateNumber: vehicle.plate_number,
      vehicleTypeId: vehicle.vehicle_type_id,
      vehicleType: vehicleType ? {
        id: vehicleType.id,
        name: vehicleType.name,
      } : undefined,
      operatorId: vehicle.operator_id,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        code: operator.code,
      } : undefined,
      seatCapacity: vehicle.seat_capacity,
      bedCapacity: vehicle.bed_capacity,
      manufactureYear: vehicle.manufacture_year,
      chassisNumber: vehicle.chassis_number,
      engineNumber: vehicle.engine_number,
      color: vehicle.color,
      imageUrl: vehicle.image_url,
      
      insuranceExpiryDate: vehicle.insurance_expiry_date,
      inspectionExpiryDate: vehicle.inspection_expiry_date,
      
      cargoLength: vehicle.cargo_length,
      cargoWidth: vehicle.cargo_width,
      cargoHeight: vehicle.cargo_height,
      
      gpsProvider: vehicle.gps_provider,
      gpsUsername: vehicle.gps_username,
      gpsPassword: vehicle.gps_password,
      
      province: vehicle.province,

      isActive: vehicle.is_active,
      notes: vehicle.notes,
      documents: {
        registration: docsMap.registration || undefined,
        inspection: docsMap.inspection || undefined,
        insurance: docsMap.insurance || undefined,
        operation_permit: docsMap.operation_permit || undefined,
        emblem: docsMap.emblem || undefined,
      },
      createdAt: vehicle.created_at,
      updatedAt: vehicle.updated_at,
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
    const { id: vehicleId } = req.params

    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID is required' })
    }

    // Lấy tất cả vehicle_documents của xe này
    const { data: vehicleDocs, error: docsError } = await firebase
      .from('vehicle_documents')
      .select('id')
      .eq('vehicle_id', vehicleId)

    if (docsError) throw docsError

    const docIds = vehicleDocs?.map((doc: any) => doc.id) || []

    if (docIds.length === 0) {
      return res.json([])
    }

    // Lấy audit logs cho các documents này
    const { data: auditLogs, error: auditError } = await firebase
      .from('audit_logs')
      .select(`
        *,
        users:user_id(id, full_name, username)
      `)
      .eq('table_name', 'vehicle_documents')
      .in('record_id', docIds)
      .order('created_at', { ascending: false })

    if (auditError) throw auditError

    // Format response
    // Convert timestamp to Vietnam timezone (UTC+7) for display
    const formattedLogs = auditLogs?.map((log: any) => {
      let createdAt = log.created_at
      
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
        userId: log.user_id,
        userName: log.users?.full_name || log.users?.username || 'Không xác định',
        action: log.action,
        recordId: log.record_id,
        oldValues: log.old_values,
        newValues: log.new_values,
        createdAt,
      }
    }) || []

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
    // Get all audit logs for vehicle_documents in one query
    const { data: auditLogs, error: auditError } = await firebase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'vehicle_documents')
      .order('created_at', { ascending: false })
      .limit(500)

    if (auditError) throw auditError

    if (!auditLogs || auditLogs.length === 0) {
      return res.json([])
    }

    // Get unique vehicle_document IDs
    const docIds = [...new Set(auditLogs.map((log: any) => log.record_id))]

    // Fetch vehicle_documents to get vehicle_id
    const { data: vehicleDocs } = await firebase
      .from('vehicle_documents')
      .select('id, vehicle_id')
      .in('id', docIds)

    const docToVehicleMap = new Map(
      (vehicleDocs || []).map((doc: any) => [doc.id, doc.vehicle_id])
    )

    // Get unique vehicle IDs
    const vehicleIds = [...new Set(
      (vehicleDocs || []).map((doc: any) => doc.vehicle_id).filter(Boolean)
    )]

    // Fetch vehicles to get plate numbers
    const { data: vehicles } = await firebase
      .from('vehicles')
      .select('id, plate_number')
      .in('id', vehicleIds)

    const vehicleMap = new Map(
      (vehicles || []).map((v: any) => [v.id, v.plate_number])
    )

    // Fetch users for names
    const userIds = [...new Set(auditLogs.map((log: any) => log.user_id).filter(Boolean))]
    const { data: users } = await firebase
      .from('users')
      .select('id, full_name, username')
      .in('id', userIds)

    const userMap = new Map(
      (users || []).map((u: any) => [u.id, u.full_name || u.username || 'Không xác định'])
    )

    // Format response
    const formattedLogs = auditLogs.map((log: any) => {
      const vehicleId = docToVehicleMap.get(log.record_id)
      const plateNumber = vehicleId ? vehicleMap.get(vehicleId) : null

      let createdAt = log.created_at
      if (createdAt && typeof createdAt === 'string' && createdAt.endsWith('Z')) {
        const utcDate = new Date(createdAt)
        const vietnamDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000)
        createdAt = vietnamDate.toISOString().replace('Z', '+07:00')
      }

      return {
        id: log.id,
        userId: log.user_id,
        userName: userMap.get(log.user_id) || 'Không xác định',
        action: log.action,
        recordId: log.record_id,
        oldValues: log.old_values,
        newValues: log.new_values,
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
    const { id } = req.params

    // Soft delete: set is_active to false instead of deleting
    const { data, error } = await firebase
      .from('vehicles')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    // Invalidate vehicle cache after delete
    cachedData.invalidateVehicles()

    return res.json({
      id: data.id,
      isActive: data.is_active,
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
    const { plate } = req.params
    if (!plate) {
      return res.status(400).json({ error: 'Plate number is required' })
    }

    // Use cached lookup - much faster than RTDB query
    const vehicle = await vehicleCacheService.lookupByPlate(plate)

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
