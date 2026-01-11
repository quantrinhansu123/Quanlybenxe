/**
 * Vehicle Cache Service
 * Handles legacy and badge vehicles from Supabase with caching
 */

import { firebase } from '../../../config/database.js';

export interface LegacyVehicleData {
  id: string;
  plateNumber: string;
  vehicleType: { id: null; name: string };
  vehicleTypeName: string;
  vehicleCategory: string;
  seatCapacity: number;
  bedCapacity: number;
  manufacturer: string;
  modelCode: string;
  manufactureYear: number | null;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  operatorId: null;
  operator: { id: null; name: string; code: string };
  operatorName: string;
  isActive: boolean;
  notes: string;
  source: 'legacy';
  inspectionExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  documents: Record<string, never>;
}

export interface BadgeVehicleData {
  id: string;
  plateNumber: string;
  vehicleType: { id: null; name: string };
  vehicleTypeName: string;
  vehicleCategory: string;
  seatCapacity: number;
  bedCapacity: number;
  manufacturer: string;
  modelCode: string;
  manufactureYear: number | null;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  operatorId: null;
  operator: { id: null; name: string; code: string };
  operatorName: string;
  isActive: boolean;
  notes: string;
  source: 'badge';
  badgeNumber: string;
  badgeType: string;
  badgeExpiryDate: string | null;
  documents: Record<string, never>;
}

interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helper to check if vehicle category indicates sleeper/bed vehicle
function isBedVehicle(vehicleCategory: string): boolean {
  if (!vehicleCategory) return false;
  // Normalize: lowercase, remove diacritics, extra spaces
  const normalized = vehicleCategory
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim();
  // Check for "giuong nam" variations
  return normalized.includes('giuong nam') || 
         normalized.includes('giuong') ||
         normalized.includes('sleeper');
}

class VehicleCacheService {
  private legacyCache: CacheEntry<LegacyVehicleData[]> = { data: null, timestamp: 0 };
  private operatorIndex: Map<string, number[]> | null = null;
  private badgeCache: CacheEntry<BadgeVehicleData[]> = { data: null, timestamp: 0 };

  private isCacheValid<T>(cache: CacheEntry<T>): boolean {
    return cache.data !== null && Date.now() - cache.timestamp < CACHE_TTL;
  }

  async getLegacyVehicles(): Promise<LegacyVehicleData[]> {
    if (this.isCacheValid(this.legacyCache)) {
      return this.legacyCache.data!;
    }

    const { data, error } = await firebase.from('vehicles').select('*');
    if (error) {
      console.error('[VehicleCache] Error loading legacy vehicles:', error);
      return [];
    }

    const vehicles: LegacyVehicleData[] = [];
    const operatorIndex = new Map<string, number[]>();

    if (data) {
      let idx = 0;
      for (const x of data) {
        if (!x) continue;

        const plateNumber = (x.plate_number || '') as string;
        if (!plateNumber) continue;

        const operatorName = ((x.operator_name || '') as string).trim().toLowerCase();
        const vehicleCategory = (x.vehicle_category || '') as string;
        const seatCount = parseInt(String(x.seat_count || x.seat_capacity || 0)) || 0;
        // If vehicle category contains "giường nằm", seatCount is actually bedCount
        const hasBeds = isBedVehicle(vehicleCategory);

        vehicles.push({
          id: `legacy_${x.id}`,
          plateNumber,
          vehicleType: { id: null, name: (x.vehicle_type || '') as string },
          vehicleTypeName: (x.vehicle_type || '') as string,
          vehicleCategory,
          seatCapacity: hasBeds ? 0 : seatCount,
          bedCapacity: hasBeds ? seatCount : 0,
          manufacturer: (x.manufacturer || '') as string,
          modelCode: (x.model_code || '') as string,
          manufactureYear: x.manufacture_year
            ? parseInt(String(x.manufacture_year))
            : null,
          color: (x.color || '') as string,
          chassisNumber: (x.chassis_number || '') as string,
          engineNumber: (x.engine_number || '') as string,
          operatorId: null,
          operator: { id: null, name: (x.operator_name || '') as string, code: '' },
          operatorName: (x.operator_name || '') as string,
          isActive: x.is_active !== false,
          notes: (x.notes || '') as string,
          source: 'legacy',
          inspectionExpiryDate: (x.road_worthiness_expiry || null) as string | null,
          insuranceExpiryDate: (x.insurance_expiry || null) as string | null,
          documents: {},
        });

        if (operatorName) {
          if (!operatorIndex.has(operatorName)) {
            operatorIndex.set(operatorName, []);
          }
          operatorIndex.get(operatorName)!.push(idx);
        }
        idx++;
      }
    }

    this.legacyCache = { data: vehicles, timestamp: Date.now() };
    this.operatorIndex = operatorIndex;
    return vehicles;
  }

