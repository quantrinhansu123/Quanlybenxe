/**
 * Vehicle Controller
 * Handles HTTP requests for vehicle operations
 */

import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth.js'
import { firebase, firebaseDb } from '../../../config/database.js'
import { syncVehicleChanges } from '../../../utils/denormalization-sync.js'
import { validateCreateVehicle, validateUpdateVehicle } from '../fleet-validation.js'
import { mapVehicleToAPI, mapAuditLogToAPI } from '../fleet-mappers.js'
import type { VehicleDBRecord, VehicleDocumentDB, DocumentType } from '../fleet-types.js'

const DOCUMENT_TYPES: DocumentType[] = ['registration', 'inspection', 'insurance', 'operation_permit', 'emblem']

// Cache for legacy vehicles (30 minutes)
let legacyVehiclesCache: { data: any[] | null; timestamp: number } = { data: null, timestamp: 0 }
const LEGACY_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

/**
 * Fetch vehicle documents by vehicle ID
 */
async function fetchVehicleDocuments(vehicleId: string): Promise<VehicleDocumentDB[]> {
  const { data } = await firebase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
  return data || []
}

/**
 * Fetch documents for multiple vehicles
 */
async function fetchVehicleDocumentsBatch(vehicleIds: string[]): Promise<VehicleDocumentDB[]> {
  if (vehicleIds.length === 0) return []
  const { data } = await firebase
    .from('vehicle_documents')
    .select('*')
    .in('vehicle_id', vehicleIds)
  return data || []
}

/**
 * Insert or update vehicle documents
 */
async function upsertDocuments(
  vehicleId: string,
  documents: Record<string, { number: string; issueDate: string; expiryDate: string; issuingAuthority?: string; documentUrl?: string; notes?: string }>,
  userId?: string
): Promise<void> {
  for (const type of DOCUMENT_TYPES) {
    const doc = documents[type]
    if (!doc) continue

    const { data: existingDoc } = await firebase
      .from('vehicle_documents')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .eq('document_type', type)
      .single()

    const docData = {
      document_number: doc.number,
      issue_date: doc.issueDate,
      expiry_date: doc.expiryDate,
      issuing_authority: doc.issuingAuthority || null,
      document_url: doc.documentUrl || null,
      notes: doc.notes || null,
    }

    if (existingDoc) {
      await firebase
        .from('vehicle_documents')
        .update({ ...docData, updated_by: userId || null, updated_at: new Date().toISOString() })
        .eq('id', existingDoc.id)
    } else {
      await firebase
        .from('vehicle_documents')
        .insert({ vehicle_id: vehicleId, document_type: type, ...docData, updated_by: userId || null })
    }
  }
}

// ========== Controller Handlers ==========

