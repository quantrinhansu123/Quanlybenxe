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
  seatCapacity: number;
  bedCapacity: number;
  manufacturer: string;
  modelCode: string;
  manufactureYear: null;
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

        vehicles.push({
          id: `legacy_${key}`,
          plateNumber,
          vehicleType: { id: null, name: (x.vehicle_type || x.LoaiXe || '') as string },
          vehicleTypeName: (x.vehicle_type || x.LoaiXe || '') as string,
          seatCapacity: parseInt(String(x.seat_count || x.SoCho)) || 0,
          bedCapacity: 0,
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
    const snapshot = await firebaseDb.ref('datasheet/PHUHIEUXE').once('value');
    const data = snapshot.val();
    const vehicles: BadgeVehicleData[] = [];

    if (data) {
      for (const [key, badge] of Object.entries(data)) {
        const b = badge as Record<string, unknown>;
        if (!b || !b.BienSoXe) continue;
        if (!allowedTypes.includes((b.LoaiPH || '') as string)) continue;

        vehicles.push({
          id: `badge_${key}`,
          plateNumber: b.BienSoXe as string,
          vehicleType: { id: null, name: (b.LoaiPH || '') as string },
          vehicleTypeName: (b.LoaiPH || '') as string,
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
          badgeNumber: (b.SoPhuHieu || '') as string,
          badgeType: (b.LoaiPH || '') as string,
          badgeExpiryDate: (b.NgayHetHan || null) as string | null,
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

    return {
      id: `legacy_${key}`,
      plateNumber: data.plate_number || data.BienSo || '',
      vehicleType: { id: null, name: data.vehicle_type || data.LoaiXe || '' },
      vehicleTypeName: data.vehicle_type || data.LoaiXe || '',
      seatCapacity: parseInt(data.seat_count || data.SoCho) || 0,
      bedCapacity: 0,
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

    return {
      id: `badge_${key}`,
      plateNumber: data.BienSoXe || '',
      vehicleType: { id: null, name: data.LoaiPH || '' },
      vehicleTypeName: data.LoaiPH || '',
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
      isActive: data.TrangThai !== 'Thu hồi',
      notes: `Phù hiệu: ${data.SoPhuHieu || ''}`,
      source: 'badge',
      badgeNumber: data.SoPhuHieu || '',
      badgeType: data.LoaiPH || '',
      badgeExpiryDate: data.NgayHetHan || null,
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
}

export const vehicleCacheService = new VehicleCacheService();