  async getBadgeVehicles(): Promise<BadgeVehicleData[]> {
    if (this.isCacheValid(this.badgeCache)) {
      return this.badgeCache.data!;
    }

    const allowedTypes = ['Buýt', 'Tuyến cố định'];

    // Load both badges and vehicles data for joining from Supabase
    const [badgeResult, vehicleResult] = await Promise.all([
      firebase.from('vehicle_badges').select('*'),
      firebase.from('vehicles').select('*')
    ]);

    if (badgeResult.error) {
      console.error('[VehicleCache] Error loading badge vehicles:', badgeResult.error);
      return [];
    }

    const badgeData = badgeResult.data || [];
    const vehicleData = vehicleResult.data || [];

    // Build vehicle lookup map by plate number (normalized)
    const vehicleByPlate = new Map<string, Record<string, unknown>>();
    for (const v of vehicleData) {
      const plate = ((v.plate_number || '') as string).replace(/[.\-\s]/g, '').toUpperCase();
      if (plate) {
        vehicleByPlate.set(plate, v as Record<string, unknown>);
      }
    }

    const vehicles: BadgeVehicleData[] = [];

    for (const b of badgeData) {
      if (!b) continue;

      // Supabase uses snake_case field names
      const plateNumber = (b.plate_number || '') as string;
      if (!plateNumber) continue;

      const badgeType = (b.badge_type || '') as string;
      if (!allowedTypes.includes(badgeType)) continue;

      const badgeNumber = (b.badge_number || '') as string;
      const status = (b.status || '') as string;
      const expiryDate = (b.expiry_date || null) as string | null;

      // Try to find matching vehicle for additional info
      const normalizedPlate = plateNumber.replace(/[.\-\s]/g, '').toUpperCase();
      const matchingVehicle = vehicleByPlate.get(normalizedPlate);

      // Get operator and seat count from vehicle if available
      let operatorName = '';
      let seatCount = 0;
      let vehicleCategory = '';
      let manufacturer = '';
      let modelCode = '';
      let manufactureYear: number | null = null;
      let color = '';
      let chassisNumber = '';
      let engineNumber = '';

      if (matchingVehicle) {
        operatorName = (matchingVehicle.operator_name || '') as string;
        seatCount = parseInt(String(matchingVehicle.seat_count || matchingVehicle.seat_capacity || 0)) || 0;
        vehicleCategory = (matchingVehicle.vehicle_category || '') as string;
        manufacturer = (matchingVehicle.manufacturer || '') as string;
        modelCode = (matchingVehicle.model_code || '') as string;
        manufactureYear = matchingVehicle.manufacture_year
          ? parseInt(String(matchingVehicle.manufacture_year))
          : null;
        color = (matchingVehicle.color || '') as string;
        chassisNumber = (matchingVehicle.chassis_number || '') as string;
        engineNumber = (matchingVehicle.engine_number || '') as string;
      }

      // If vehicle category contains "giường nằm", seatCount is actually bedCount
      const hasBeds = isBedVehicle(vehicleCategory);

      vehicles.push({
        id: `badge_${b.id}`,
        plateNumber,
        vehicleType: { id: null, name: badgeType },
        vehicleTypeName: badgeType,
        vehicleCategory,
        seatCapacity: hasBeds ? 0 : seatCount,
        bedCapacity: hasBeds ? seatCount : 0,
        manufacturer,
        modelCode,
        manufactureYear,
        color,
        chassisNumber,
        engineNumber,
        operatorId: null,
        operator: { id: null, name: operatorName, code: '' },
        operatorName,
        isActive: status !== 'Thu hồi',
        notes: `Phù hiệu: ${badgeNumber}`,
        source: 'badge',
        badgeNumber,
        badgeType,
        badgeExpiryDate: expiryDate,
        documents: {},
      });
    }

    this.badgeCache = { data: vehicles, timestamp: Date.now() };
    return vehicles;
  }

