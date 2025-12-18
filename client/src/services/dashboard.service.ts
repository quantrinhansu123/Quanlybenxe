import { firebaseClient } from '@/lib/firebase'

export interface DashboardStats {
  vehiclesInStation: number
  vehiclesDepartedToday: number
  revenueToday: number
  invalidVehicles: number
}

export interface ChartDataPoint {
  hour: string
  count: number
}

export interface RecentActivity {
  id: string
  vehiclePlateNumber: string
  route: string
  entryTime: string
  status: string
}

export interface Warning {
  type: 'vehicle' | 'driver'
  plateNumber?: string
  name?: string
  document: string
  expiryDate: string
}

export interface DashboardData {
  stats: DashboardStats
  chartData: ChartDataPoint[]
  recentActivity: RecentActivity[]
  warnings: Warning[]
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    // Get dispatch records
    const dispatchRecords = await firebaseClient.getAsArray<any>('dispatch_records')

    // Vehicles in station
    const vehiclesInStation = dispatchRecords.filter(record => 
      ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(record.current_status) &&
      !record.exit_time
    ).length

    // Vehicles departed today
    const vehiclesDepartedToday = dispatchRecords.filter(record => {
      if (record.current_status !== 'departed' || !record.exit_time) return false
      const exitTime = new Date(record.exit_time)
      return exitTime >= todayStart && exitTime <= todayEnd
    }).length

    // Revenue today
    const invoices = await firebaseClient.getAsArray<any>('invoices')
    const todayStr = todayStart.toISOString().split('T')[0]
    const revenueToday = invoices
      .filter(inv => {
        const issueDate = inv.issue_date?.split('T')[0] || inv.issue_date
        return issueDate === todayStr
      })
      .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0)

    // Invalid vehicles (expired documents)
    const vehicleDocuments = await firebaseClient.getAsArray<any>('vehicle_documents')
    const today = new Date().toISOString().split('T')[0]
    const invalidVehicles = vehicleDocuments.filter(doc => {
      const expiryDate = doc.expiry_date?.split('T')[0] || doc.expiry_date
      return expiryDate && expiryDate < today
    }).length

    return {
      vehiclesInStation,
      vehiclesDepartedToday,
      revenueToday,
      invalidVehicles,
    }
  },

  getChartData: async (): Promise<ChartDataPoint[]> => {
    const chartDate = new Date()
    const hours = Array.from({ length: 12 }, (_, i) => i + 6) // 6h to 17h

    const dispatchRecords = await firebaseClient.getAsArray<any>('dispatch_records')

    return hours.map(hour => {
      const hourStart = new Date(chartDate)
      hourStart.setHours(hour, 0, 0, 0)
      const hourEnd = new Date(chartDate)
      hourEnd.setHours(hour, 59, 59, 999)

      const count = dispatchRecords.filter(record => {
        if (!record.entry_time) return false
        const entryTime = new Date(record.entry_time)
        return entryTime >= hourStart && entryTime <= hourEnd
      }).length

      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count,
      }
    })
  },

  getRecentActivity: async (): Promise<RecentActivity[]> => {
    const dispatchRecords = await firebaseClient.getAsArray<any>('dispatch_records')
    const vehicles = await firebaseClient.get<Record<string, any>>('vehicles') || {}
    const routes = await firebaseClient.get<Record<string, any>>('routes') || {}

    return dispatchRecords
      .filter(r => r.entry_time)
      .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
      .slice(0, 10)
      .map(record => ({
        id: record.id,
        vehiclePlateNumber: vehicles[record.vehicle_id]?.plate_number || '',
        route: routes[record.route_id]?.route_name || '',
        entryTime: record.entry_time,
        status: record.current_status,
      }))
  },

  getWarnings: async (): Promise<Warning[]> => {
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    const warnings: Warning[] = []

    // Vehicle documents
    const vehicleDocuments = await firebaseClient.getAsArray<any>('vehicle_documents')
    const vehicles = await firebaseClient.get<Record<string, any>>('vehicles') || {}

    const docTypeMap: Record<string, string> = {
      'registration': 'Đăng kiểm',
      'inspection': 'Đăng kiểm',
      'insurance': 'Bảo hiểm',
      'operation_permit': 'Phù hiệu',
      'emblem': 'Phù hiệu',
    }

    for (const doc of vehicleDocuments) {
      if (!doc.expiry_date) continue
      const expiryDate = doc.expiry_date.split('T')[0] || doc.expiry_date
      if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
        const vehicle = vehicles[doc.vehicle_id] || {}
        warnings.push({
          type: 'vehicle',
          plateNumber: vehicle.plate_number || '',
          document: docTypeMap[doc.document_type] || doc.document_type,
          expiryDate,
        })
      }
    }

    // Driver licenses
    const drivers = await firebaseClient.getAsArray<any>('drivers')
    for (const driver of drivers) {
      if (!driver.license_expiry_date) continue
      const expiryDate = driver.license_expiry_date.split('T')[0] || driver.license_expiry_date
      if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
        warnings.push({
          type: 'driver',
          name: driver.full_name || '',
          document: 'Bằng lái',
          expiryDate,
        })
      }
    }

    return warnings.sort((a, b) => 
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    )
  },

  getDashboardData: async (): Promise<DashboardData> => {
    const [stats, chartData, recentActivity, warnings] = await Promise.all([
      dashboardService.getStats(),
      dashboardService.getChartData(),
      dashboardService.getRecentActivity(),
      dashboardService.getWarnings(),
    ])

    return {
      stats,
      chartData,
      recentActivity,
      warnings,
    }
  },
}