export const getAllVehicles = async (req: Request, res: Response) => {
  try {
    const { operatorId, isActive, includeLegacy } = req.query

    let query = firebase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (operatorId) query = query.eq('operator_id', operatorId as string)
    if (isActive !== undefined) query = query.eq('is_active', isActive === 'true')

    const { data: vehicles, error } = await query
    if (error) throw error

    // Fetch operators and vehicle_types for manual join (Firebase RTDB doesn't support joins)
    const { data: operators } = await firebase.from('operators').select('id, name, code')
    const { data: vehicleTypes } = await firebase.from('vehicle_types').select('id, name')
    
    const operatorMap = new Map((operators || []).map((op: any) => [op.id, op]))
    const vehicleTypeMap = new Map((vehicleTypes || []).map((vt: any) => [vt.id, vt]))

    const vehicleIds = vehicles.map((v: VehicleDBRecord) => v.id)
    const documents = await fetchVehicleDocumentsBatch(vehicleIds)

    const result = vehicles.map((vehicle: VehicleDBRecord) => {
      const vehicleDocs = documents.filter((doc) => doc.vehicle_id === vehicle.id)
      const operator = vehicle.operator_id ? operatorMap.get(vehicle.operator_id) as any : null
      const vehicleType = vehicle.vehicle_type_id ? vehicleTypeMap.get(vehicle.vehicle_type_id) as any : null
      return mapVehicleToAPI(vehicle, vehicleDocs, operator, vehicleType)
    })

    // Include legacy data from datasheet/Xe if requested or by default
    if (includeLegacy !== 'false') {
      try {
        // Check cache first
        const now = Date.now()
        let legacyVehicles: any[] = []
        
        if (legacyVehiclesCache.data && (now - legacyVehiclesCache.timestamp) < LEGACY_CACHE_TTL) {
          legacyVehicles = legacyVehiclesCache.data
        } else {
          // Fetch and cache legacy data
          const legacySnap = await firebaseDb.ref('datasheet/Xe').once('value')
          const legacyData = legacySnap.val()
          
          if (legacyData) {
            for (const [key, xe] of Object.entries(legacyData)) {
              const x = xe as any
              if (!x) continue
              
              // Support both new (English) and old (Vietnamese) field names
              const plateNumber = x.plate_number || x.BienSo || ''
              if (!plateNumber) continue
              
              // Map legacy data to API format with proper object structure
              legacyVehicles.push({
                id: `legacy_${key}`,
                plateNumber,
                vehicleType: { id: null, name: x.vehicle_type || x.LoaiXe || '' },
                vehicleTypeName: x.vehicle_type || x.LoaiXe || '',
                seatCapacity: parseInt(x.seat_count || x.SoCho) || 0,
                bedCapacity: 0,
                manufacturer: x.manufacturer || x.NhanHieu || '',
                modelCode: x.model_code || x.SoLoai || '',
                manufactureYear: (x.manufacture_year || x.NamSanXuat) ? parseInt(x.manufacture_year || x.NamSanXuat) : null,
                color: x.color || x.MauSon || '',
                chassisNumber: x.chassis_number || x.SoKhung || '',
                engineNumber: x.engine_number || x.SoMay || '',
                operatorId: null,
                operator: { id: null, name: x.owner_name || x.TenDangKyXe || '', code: '' },
                operatorName: x.owner_name || x.TenDangKyXe || '',
                isActive: true,
                notes: x.notes || x.GhiChu || '',
                source: 'legacy',
                inspectionExpiryDate: x.inspection_expiry || x.NgayHetHanKiemDinh || null,
                insuranceExpiryDate: x.insurance_expiry || x.NgayHetHanBaoHiem || null,
                documents: {}
              })
            }
          }
          
          // Update cache
          legacyVehiclesCache = { data: legacyVehicles, timestamp: now }
        }
        
        // Filter out duplicates by plate number
        const existingPlates = new Set(
          vehicles.map((v: any) => (v.plate_number || '').toUpperCase())
        )
        
        for (const legacyVehicle of legacyVehicles) {
          const plate = (legacyVehicle.plateNumber || '').toUpperCase()
          if (!existingPlates.has(plate)) {
            result.push(legacyVehicle)
            existingPlates.add(plate)
          }
        }
        
        // Also fetch vehicles from PHUHIEUXE (vehicle badges)
        // Only include Buýt and Tuyến cố định types
        const allowedBadgeTypes = ['Buýt', 'Tuyến cố định']
        const badgeSnap = await firebaseDb.ref('datasheet/PHUHIEUXE').once('value')
        const badgeData = badgeSnap.val()
        
        if (badgeData) {
          for (const [key, badge] of Object.entries(badgeData)) {
            const b = badge as any
            if (!b || !b.BienSoXe) continue
            
            // Filter by badge type
            if (!allowedBadgeTypes.includes(b.LoaiPH || '')) continue
            
            const plate = (b.BienSoXe || '').toUpperCase()
            if (existingPlates.has(plate)) continue
            
            result.push({
              id: `badge_${key}`,
              plateNumber: b.BienSoXe,
              vehicleType: { id: null, name: b.LoaiPH || '' },
              vehicleTypeName: b.LoaiPH || '',
              seatCapacity: 0,
              bedCapacity: 0,
              manufacturer: '',
              modelCode: '',
              manufactureYear: null,
              color: '',
              chassisNumber: '',
              engineNumber: '',
              operatorId: null,
              operator: { id: null, name: '', code: '' },
              operatorName: '',
              isActive: b.TrangThai !== 'Thu hồi',
              notes: `Phù hiệu: ${b.SoPhuHieu || ''}`,
              source: 'badge',
              badgeNumber: b.SoPhuHieu || '',
              badgeType: b.LoaiPH || '',
              badgeExpiryDate: b.NgayHetHan || null,
              documents: {}
            })
            existingPlates.add(plate)
          }
        }
      } catch (legacyError) {
        console.error('Failed to fetch legacy vehicles:', legacyError)
      }
    }

    return res.json(result)
  } catch (error: unknown) {
    const err = error as { name?: string; errors?: Array<{ message: string }>; message?: string }
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message })
    return res.status(500).json({ error: err.message || 'Failed to fetch vehicles' })
  }
}

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: vehicle, error } = await firebase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    // Fetch operator and vehicle_type separately (Firebase RTDB doesn't support joins)
    let operator = null
    let vehicleType = null
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('id, name, code').eq('id', vehicle.operator_id).single()
      operator = op
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('id, name').eq('id', vehicle.vehicle_type_id).single()
      vehicleType = vt
    }

    const documents = await fetchVehicleDocuments(id)
    return res.json(mapVehicleToAPI(vehicle, documents, operator, vehicleType))
  } catch (error: unknown) {
    const err = error as { name?: string; errors?: Array<{ message: string }>; message?: string }
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message })
    return res.status(500).json({ error: err.message || 'Failed to fetch vehicle' })
  }
}

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const validated = validateCreateVehicle(req.body)

    const { data: vehicle, error } = await firebase
      .from('vehicles')
      .insert({
        plate_number: validated.plateNumber,
        vehicle_type_id: validated.vehicleTypeId || null,
        operator_id: validated.operatorId || null,
        seat_capacity: validated.seatCapacity,
        bed_capacity: validated.bedCapacity || 0,
        chassis_number: validated.chassisNumber || null,
        engine_number: validated.engineNumber || null,
        image_url: validated.imageUrl || null,
        insurance_expiry_date: validated.insuranceExpiryDate || null,
        inspection_expiry_date: validated.inspectionExpiryDate || null,
        cargo_length: validated.cargoLength || null,
        cargo_width: validated.cargoWidth || null,
        cargo_height: validated.cargoHeight || null,
        gps_provider: validated.gpsProvider || null,
        gps_username: validated.gpsUsername || null,
        gps_password: validated.gpsPassword || null,
        province: validated.province || null,
        notes: validated.notes || null,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) throw error

    // Fetch operator and vehicle_type separately (Firebase RTDB doesn't support joins)
    let operator = null
    let vehicleType = null
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('id, name, code').eq('id', vehicle.operator_id).single()
      operator = op
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('id, name').eq('id', vehicle.vehicle_type_id).single()
      vehicleType = vt
    }

    if (validated.documents) {
      await upsertDocuments(vehicle.id, validated.documents as Record<string, { number: string; issueDate: string; expiryDate: string; issuingAuthority?: string; documentUrl?: string; notes?: string }>)
    }

    const documents = await fetchVehicleDocuments(vehicle.id)
    return res.status(201).json(mapVehicleToAPI(vehicle, documents, operator, vehicleType))
  } catch (error: unknown) {
    const err = error as { code?: string; name?: string; errors?: Array<{ message: string }>; message?: string }
    if (err.code === '23505') return res.status(409).json({ error: 'Vehicle with this plate number already exists' })
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message })
    return res.status(500).json({ error: err.message || 'Failed to create vehicle' })
  }
}