  async getLegacyVehicleById(key: string): Promise<LegacyVehicleData | null> {
    // Extract actual ID from legacy prefix
    const actualId = key.replace('legacy_', '');

    const { data, error } = await firebase
      .from('vehicles')
      .select('*')
      .eq('id', actualId)
      .single();

    if (error || !data) return null;

    const vehicleCategory = data.vehicle_category || '';
    const seatCount = parseInt(data.seat_count || data.seat_capacity || 0) || 0;
    const hasBeds = isBedVehicle(vehicleCategory);

    return {
      id: `legacy_${data.id}`,
      plateNumber: data.plate_number || '',
      vehicleType: { id: null, name: data.vehicle_type || '' },
      vehicleTypeName: data.vehicle_type || '',
      vehicleCategory,
      seatCapacity: hasBeds ? 0 : seatCount,
      bedCapacity: hasBeds ? seatCount : 0,
      manufacturer: data.manufacturer || '',
      modelCode: data.model_code || '',
      manufactureYear: data.manufacture_year
        ? parseInt(data.manufacture_year)
        : null,
      color: data.color || '',
      chassisNumber: data.chassis_number || '',
      engineNumber: data.engine_number || '',
      operatorId: null,
      operator: { id: null, name: data.operator_name || '', code: '' },
      operatorName: data.operator_name || '',
      isActive: data.is_active !== false,
      notes: '',
      source: 'legacy',
      inspectionExpiryDate: null,
      insuranceExpiryDate: null,
      documents: {},
    };
  }

  async getBadgeVehicleById(key: string): Promise<BadgeVehicleData | null> {
    // Extract actual ID from badge prefix
    const actualId = key.replace('badge_', '');

    const { data, error } = await firebase
      .from('vehicle_badges')
      .select('*')
      .eq('id', actualId)
      .single();

    if (error || !data) return null;

    // Supabase uses snake_case field names
    const plateNumber = data.plate_number || '';
    const badgeType = data.badge_type || '';
    const badgeNumber = data.badge_number || '';
    const status = data.status || '';
    const expiryDate = data.expiry_date || null;
    const vehicleCategory = '';
    const hasBeds = isBedVehicle(vehicleCategory);

    return {
      id: `badge_${data.id}`,
      plateNumber,
      vehicleType: { id: null, name: badgeType },
      vehicleTypeName: badgeType,
      vehicleCategory,
      seatCapacity: hasBeds ? 0 : 0,
      bedCapacity: hasBeds ? 0 : 0,
      manufacturer: '',
      modelCode: '',
      manufactureYear: null,
      color: '',
      chassisNumber: '',
      engineNumber: '',
      operatorId: null,
      operator: { id: null, name: '', code: '' },
      operatorName: '',
      isActive: status !== 'Thu hồi',
      notes: `Phù hiệu: ${badgeNumber}`,
      source: 'badge',
      badgeNumber,
      badgeType,
      badgeExpiryDate: expiryDate,
      documents: {},
    };
  }

