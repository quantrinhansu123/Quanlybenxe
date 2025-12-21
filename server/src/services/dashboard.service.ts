/**
 * Dashboard Service
 * Business logic for dashboard data aggregation
 */

import { firebase } from '../config/database.js';
import type { DispatchDBRecord } from '../modules/dispatch/dispatch-types.js';
import type { VehicleDBRecord, VehicleDocumentDB, DriverDBRecord } from '../modules/fleet/fleet-types.js';
import type { FirebaseQueryResult } from '../types/common.js';

// Route DB record (minimal for dashboard needs)
interface RouteDBRecord {
  id: string;
  route_name: string;
}

// Helper function to get Vietnam timezone date
function getVietnamDate(): Date {
  const now = new Date();
  const vietnamOffset = 7 * 60; // minutes
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcTime + vietnamOffset * 60000);
}

interface DashboardStats {
  totalVehiclesToday: number;
  vehiclesInStation: number;
  vehiclesDepartedToday: number;
  revenueToday: number;
  invalidVehicles: number;
}

interface ChartDataPoint {
  hour: string;
  count: number;
}

interface RecentActivity {
  id: string;
  vehiclePlateNumber: string;
  route: string;
  entryTime: string;
  status: string;
}

interface Warning {
  type: 'vehicle' | 'driver';
  plateNumber?: string;
  name?: string;
  document: string;
  expiryDate: string;
}

