/**
 * Dashboard Service
 * Business logic for dashboard data aggregation
 * Optimized: Single query per table + caching
 * Migrated to Drizzle ORM
 */

import { db } from '../db/drizzle.js';
import { dispatchRecords, vehicles, routes, drivers, vehicleBadges } from '../db/schema/index.js';
import { desc } from 'drizzle-orm';
import type { DispatchRecord } from '../db/schema/dispatch-records.js';
import type { Vehicle } from '../db/schema/vehicles.js';
import type { Route } from '../db/schema/routes.js';
import type { Driver } from '../db/schema/drivers.js';
import type { VehicleBadge } from '../db/schema/vehicle-badges.js';

// Cache structure
interface DashboardCache {
  data: DashboardAllData | null;
  timestamp: number;
}

interface DashboardAllData {
  stats: DashboardStats;
  chartData: ChartDataPoint[];
  recentActivity: RecentActivity[];
  warnings: Warning[];
  weeklyStats: WeeklyStat[];
  monthlyStats: MonthlyStat[];
  routeBreakdown: RouteBreakdown[];
}

// Cache with 1 minute TTL (dashboard needs fresh data)
let dashboardCache: DashboardCache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 1000; // 1 minute

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
function isToday(dateTimeStr: string | undefined, todayStr: string): boolean {
  if (!dateTimeStr) return false;
  const dateStr = dateTimeStr.split('T')[0];
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

interface WeeklyStat {
  day: string;
  dayName: string;
  departed: number;
  inStation: number;
  total: number;
}

interface MonthlyStat {
  month: string;
  monthName: string;
  departed: number;
  waiting: number;
  other: number;
}

interface RouteBreakdown {
  routeId: string;
  routeName: string;
  count: number;
  percentage: number;
}

// Raw data from database
interface RawData {
  dispatchRecords: DispatchRecord[];
  vehicles: Record<string, Vehicle>;
  routes: Record<string, Route>;
  vehicleBadges: VehicleBadge[];
  vehicleExpiryDocs: Array<{ vehicleId: string; plateNumber: string; documentType: string; expiryDate: string }>;
  drivers: Driver[];
  todayStr: string;
}

export class DashboardService {
  /**
   * Load all raw data from database in parallel (ONE query per table)
   */
  private async loadRawData(): Promise<RawData> {
    if (!db) {
      throw new Error('[Dashboard] Database not initialized');
    }

    const todayStr = getVietnamTodayStr();
    const startTime = Date.now();

    // Query all tables in PARALLEL
    const [
      dispatchRecordsData,
      vehiclesData,
      routesData,
      vehicleBadgesData,
      driversData,
    ] = await Promise.all([
      db.select().from(dispatchRecords).orderBy(desc(dispatchRecords.entryTime)),
      db.select().from(vehicles),
      db.select().from(routes),
      db.select().from(vehicleBadges),
      db.select().from(drivers),
    ]);

    // Convert to lookup maps
    const vehiclesMap: Record<string, Vehicle> = {};
    vehiclesData.forEach((v) => { vehiclesMap[v.id] = v; });

    const routesMap: Record<string, Route> = {};
    routesData.forEach((r) => { routesMap[r.id] = r; });

    // Flatten vehicle expiry documents from vehicles table + badges
    const vehicleExpiryDocs: Array<{ vehicleId: string; plateNumber: string; documentType: string; expiryDate: string }> = [];

    for (const vehicle of vehiclesData) {
      if (vehicle.roadWorthinessExpiry) {
        vehicleExpiryDocs.push({
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          documentType: 'registration',
          expiryDate: vehicle.roadWorthinessExpiry,
        });
      }
      if (vehicle.insuranceExpiry) {
        vehicleExpiryDocs.push({
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          documentType: 'insurance',
          expiryDate: vehicle.insuranceExpiry,
        });
      }
      if (vehicle.roadWorthinessExpiry) {
        vehicleExpiryDocs.push({
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          documentType: 'inspection',
          expiryDate: vehicle.roadWorthinessExpiry,
        });
      }
    }

    // Add vehicle badges expiry dates
    for (const badge of vehicleBadgesData) {
      if (badge.expiryDate && badge.vehicleId) {
        const vehicle = vehiclesMap[badge.vehicleId];
        vehicleExpiryDocs.push({
          vehicleId: badge.vehicleId,
          plateNumber: vehicle?.plateNumber || badge.plateNumber,
          documentType: 'emblem',
          expiryDate: badge.expiryDate,
        });
      }
    }

    console.log(`[Dashboard] Loaded raw data in ${Date.now() - startTime}ms`);

    return {
      dispatchRecords: dispatchRecordsData,
      vehicles: vehiclesMap,
      routes: routesMap,
      vehicleBadges: vehicleBadgesData,
      vehicleExpiryDocs,
      drivers: driversData,
      todayStr,
    };
  }

  /**
   * Calculate stats from raw data (no DB query)
   */
  private calculateStats(raw: RawData): DashboardStats {
    const { dispatchRecords, vehicleExpiryDocs, todayStr } = raw;

    // Filter to today's records
    const todayRecords = dispatchRecords.filter((r) => {
      if (!r.entryTime) return false;
      const entryTimeStr = r.entryTime.toISOString();
      return isToday(entryTimeStr, todayStr);
    });

    const vehiclesInStation = todayRecords.filter(
      (r) => ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(r.status || '') && !r.exitTime
    ).length;

    const vehiclesDepartedToday = todayRecords.filter((r) => r.status === 'departed' && r.exitTime).length;

    const totalVehiclesToday = vehiclesInStation + vehiclesDepartedToday;

    const paidRecords = todayRecords.filter((r) => (r.status === 'paid' || r.status === 'departed') && r.paymentAmount);
    const revenueToday = paidRecords.reduce((sum, r) => sum + (parseFloat(String(r.paymentAmount)) || 0), 0);

    const invalidVehicles = vehicleExpiryDocs.filter((doc) => {
      return doc.expiryDate && doc.expiryDate < todayStr;
    }).length;

    return { totalVehiclesToday, vehiclesInStation, vehiclesDepartedToday, revenueToday, invalidVehicles };
  }

  /**
   * Calculate chart data from raw data (no DB query)
   */
  private calculateChartData(raw: RawData): ChartDataPoint[] {
    const { dispatchRecords, todayStr } = raw;
    const hours = Array.from({ length: 12 }, (_, i) => i + 6);
    const todayRecords = dispatchRecords.filter((r) => {
      if (!r.entryTime) return false;
      const entryTimeStr = r.entryTime.toISOString();
      return isToday(entryTimeStr, todayStr);
    });

    return hours.map((hour) => {
      const hourStr = hour.toString().padStart(2, '0');
      const count = todayRecords.filter((r) => {
        if (!r.entryTime) return false;
        const timeStr = r.entryTime.toISOString().split('T')[1];
        const recordHour = timeStr ? timeStr.substring(0, 2) : '';
        return recordHour === hourStr;
      }).length;
      return { hour: `${hourStr}:00`, count };
    });
  }

  /**
   * Calculate recent activity from raw data (no DB query)
   */
  private calculateRecentActivity(raw: RawData): RecentActivity[] {
    const { dispatchRecords, vehicles, routes, todayStr } = raw;

    return dispatchRecords
      .filter((r) => {
        if (!r.entryTime) return false;
        const entryTimeStr = r.entryTime.toISOString();
        return isToday(entryTimeStr, todayStr);
      })
      .slice(0, 10)
      .map((record) => {
        const vehicle = record.vehicleId ? vehicles[record.vehicleId] : undefined;
        const route = record.routeId ? routes[record.routeId] : undefined;
        return {
          id: record.id,
          vehiclePlateNumber: vehicle?.plateNumber || record.vehiclePlateNumber || '',
          route: route?.routeCode || route?.departureStation || '',
          entryTime: record.entryTime ? record.entryTime.toISOString() : '',
          status: record.status || '',
        };
      });
  }

  /**
   * Calculate warnings from raw data (no DB query)
   */
  private calculateWarnings(raw: RawData): Warning[] {
    const { vehicleExpiryDocs, vehicles: vehiclesData, drivers, todayStr } = raw;
    // Note: vehiclesData used below for vehicle lookups
    void vehiclesData; // silence unused warning for now
    const warnings: Warning[] = [];

    // Calculate 30 days from today
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
    vietnamTime.setDate(vietnamTime.getDate() + 30);
    const thirtyDaysFromNowStr = `${vietnamTime.getFullYear()}-${String(vietnamTime.getMonth() + 1).padStart(2, '0')}-${String(vietnamTime.getDate()).padStart(2, '0')}`;

    const docTypeMap: Record<string, string> = {
      registration: 'Đăng kiểm',
      inspection: 'Đăng kiểm',
      insurance: 'Bảo hiểm',
      operation_permit: 'Phù hiệu',
      emblem: 'Phù hiệu',
    };

    for (const doc of vehicleExpiryDocs) {
      if (!doc.expiryDate) continue;
      const expiryDate = doc.expiryDate.split('T')[0] || doc.expiryDate;
      if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
        warnings.push({
          type: 'vehicle',
          plateNumber: doc.plateNumber || '',
          document: docTypeMap[doc.documentType] || doc.documentType,
          expiryDate,
        });
      }
    }

    for (const driver of drivers) {
      if (!driver.licenseExpiryDate) continue;
      const expiryDate = driver.licenseExpiryDate.split('T')[0] || driver.licenseExpiryDate;
      if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
        warnings.push({
          type: 'driver',
          name: driver.fullName || '',
          document: 'Bằng lái',
          expiryDate,
        });
      }
    }

    return warnings.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  /**
   * Calculate weekly stats from raw data (no DB query)
   */
  private calculateWeeklyStats(raw: RawData): WeeklyStat[] {
    const { dispatchRecords } = raw;
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const days: { dateStr: string; dayName: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const now = new Date();
      const vietnamTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
      vietnamTime.setDate(vietnamTime.getDate() - i);
      const dateStr = `${vietnamTime.getFullYear()}-${String(vietnamTime.getMonth() + 1).padStart(2, '0')}-${String(vietnamTime.getDate()).padStart(2, '0')}`;
      days.push({ dateStr, dayName: dayNames[vietnamTime.getDay()] });
    }

    return days.map(({ dateStr, dayName }) => {
      const dayRecords = dispatchRecords.filter((r) => {
        if (!r.entryTime) return false;
        const entryTimeStr = r.entryTime.toISOString();
        return isToday(entryTimeStr, dateStr);
      });
      const departed = dayRecords.filter((r) => r.status === 'departed' && r.exitTime).length;
      const inStation = dayRecords.filter((r) =>
        ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(r.status || '') && !r.exitTime
      ).length;
      return { day: dateStr, dayName, departed, inStation, total: departed + inStation };
    });
  }

  /**
   * Calculate monthly stats from raw data (no DB query)
   */
  private calculateMonthlyStats(raw: RawData): MonthlyStat[] {
    const { dispatchRecords } = raw;
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
    const currentYear = vietnamTime.getFullYear();
    const currentMonth = vietnamTime.getMonth();
    const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

    return monthNames.slice(0, currentMonth + 1).map((monthName, index) => {
      const yearMonthPrefix = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const monthRecords = dispatchRecords.filter((r) => {
        if (!r.entryTime) return false;
        const entryTimeStr = r.entryTime.toISOString();
        return entryTimeStr.startsWith(yearMonthPrefix);
      });
      const departed = monthRecords.filter((r) => r.status === 'departed').length;
      const waiting = monthRecords.filter((r) => ['entered', 'passengers_dropped', 'permit_issued', 'paid'].includes(r.status || '')).length;
      const other = monthRecords.length - departed - waiting;
      return { month: yearMonthPrefix, monthName, departed, waiting, other: Math.max(0, other) };
    });
  }

  /**
   * Calculate route breakdown from raw data (no DB query)
   */
  private calculateRouteBreakdown(raw: RawData): RouteBreakdown[] {
    const { dispatchRecords, routes, todayStr } = raw;
    const todayRecords = dispatchRecords.filter((r) => {
      if (!r.entryTime) return false;
      const entryTimeStr = r.entryTime.toISOString();
      return isToday(entryTimeStr, todayStr);
    });
    const total = todayRecords.length || 1;

    const routeCounts: Record<string, { routeName: string; count: number }> = {};
    for (const record of todayRecords) {
      const routeId = record.routeId || 'unknown';
      const route = routes[routeId];
      const routeName = route?.routeCode || route?.departureStation || 'Khác';
      if (!routeCounts[routeId]) routeCounts[routeId] = { routeName, count: 0 };
      routeCounts[routeId].count++;
    }

    return Object.entries(routeCounts)
      .map(([routeId, data]) => ({
        routeId,
        routeName: data.routeName,
        count: data.count,
        percentage: Math.round((data.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  /**
   * Get all dashboard data - OPTIMIZED: single load + caching
   */
  async getAllData(): Promise<DashboardAllData> {
    const now = Date.now();

    // Return cached data if valid
    if (dashboardCache.data && (now - dashboardCache.timestamp) < CACHE_TTL) {
      console.log('[Dashboard] Returning cached data');
      return dashboardCache.data;
    }

    const startTime = Date.now();

    // Load all raw data in ONE parallel batch (5 queries instead of 15+)
    const raw = await this.loadRawData();

    // Calculate all metrics from raw data (no more DB queries)
    const data: DashboardAllData = {
      stats: this.calculateStats(raw),
      chartData: this.calculateChartData(raw),
      recentActivity: this.calculateRecentActivity(raw),
      warnings: this.calculateWarnings(raw),
      weeklyStats: this.calculateWeeklyStats(raw),
      monthlyStats: this.calculateMonthlyStats(raw),
      routeBreakdown: this.calculateRouteBreakdown(raw),
    };

    // Update cache
    dashboardCache = { data, timestamp: now };

    console.log(`[Dashboard] Generated all data in ${Date.now() - startTime}ms`);
    return data;
  }

  // Individual getters for backward compatibility (use cached data)
  async getStats(): Promise<DashboardStats> {
    const data = await this.getAllData();
    return data.stats;
  }

  async getChartData(): Promise<ChartDataPoint[]> {
    const data = await this.getAllData();
    return data.chartData;
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    const data = await this.getAllData();
    return data.recentActivity;
  }

  async getWarnings(): Promise<Warning[]> {
    const data = await this.getAllData();
    return data.warnings;
  }

  async getWeeklyStats(): Promise<WeeklyStat[]> {
    const data = await this.getAllData();
    return data.weeklyStats;
  }

  async getMonthlyStats(): Promise<MonthlyStat[]> {
    const data = await this.getAllData();
    return data.monthlyStats;
  }

  async getRouteBreakdown(): Promise<RouteBreakdown[]> {
    const data = await this.getAllData();
    return data.routeBreakdown;
  }

  // Clear cache (for manual refresh)
  clearCache(): void {
    dashboardCache = { data: null, timestamp: 0 };
  }
}

export const dashboardService = new DashboardService();
