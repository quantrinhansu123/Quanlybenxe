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

// Helper function to get today's date string in Vietnam timezone (YYYY-MM-DD)
function getVietnamTodayStr(): string {
  const now = new Date();
  // Convert to Vietnam time (UTC+7)
  const vietnamTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to check if a datetime string is from today (Vietnam time)
// Since data is stored as Vietnam time with "Z" suffix, we compare date strings directly
function isToday(dateTimeStr: string | undefined, todayStr: string): boolean {
  if (!dateTimeStr) return false;
  const dateStr = dateTimeStr.split('T')[0]; // Extract YYYY-MM-DD
  return dateStr === todayStr;
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
    const todayStr = getVietnamTodayStr(); // e.g., "2025-12-26"

    const { data: dispatchArray } = (await firebase.from('dispatch_records').select('*')) as FirebaseQueryResult<DispatchDBRecord>;
    const records = dispatchArray || [];

    // Filter to only TODAY's records (by entry_time date string comparison)
    // This is simple and accurate since data is stored as Vietnam time with "Z" suffix
    const todayRecords = records.filter((record) => isToday(record.entry_time, todayStr));

    // Debug log
    console.log(`[Dashboard] Today: ${todayStr}, Total records: ${records.length}, Today records: ${todayRecords.length}`);

    // Vehicles currently in station (entered today and haven't exited)
    const vehiclesInStation = todayRecords.filter(
      (record) =>
        ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(record.current_status) &&
        !record.exit_time
    ).length;

    // Vehicles that departed today
    const vehiclesDepartedToday = todayRecords.filter((record) => {
      return record.current_status === 'departed' && record.exit_time;
    }).length;

    const totalVehiclesToday = vehiclesInStation + vehiclesDepartedToday;

    // Revenue from today's paid records
    const paidRecords = todayRecords.filter((record) => {
      return (record.current_status === 'paid' || record.current_status === 'departed') && record.payment_amount;
    });

    const revenueToday = paidRecords.reduce((sum, record) => sum + (parseFloat(String(record.payment_amount)) || 0), 0);

    // Documents expired before today
    const { data: documentsArray } = (await firebase.from('vehicle_documents').select('*')) as FirebaseQueryResult<VehicleDocumentDB>;
    const invalidVehicles = (documentsArray || []).filter((doc) => {
      const expiryDate = doc.expiry_date?.split('T')[0] || doc.expiry_date;
      return expiryDate && expiryDate < todayStr;
    }).length;

    console.log(`[Dashboard] Stats: inStation=${vehiclesInStation}, departed=${vehiclesDepartedToday}, total=${totalVehiclesToday}`);

    return { totalVehiclesToday, vehiclesInStation, vehiclesDepartedToday, revenueToday, invalidVehicles };
  }

  async getChartData(): Promise<ChartDataPoint[]> {
    const todayStr = getVietnamTodayStr();
    const hours = Array.from({ length: 12 }, (_, i) => i + 6); // 06:00 - 17:00

    const { data: dispatchArray } = (await firebase.from('dispatch_records').select('*')) as FirebaseQueryResult<DispatchDBRecord>;
    const records = dispatchArray || [];

    // Filter to today's records first
    const todayRecords = records.filter((record) => isToday(record.entry_time, todayStr));

    return hours.map((hour) => {
      const hourStr = hour.toString().padStart(2, '0');
      
      // Count records where entry_time hour matches
      // entry_time format: "2025-12-26T14:30:00Z"
      const count = todayRecords.filter((record) => {
        if (!record.entry_time) return false;
        const timeStr = record.entry_time.split('T')[1]; // "14:30:00Z"
        const recordHour = timeStr ? timeStr.substring(0, 2) : ''; // "14"
        return recordHour === hourStr;
      }).length;

      return { hour: `${hourStr}:00`, count };
    });
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    const todayStr = getVietnamTodayStr();

    const { data: dispatchArray } = (await firebase
      .from('dispatch_records')
      .select('*')
      .order('entry_time', { ascending: false })) as FirebaseQueryResult<DispatchDBRecord>;

    const { data: vehiclesArray } = (await firebase.from('vehicles').select('*')) as FirebaseQueryResult<VehicleDBRecord>;
    const { data: routesArray } = (await firebase.from('routes').select('*')) as FirebaseQueryResult<RouteDBRecord>;

    const vehicles: Record<string, VehicleDBRecord> = {};
    const routes: Record<string, RouteDBRecord> = {};
    (vehiclesArray || []).forEach((v) => { vehicles[v.id] = v; });
    (routesArray || []).forEach((r) => { routes[r.id] = r; });

    // Filter to TODAY's records only, then take top 10
    return (dispatchArray || [])
      .filter((r) => isToday(r.entry_time, todayStr))
      .slice(0, 10)
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
    const todayStr = getVietnamTodayStr();
    // Calculate 30 days from today in Vietnam timezone
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
    vietnamTime.setDate(vietnamTime.getDate() + 30);
    const year = vietnamTime.getFullYear();
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const thirtyDaysFromNowStr = `${year}-${month}-${day}`;

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