export const updateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const validated = validateUpdateVehicle(req.body)

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (validated.plateNumber) updateData.plate_number = validated.plateNumber
    if (validated.vehicleTypeId !== undefined) updateData.vehicle_type_id = validated.vehicleTypeId || null
    if ('operatorId' in req.body) {
      const operatorId = req.body.operatorId
      updateData.operator_id = (operatorId && operatorId.trim() !== '') ? operatorId : null
    } else if (validated.operatorId !== undefined) {
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
      const { error } = await firebase.from('vehicles').update(updateData).eq('id', id)
      if (error) throw error
    }

    if (validated.documents) {
      await upsertDocuments(id, validated.documents as Record<string, { number: string; issueDate: string; expiryDate: string; issuingAuthority?: string; documentUrl?: string; notes?: string }>, userId)
    }

    const { data: vehicle } = await firebase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found after update' })
    }

    // Fetch operator and vehicle_type separately (Firebase RTDB doesn't support joins)
    let operator = null
    let vehicleType = null
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('id, name, code').eq('id', vehicle.operator_id).single()
      operator = op
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('id, name').eq('id', vehicle.vehicle_type_id).single()
      vehicleType = vt
    }

    // Sync denormalized data if needed
    if (updateData.plate_number || updateData.operator_id !== undefined) {
      syncVehicleChanges(id, {
        plateNumber: vehicle.plate_number,
        operatorId: vehicle.operator_id,
        operatorName: operator?.name || null,
        operatorCode: operator?.code || null,
      }).catch((err) => console.error('[Vehicle Update] Failed to sync denormalized data:', err))
    }

    const documents = await fetchVehicleDocuments(id)
    return res.json(mapVehicleToAPI(vehicle, documents, operator, vehicleType))
  } catch (error: unknown) {
    const err = error as { name?: string; errors?: Array<{ message: string }>; message?: string }
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message })
    return res.status(500).json({ error: err.message || 'Failed to update vehicle' })
  }
}

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data, error } = await firebase
      .from('vehicles')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Vehicle not found' })

    return res.json({ id: data.id, isActive: data.is_active, message: 'Vehicle deleted successfully' })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting vehicle:', error)
    return res.status(500).json({ error: err.message || 'Failed to delete vehicle' })
  }
}

export const getVehicleDocumentAuditLogs = async (req: Request, res: Response) => {
  try {
    const { id: vehicleId } = req.params
    if (!vehicleId) return res.status(400).json({ error: 'Vehicle ID is required' })

    const { data: vehicleDocs, error: docsError } = await firebase
      .from('vehicle_documents')
      .select('id')
      .eq('vehicle_id', vehicleId)

    if (docsError) throw docsError

    const docIds = vehicleDocs?.map((doc: { id: string }) => doc.id) || []
    if (docIds.length === 0) return res.json([])

    const { data: auditLogs, error: auditError } = await firebase
      .from('audit_logs')
      .select('*, users:user_id(id, full_name, username)')
      .eq('table_name', 'vehicle_documents')
      .in('record_id', docIds)
      .order('created_at', { ascending: false })

    if (auditError) throw auditError

    const formattedLogs = auditLogs?.map(mapAuditLogToAPI) || []
    return res.json(formattedLogs)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error fetching vehicle document audit logs:', error)
    return res.status(500).json({ error: err.message || 'Failed to fetch audit logs' })
  }
}