export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const vietnamNow = getVietnamDate();
    const todayStart = new Date(vietnamNow.getFullYear(), vietnamNow.getMonth(), vietnamNow.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(vietnamNow.getFullYear(), vietnamNow.getMonth(), vietnamNow.getDate(), 23, 59, 59, 999);
    const vietnamOffset = 7 * 60 * 60 * 1000;
    const todayStartUTC = new Date(todayStart.getTime() - vietnamOffset);
    const todayEndUTC = new Date(todayEnd.getTime() - vietnamOffset);

    const { data: dispatchArray } = (await firebase.from('dispatch_records').select('*')) as FirebaseQueryResult<DispatchDBRecord>;
    const records = dispatchArray || [];

    const vehiclesInStation = records.filter(
      (record) =>
        ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(record.current_status) &&
        !record.exit_time
    ).length;

    const vehiclesDepartedToday = records.filter((record) => {
      if (record.current_status !== 'departed' || !record.exit_time) return false;
      const exitTime = new Date(record.exit_time);
      return exitTime >= todayStartUTC && exitTime <= todayEndUTC;
    }).length;

    const totalVehiclesToday = vehiclesInStation + vehiclesDepartedToday;

    const todayStr = `${vietnamNow.getFullYear()}-${String(vietnamNow.getMonth() + 1).padStart(2, '0')}-${String(vietnamNow.getDate()).padStart(2, '0')}`;

    const paidRecords = records.filter((record) => {
      if (record.current_status !== 'paid' && record.current_status !== 'departed') return false;
      if (!record.payment_amount) return false;
      const paymentTime = record.payment_time || record.updated_at;
      if (!paymentTime) return false;
      const paidDate = new Date(paymentTime);
      return paidDate >= todayStartUTC && paidDate <= todayEndUTC;
    });

    const revenueToday = paidRecords.reduce((sum, record) => sum + (parseFloat(String(record.payment_amount)) || 0), 0);

    const { data: documentsArray } = (await firebase.from('vehicle_documents').select('*')) as FirebaseQueryResult<VehicleDocumentDB>;
    const invalidVehicles = (documentsArray || []).filter((doc) => {
      const expiryDate = doc.expiry_date?.split('T')[0] || doc.expiry_date;
      return expiryDate && expiryDate < todayStr;
    }).length;

    return { totalVehiclesToday, vehiclesInStation, vehiclesDepartedToday, revenueToday, invalidVehicles };
  }

  async getChartData(): Promise<ChartDataPoint[]> {
    const chartDate = new Date();
    const hours = Array.from({ length: 12 }, (_, i) => i + 6);

    const { data: dispatchArray } = (await firebase.from('dispatch_records').select('*')) as FirebaseQueryResult<DispatchDBRecord>;
    const records = dispatchArray || [];

    return hours.map((hour) => {
      const hourStart = new Date(chartDate);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(chartDate);
      hourEnd.setHours(hour, 59, 59, 999);

      const count = records.filter((record) => {
        if (!record.entry_time) return false;
        const entryTime = new Date(record.entry_time);
        return entryTime >= hourStart && entryTime <= hourEnd;
      }).length;

      return { hour: `${hour.toString().padStart(2, '0')}:00`, count };
    });
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    const { data: dispatchArray } = (await firebase
      .from('dispatch_records')
      .select('*')
      .order('entry_time', { ascending: false })
      .limit(10)) as FirebaseQueryResult<DispatchDBRecord>;

    const { data: vehiclesArray } = (await firebase.from('vehicles').select('*')) as FirebaseQueryResult<VehicleDBRecord>;
    const { data: routesArray } = (await firebase.from('routes').select('*')) as FirebaseQueryResult<RouteDBRecord>;

    const vehicles: Record<string, VehicleDBRecord> = {};
    const routes: Record<string, RouteDBRecord> = {};
    (vehiclesArray || []).forEach((v) => { vehicles[v.id] = v; });
    (routesArray || []).forEach((r) => { routes[r.id] = r; });

    return (dispatchArray || [])
      .filter((r) => r.entry_time)
      .map((record) => {
        const vehicle = vehicles[record.vehicle_id];
        const route = record.route_id ? routes[record.route_id] : undefined;
        return {
          id: record.id,
          vehiclePlateNumber: vehicle?.plate_number || record.vehicle_plate_number || '',
          route: route?.route_name || '',
          entryTime: record.entry_time,
          status: record.current_status,
        };
      });
  }

  async getWarnings(): Promise<Warning[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const warnings: Warning[] = [];

    const { data: documentsArray } = (await firebase.from('vehicle_documents').select('*')) as FirebaseQueryResult<VehicleDocumentDB>;
    const { data: vehiclesArray } = (await firebase.from('vehicles').select('*')) as FirebaseQueryResult<VehicleDBRecord>;

    const vehicles: Record<string, VehicleDBRecord> = {};
    (vehiclesArray || []).forEach((v) => { vehicles[v.id] = v; });

    const docTypeMap: Record<string, string> = {
      registration: 'Đăng kiểm',
      inspection: 'Đăng kiểm',
      insurance: 'Bảo hiểm',
      operation_permit: 'Phù hiệu',
      emblem: 'Phù hiệu',
    };

    for (const doc of documentsArray || []) {
      if (!doc.expiry_date) continue;
      const expiryDate = doc.expiry_date.split('T')[0] || doc.expiry_date;
      if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
        const vehicle = vehicles[doc.vehicle_id];
        warnings.push({
          type: 'vehicle',
          plateNumber: vehicle?.plate_number || '',
          document: docTypeMap[doc.document_type] || doc.document_type,
          expiryDate,
        });
      }
    }

    const { data: driversArray } = (await firebase.from('drivers').select('*')) as FirebaseQueryResult<DriverDBRecord>;
    for (const driver of driversArray || []) {
      if (!driver.license_expiry_date) continue;
      const expiryDate = driver.license_expiry_date.split('T')[0] || driver.license_expiry_date;
      if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
        warnings.push({
          type: 'driver',
          name: driver.full_name || '',
          document: 'Bằng lái',
          expiryDate,
        });
      }
    }

    return warnings.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  async getAllData() {
    const [stats, chartData, recentActivity, warnings] = await Promise.all([
      this.getStats(),
      this.getChartData(),
      this.getRecentActivity(),
      this.getWarnings(),
    ]);
    return { stats, chartData, recentActivity, warnings };
  }
}

export const dashboardService = new DashboardService();
