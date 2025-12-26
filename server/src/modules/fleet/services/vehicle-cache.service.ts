/**
 * Vehicle Cache Service
 * Handles legacy and badge vehicles from Firebase RTDB with caching
 */

import { firebaseDb } from '../../../config/database.js';

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

    const snapshot = await firebaseDb.ref('datasheet/Xe').once('value');
    const data = snapshot.val();
    const vehicles: LegacyVehicleData[] = [];
    const operatorIndex = new Map<string, number[]>();

    if (data) {
      let idx = 0;
      for (const [key, xe] of Object.entries(data)) {
        const x = xe as Record<string, unknown>;
        if (!x) continue;

        const plateNumber = (x.plate_number || x.BienSo || '') as string;
        if (!plateNumber) continue;

        const operatorName = ((x.owner_name || x.TenDangKyXe || '') as string).trim().toLowerCase();
        const vehicleCategory = (x.vehicle_category || x.LoaiPhuongTien || '') as string;
        const seatCount = parseInt(String(x.seat_count || x.SoCho)) || 0;
        // If vehicle category contains "giường nằm", seatCount is actually bedCount
        const hasBeds = isBedVehicle(vehicleCategory);

        vehicles.push({
          id: `legacy_${key}`,
          plateNumber,
          vehicleType: { id: null, name: (x.vehicle_type || x.LoaiXe || '') as string },
          vehicleTypeName: (x.vehicle_type || x.LoaiXe || '') as string,
          vehicleCategory,
          seatCapacity: hasBeds ? 0 : seatCount,
          bedCapacity: hasBeds ? seatCount : 0,
          manufacturer: (x.manufacturer || x.NhanHieu || '') as string,
          modelCode: (x.model_code || x.SoLoai || '') as string,
          manufactureYear: (x.manufacture_year || x.NamSanXuat)
            ? parseInt(String(x.manufacture_year || x.NamSanXuat))
            : null,
          color: (x.color || x.MauSon || '') as string,
          chassisNumber: (x.chassis_number || x.SoKhung || '') as string,
          engineNumber: (x.engine_number || x.SoMay || '') as string,
          operatorId: null,
          operator: { id: null, name: (x.owner_name || x.TenDangKyXe || '') as string, code: '' },
          operatorName: (x.owner_name || x.TenDangKyXe || '') as string,
          isActive: true,
          notes: (x.notes || x.GhiChu || '') as string,
          source: 'legacy',
          inspectionExpiryDate: (x.inspection_expiry || x.NgayHetHanKiemDinh || null) as string | null,
          insuranceExpiryDate: (x.insurance_expiry || x.NgayHetHanBaoHiem || null) as string | null,
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
    
    // Load both badges and vehicles data for joining
    const [badgeSnapshot, vehicleSnapshot] = await Promise.all([
      firebaseDb.ref('datasheet/PHUHIEUXE').once('value'),
      firebaseDb.ref('datasheet/Xe').once('value')
    ]);
    
    const badgeData = badgeSnapshot.val();
    const vehicleData = vehicleSnapshot.val();
    
    // Build vehicle lookup map by plate number (normalized)
    const vehicleByPlate = new Map<string, Record<string, unknown>>();
    if (vehicleData) {
      for (const [, v] of Object.entries(vehicleData)) {
        const vehicle = v as Record<string, unknown>;
        const plate = ((vehicle.plate_number || vehicle.BienSo || '') as string).replace(/[.\-\s]/g, '').toUpperCase();
        if (plate) {
          vehicleByPlate.set(plate, vehicle);
        }
      }
    }
    
    const vehicles: BadgeVehicleData[] = [];

    if (badgeData) {
      for (const [key, badge] of Object.entries(badgeData)) {
        const b = badge as Record<string, unknown>;
        if (!b) continue;
        
        // Support both old field names and new field names from sync
        const plateNumber = (b.license_plate_sheet || b.BienSoXe || '') as string;
        if (!plateNumber) continue;
        
        const badgeType = (b.badge_type || b.LoaiPH || '') as string;
        if (!allowedTypes.includes(badgeType)) continue;

        const badgeNumber = (b.badge_number || b.SoPhuHieu || '') as string;
        const status = (b.status || b.TrangThai || '') as string;
        const expiryDate = (b.expiry_date || b.NgayHetHan || null) as string | null;
        
        // Try to find matching vehicle for additional info
        const normalizedPlate = plateNumber.replace(/[.\-\s]/g, '').toUpperCase();
        const matchingVehicle = vehicleByPlate.get(normalizedPlate);
        
        // Get operator and seat count from vehicle if available
        let operatorName = (b.operator_name || '') as string;
        let seatCount = parseInt(String(b.seat_count || 0)) || 0;
        let vehicleCategory = '';
        let manufacturer = '';
        let modelCode = '';
        let manufactureYear: number | null = null;
        let color = '';
        let chassisNumber = '';
        let engineNumber = '';
        
        if (matchingVehicle) {
          operatorName = operatorName || (matchingVehicle.owner_name || matchingVehicle.TenDangKyXe || '') as string;
          seatCount = seatCount || parseInt(String(matchingVehicle.seat_count || matchingVehicle.SoCho || 0)) || 0;
          vehicleCategory = (matchingVehicle.vehicle_category || matchingVehicle.LoaiPhuongTien || '') as string;
          manufacturer = (matchingVehicle.manufacturer || matchingVehicle.NhanHieu || '') as string;
          modelCode = (matchingVehicle.model_code || matchingVehicle.SoLoai || '') as string;
          manufactureYear = (matchingVehicle.manufacture_year || matchingVehicle.NamSanXuat)
            ? parseInt(String(matchingVehicle.manufacture_year || matchingVehicle.NamSanXuat))
            : null;
          color = (matchingVehicle.color || matchingVehicle.MauSon || '') as string;
          chassisNumber = (matchingVehicle.chassis_number || matchingVehicle.SoKhung || '') as string;
          engineNumber = (matchingVehicle.engine_number || matchingVehicle.SoMay || '') as string;
        }
        
        // If vehicle category contains "giường nằm", seatCount is actually bedCount
        const hasBeds = isBedVehicle(vehicleCategory);

        vehicles.push({
          id: `badge_${key}`,
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
    }

    this.badgeCache = { data: vehicles, timestamp: Date.now() };
    return vehicles;
  }

  async getLegacyVehicleById(key: string): Promise<LegacyVehicleData | null> {
    const snapshot = await firebaseDb.ref(`datasheet/Xe/${key}`).once('value');
    const data = snapshot.val();
    if (!data) return null;

    const vehicleCategory = data.vehicle_category || data.LoaiPhuongTien || '';
    const seatCount = parseInt(data.seat_count || data.SoCho) || 0;
    const hasBeds = isBedVehicle(vehicleCategory);

    return {
      id: `legacy_${key}`,
      plateNumber: data.plate_number || data.BienSo || '',
      vehicleType: { id: null, name: data.vehicle_type || data.LoaiXe || '' },
      vehicleTypeName: data.vehicle_type || data.LoaiXe || '',
      vehicleCategory,
      seatCapacity: hasBeds ? 0 : seatCount,
      bedCapacity: hasBeds ? seatCount : 0,
      manufacturer: data.manufacturer || data.NhanHieu || '',
      modelCode: data.model_code || data.SoLoai || '',
      manufactureYear: (data.manufacture_year || data.NamSanXuat)
        ? parseInt(data.manufacture_year || data.NamSanXuat)
        : null,
      color: data.color || data.MauSon || '',
      chassisNumber: data.chassis_number || data.SoKhung || '',
      engineNumber: data.engine_number || data.SoMay || '',
      operatorId: null,
      operator: { id: null, name: data.owner_name || data.TenDangKyXe || '', code: '' },
      operatorName: data.owner_name || data.TenDangKyXe || '',
      isActive: true,
      notes: '',
      source: 'legacy',
      inspectionExpiryDate: null,
      insuranceExpiryDate: null,
      documents: {},
    };
  }

  async getBadgeVehicleById(key: string): Promise<BadgeVehicleData | null> {
    const snapshot = await firebaseDb.ref(`datasheet/PHUHIEUXE/${key}`).once('value');
    const data = snapshot.val();
    if (!data) return null;

    // Support both old and new field names
    const plateNumber = data.license_plate_sheet || data.BienSoXe || '';
    const badgeType = data.badge_type || data.LoaiPH || '';
    const badgeNumber = data.badge_number || data.SoPhuHieu || '';
    const status = data.status || data.TrangThai || '';
    const expiryDate = data.expiry_date || data.NgayHetHan || null;
    const operatorName = data.operator_name || '';
    const seatCount = parseInt(String(data.seat_count || 0)) || 0;
    const vehicleCategory = data.vehicle_category || '';
    const hasBeds = isBedVehicle(vehicleCategory);

    return {
      id: `badge_${key}`,
      plateNumber,
      vehicleType: { id: null, name: badgeType },
      vehicleTypeName: badgeType,
      vehicleCategory,
      seatCapacity: hasBeds ? 0 : seatCount,
      bedCapacity: hasBeds ? seatCount : 0,
      manufacturer: '',
      modelCode: '',
      manufactureYear: null,
      color: '',
      chassisNumber: '',
      engineNumber: '',
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
    };
  }

  async getLegacyOperatorName(operatorId: string): Promise<string | null> {
    const vehicleKey = operatorId.replace('legacy_op_', '').replace('legacy_', '');
    const snapshot = await firebaseDb.ref(`datasheet/Xe/${vehicleKey}`).once('value');
    const data = snapshot.val();
    if (!data) return null;
    return ((data.owner_name || data.TenDangKyXe || '') as string).trim();
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