  async getLegacyOperatorName(operatorId: string): Promise<string | null> {
    // Extract actual vehicle ID
    const vehicleKey = operatorId.replace('legacy_op_', '').replace('legacy_', '');

    const { data, error } = await firebase
      .from('vehicles')
      .select('operator_name')
      .eq('id', vehicleKey)
      .single();

    if (error || !data) return null;
    return ((data.operator_name || '') as string).trim();
  }

  filterLegacyByOperator(vehicles: LegacyVehicleData[], operatorName: string): LegacyVehicleData[] {
    const targetName = operatorName.trim().toLowerCase();

    // Try exact match from index
    let indices = this.operatorIndex?.get(targetName) || [];

    // Partial match fallback
    if (indices.length === 0) {
      const normalizedTarget = targetName.replace(/^(ông|bà|anh|chị|mr\.|mrs\.|ms\.)\s*/i, '').trim();

      for (let i = 0; i < vehicles.length; i++) {
        const vehicleOpName = (vehicles[i].operatorName || '').trim().toLowerCase();
        if (!vehicleOpName) continue;

        const isMatch =
          vehicleOpName.includes(targetName) ||
          targetName.includes(vehicleOpName) ||
          vehicleOpName.includes(normalizedTarget) ||
          normalizedTarget.includes(vehicleOpName);

        if (isMatch) {
          indices.push(i);
        }
      }
    }

    return indices.map((i) => vehicles[i]).filter(Boolean);
  }

  clearCache(): void {
    this.legacyCache = { data: null, timestamp: 0 };
    this.operatorIndex = null;
    this.badgeCache = { data: null, timestamp: 0 };
  }

  /**
   * Lookup vehicle by plate number using cached data
   * Returns vehicle info for permit dialog (much faster than RTDB query)
   */
  async lookupByPlate(plate: string): Promise<{
    id: string;
    plateNumber: string;
    seatCapacity: number;
    bedCapacity: number;
    operatorName: string;
    vehicleType: string;
    source: 'legacy' | 'badge';
  } | null> {
    const normalizedSearch = plate.replace(/[.\-\s]/g, '').toUpperCase();

    // Search in cached legacy vehicles first (most common)
    const legacyVehicles = await this.getLegacyVehicles();
    for (const v of legacyVehicles) {
      const normalizedPlate = v.plateNumber.replace(/[.\-\s]/g, '').toUpperCase();
      if (normalizedPlate === normalizedSearch) {
        return {
          id: v.id,
          plateNumber: v.plateNumber,
          seatCapacity: v.seatCapacity,
          bedCapacity: v.bedCapacity,
          operatorName: v.operatorName,
          vehicleType: v.vehicleCategory || v.vehicleTypeName,
          source: 'legacy',
        };
      }
    }

    // Search in badge vehicles as fallback
    const badgeVehicles = await this.getBadgeVehicles();
    for (const v of badgeVehicles) {
      const normalizedPlate = v.plateNumber.replace(/[.\-\s]/g, '').toUpperCase();
      if (normalizedPlate === normalizedSearch) {
        return {
          id: v.id,
          plateNumber: v.plateNumber,
          seatCapacity: v.seatCapacity,
          bedCapacity: v.bedCapacity,
          operatorName: v.operatorName,
          vehicleType: v.vehicleCategory || v.vehicleTypeName,
          source: 'badge',
        };
      }
    }

    return null;
  }

  // Pre-warm cache on server startup
  async preWarm(): Promise<void> {
    const startTime = Date.now();
    console.log('[VehicleCache] Pre-warming cache...');
    
    try {
      // Load both caches in parallel
      const [legacy, badge] = await Promise.all([
        this.getLegacyVehicles(),
        this.getBadgeVehicles(),
      ]);
      
      const elapsed = Date.now() - startTime;
      console.log(`[VehicleCache] Pre-warmed: ${legacy.length} legacy + ${badge.length} badge vehicles in ${elapsed}ms`);
    } catch (error) {
      console.error('[VehicleCache] Pre-warm failed:', error);
    }
  }
}

export const vehicleCacheService = new VehicleCacheService();
