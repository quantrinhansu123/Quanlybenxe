/**
 * Vehicle Controller
 * Handles HTTP requests for vehicle operations
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth.js';
import { firebase } from '../../../config/database.js';
import { syncVehicleChanges } from '../../../utils/denormalization-sync.js';
import { validateCreateVehicle, validateUpdateVehicle } from '../fleet-validation.js';
import { mapVehicleToAPI, mapAuditLogToAPI } from '../fleet-mappers.js';
import { vehicleService } from '../services/vehicle.service.js';
import type { VehicleDocumentDB, DocumentType } from '../fleet-types.js';

const DOCUMENT_TYPES: DocumentType[] = ['registration', 'inspection', 'insurance', 'operation_permit', 'emblem'];

// ========== Document Helpers ==========

async function fetchVehicleDocuments(vehicleId: string): Promise<VehicleDocumentDB[]> {
  const { data } = await firebase.from('vehicle_documents').select('*').eq('vehicle_id', vehicleId);
  return data || [];
}

async function upsertDocuments(
  vehicleId: string,
  documents: Record<string, { number: string; issueDate: string; expiryDate: string; issuingAuthority?: string; documentUrl?: string; notes?: string }>,
  userId?: string
): Promise<void> {
  for (const type of DOCUMENT_TYPES) {
    const doc = documents[type];
    if (!doc) continue;

    const { data: existingDoc } = await firebase
      .from('vehicle_documents')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .eq('document_type', type)
      .single();

    const docData = {
      document_number: doc.number,
      issue_date: doc.issueDate,
      expiry_date: doc.expiryDate,
      issuing_authority: doc.issuingAuthority || null,
      document_url: doc.documentUrl || null,
      notes: doc.notes || null,
    };

    if (existingDoc) {
      await firebase
        .from('vehicle_documents')
        .update({ ...docData, updated_by: userId || null, updated_at: new Date().toISOString() })
        .eq('id', existingDoc.id);
    } else {
      await firebase
        .from('vehicle_documents')
        .insert({ vehicle_id: vehicleId, document_type: type, ...docData, updated_by: userId || null });
    }
  }
}

// ========== Controller Handlers ==========

export const getAllVehicles = async (req: Request, res: Response) => {
  try {
    const { operatorId, isActive, includeLegacy } = req.query;
    const vehicles = await vehicleService.getAll({
      operatorId: operatorId as string | undefined,
      isActive: isActive === 'all' ? 'all' : isActive === 'false' ? false : undefined,
      includeLegacy: includeLegacy !== 'false',
    });
    return res.json(vehicles);
  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({ error: err.message || 'Failed to fetch vehicles' });
  }
};

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const vehicle = await vehicleService.getById(req.params.id);
    return res.json(vehicle);
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Failed to fetch vehicle' });
  }
};

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const validated = validateCreateVehicle(req.body);
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
      .single();

    if (error) throw error;

    // Fetch relations
    let operator = null, vehicleType = null;
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('id, name, code').eq('id', vehicle.operator_id).single();
      operator = op;
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('id, name').eq('id', vehicle.vehicle_type_id).single();
      vehicleType = vt;
    }

    if (validated.documents) {
      await upsertDocuments(vehicle.id, validated.documents as Record<string, { number: string; issueDate: string; expiryDate: string; issuingAuthority?: string; documentUrl?: string; notes?: string }>);
    }

    const documents = await fetchVehicleDocuments(vehicle.id);
    return res.status(201).json(mapVehicleToAPI(vehicle, documents, operator, vehicleType));
  } catch (error: unknown) {
    const err = error as { code?: string; name?: string; errors?: Array<{ message: string }>; message?: string };
    if (err.code === '23505') return res.status(409).json({ error: 'Vehicle with this plate number already exists' });
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message });
    return res.status(500).json({ error: err.message || 'Failed to create vehicle' });
  }
};

export const updateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const validated = validateUpdateVehicle(req.body);

    const updateData: Record<string, unknown> = {};
    if (validated.plateNumber) updateData.plate_number = validated.plateNumber;
    if (validated.vehicleTypeId !== undefined) updateData.vehicle_type_id = validated.vehicleTypeId || null;
    if ('operatorId' in req.body) {
      updateData.operator_id = req.body.operatorId?.trim() || null;
    } else if (validated.operatorId !== undefined) {
      updateData.operator_id = validated.operatorId || null;
    }
    if (validated.seatCapacity) updateData.seat_capacity = validated.seatCapacity;
    if (validated.bedCapacity !== undefined) updateData.bed_capacity = validated.bedCapacity || 0;
    if (validated.chassisNumber !== undefined) updateData.chassis_number = validated.chassisNumber || null;
    if (validated.engineNumber !== undefined) updateData.engine_number = validated.engineNumber || null;
    if (validated.imageUrl !== undefined) updateData.image_url = validated.imageUrl || null;
    if (validated.insuranceExpiryDate !== undefined) updateData.insurance_expiry_date = validated.insuranceExpiryDate || null;
    if (validated.inspectionExpiryDate !== undefined) updateData.inspection_expiry_date = validated.inspectionExpiryDate || null;
    if (validated.cargoLength !== undefined) updateData.cargo_length = validated.cargoLength || null;
    if (validated.cargoWidth !== undefined) updateData.cargo_width = validated.cargoWidth || null;
    if (validated.cargoHeight !== undefined) updateData.cargo_height = validated.cargoHeight || null;
    if (validated.gpsProvider !== undefined) updateData.gps_provider = validated.gpsProvider || null;
    if (validated.gpsUsername !== undefined) updateData.gps_username = validated.gpsUsername || null;
    if (validated.gpsPassword !== undefined) updateData.gps_password = validated.gpsPassword || null;
    if (validated.province !== undefined) updateData.province = validated.province || null;
    if (validated.notes !== undefined) updateData.notes = validated.notes || null;

    if (Object.keys(updateData).length > 0) {
      const { error } = await firebase.from('vehicles').update(updateData).eq('id', id);
      if (error) throw error;
    }

    if (validated.documents) {
      await upsertDocuments(id, validated.documents as Record<string, { number: string; issueDate: string; expiryDate: string; issuingAuthority?: string; documentUrl?: string; notes?: string }>, userId);
    }

    const { data: vehicle } = await firebase.from('vehicles').select('*').eq('id', id).single();
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found after update' });

    let operator = null, vehicleType = null;
    if (vehicle.operator_id) {
      const { data: op } = await firebase.from('operators').select('id, name, code').eq('id', vehicle.operator_id).single();
      operator = op;
    }
    if (vehicle.vehicle_type_id) {
      const { data: vt } = await firebase.from('vehicle_types').select('id, name').eq('id', vehicle.vehicle_type_id).single();
      vehicleType = vt;
    }

    if (updateData.plate_number || updateData.operator_id !== undefined) {
      syncVehicleChanges(id, {
        plateNumber: vehicle.plate_number,
        operatorId: vehicle.operator_id,
        operatorName: operator?.name || null,
        operatorCode: operator?.code || null,
      }).catch((err) => console.error('[Vehicle Update] Sync failed:', err));
    }

    const documents = await fetchVehicleDocuments(id);
    return res.json(mapVehicleToAPI(vehicle, documents, operator, vehicleType));
  } catch (error: unknown) {
    const err = error as { name?: string; errors?: Array<{ message: string }>; message?: string };
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors?.[0]?.message });
    return res.status(500).json({ error: err.message || 'Failed to update vehicle' });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { data, error } = await firebase
      .from('vehicles')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Vehicle not found' });
    return res.json({ id: data.id, isActive: data.is_active, message: 'Vehicle deleted successfully' });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({ error: err.message || 'Failed to delete vehicle' });
  }
};

export const getVehicleDocumentAuditLogs = async (req: Request, res: Response) => {
  try {
    const { id: vehicleId } = req.params;
    if (!vehicleId) return res.status(400).json({ error: 'Vehicle ID is required' });

    const { data: vehicleDocs, error: docsError } = await firebase
      .from('vehicle_documents')
      .select('id')
      .eq('vehicle_id', vehicleId);

    if (docsError) throw docsError;
    const docIds = vehicleDocs?.map((doc: { id: string }) => doc.id) || [];
    if (docIds.length === 0) return res.json([]);

    const { data: auditLogs, error: auditError } = await firebase
      .from('audit_logs')
      .select('*, users:user_id(id, full_name, username)')
      .eq('table_name', 'vehicle_documents')
      .in('record_id', docIds)
      .order('created_at', { ascending: false });

    if (auditError) throw auditError;
    return res.json(auditLogs?.map(mapAuditLogToAPI) || []);
  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
};
