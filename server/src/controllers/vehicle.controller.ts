import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth.js'
import { firebase, db } from '../config/database.js'
import { z } from 'zod'
import { syncVehicleChanges } from '../utils/denormalization-sync.js'

/**
 * Fetches vehicle data from Firebase RTDB vehicle badges as fallback
 */
async function getVehicleFromBadges(vehicleId: string) {
  try {
    if (!db) return null

    const snapshot = await db.ref('datasheet/PHUHIEUXE').once('value')
    const badgesData = snapshot.val()

    if (!badgesData) return null

    // Try to find badge by ID
    for (const key of Object.keys(badgesData)) {
      const badge = badgesData[key]
      if (badge.ID_PhuHieu === vehicleId || key === vehicleId) {
        return {
          id: badge.ID_PhuHieu || key,
          plateNumber: badge.BienSoXe || '',
          vehicleType: badge.LoaiXe || null,
          seatCapacity: 0,
          bedCapacity: 0,
          isActive: badge.TrangThai?.toLowerCase()?.includes('hiệu lực') || true,
          notes: badge.GhiChu || null,
          badgeNumber: badge.SoPhuHieu || '',
          badgeType: badge.LoaiPH || '',
          badgeColor: badge.MauPhuHieu || '',
          issueDate: badge.NgayCap || '',
          expiryDate: badge.NgayHetHan || '',
          status: badge.TrangThai || '',
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching vehicle from badges:', error)
    return null
  }
}

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

    let query = firebase
      .from('vehicles')
      .select(`
        *,
        operators:operator_id(id, name, code),
        vehicle_types:vehicle_type_id(id, name)
      `)
      .order('created_at', { ascending: false })

    if (operatorId) {
      query = query.eq('operator_id', operatorId as string)
    }
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: vehicles, error: vehiclesError } = await query

    if (vehiclesError) throw vehiclesError

    // Fetch documents
    const vehicleIds = vehicles.map((v: any) => v.id)
    const { data: documents } = await firebase
      .from('vehicle_documents')
      .select('*')
      .in('vehicle_id', vehicleIds)

    const vehiclesWithDocs = vehicles.map((vehicle: any) => {
      const vehicleDocs = documents?.filter((doc: any) => doc.vehicle_id === vehicle.id) || []
      
      const docsMap: any = {}
      vehicleDocs.forEach((doc: any) => {
        const today = new Date().toISOString().split('T')[0]
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

      return {
        id: vehicle.id,
        plateNumber: vehicle.plate_number,
        vehicleTypeId: vehicle.vehicle_type_id,
        vehicleType: vehicle.vehicle_types ? {
          id: vehicle.vehicle_types.id,
          name: vehicle.vehicle_types.name,
        } : undefined,
        operatorId: vehicle.operator_id,
        operator: vehicle.operators ? {
          id: vehicle.operators.id,
          name: vehicle.operators.name,
          code: vehicle.operators.code,
        } : undefined,
        seatCapacity: vehicle.seat_capacity,
        bedCapacity: vehicle.bed_capacity,
        chassisNumber: vehicle.chassis_number,
        engineNumber: vehicle.engine_number,
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

// Helper to check if string is valid UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // TÌM TRỰC TIẾP TRONG FIREBASE VEHICLE BADGES TRƯỚC
    const badgeVehicle = await getVehicleFromBadges(id)
    if (badgeVehicle) {
      return res.json({
        id: badgeVehicle.id,
        plateNumber: badgeVehicle.plateNumber,
        vehicleType: badgeVehicle.vehicleType ? { name: badgeVehicle.vehicleType } : undefined,
        seatCapacity: badgeVehicle.seatCapacity,
        bedCapacity: badgeVehicle.bedCapacity,
        isActive: badgeVehicle.isActive,
        notes: badgeVehicle.notes,
        // Badge specific fields
        badgeNumber: badgeVehicle.badgeNumber,
        badgeType: badgeVehicle.badgeType,
        badgeColor: badgeVehicle.badgeColor,
        issueDate: badgeVehicle.issueDate,
        expiryDate: badgeVehicle.expiryDate,
        status: badgeVehicle.status,
        documents: {},
      })
    }

    // Skip Supabase query if ID is not a valid UUID (Firebase IDs are not UUIDs)
    if (!isValidUUID(id)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    // Fallback: Tìm trong Supabase vehicles table
    const { data: vehicle, error: vehicleError } = await firebase
      .from('vehicles')
      .select(`
        *,
        operators:operator_id(id, name, code),
        vehicle_types:vehicle_type_id(id, name)
      `)
      .eq('id', id)
      .single()

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' })
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
      vehicleType: (vehicle as any).vehicle_types ? {
        id: (vehicle as any).vehicle_types.id,
        name: (vehicle as any).vehicle_types.name,
      } : undefined,
      operatorId: vehicle.operator_id,
      operator: (vehicle as any).operators ? {
        id: (vehicle as any).operators.id,
        name: (vehicle as any).operators.name,
        code: (vehicle as any).operators.code,
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
      .select(`
        *,
        operators:operator_id(id, name, code),
        vehicle_types:vehicle_type_id(id, name)
      `)
      .single()

    if (vehicleError) throw vehicleError

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

    return res.status(201).json({
      id: vehicle.id,
      plateNumber: vehicle.plate_number,
      vehicleTypeId: vehicle.vehicle_type_id,
      vehicleType: (vehicle as any).vehicle_types ? {
        id: (vehicle as any).vehicle_types.id,
        name: (vehicle as any).vehicle_types.name,
      } : undefined,
      operatorId: vehicle.operator_id,
      operator: (vehicle as any).operators ? {
        id: (vehicle as any).operators.id,
        name: (vehicle as any).operators.name,
        code: (vehicle as any).operators.code,
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
      .select(`
        *,
        operators:operator_id(id, name, code),
        vehicle_types:vehicle_type_id(id, name)
      `)
      .eq('id', id)
      .single()

    // Sync denormalized data to dispatch_records if plate_number or operator changed
    if (updateData.plate_number || updateData.operator_id !== undefined) {
      const operatorData = vehicle.operators
        ? (Array.isArray(vehicle.operators) ? vehicle.operators[0] : vehicle.operators)
        : null

      // Run sync in background (non-blocking)
      syncVehicleChanges(id, {
        plateNumber: vehicle.plate_number,
        operatorId: vehicle.operator_id,
        operatorName: operatorData?.name || null,
        operatorCode: operatorData?.code || null,
      }).catch((err) => {
        console.error('[Vehicle Update] Failed to sync denormalized data:', err)
      })
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
      vehicleType: (vehicle as any).vehicle_types ? {
        id: (vehicle as any).vehicle_types.id,
        name: (vehicle as any).vehicle_types.name,
      } : undefined,
      operatorId: vehicle.operator_id,
      operator: (vehicle as any).operators ? {
        id: (vehicle as any).operators.id,
        name: (vehicle as any).operators.name,
        code: (vehicle as any).operators.code,
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
