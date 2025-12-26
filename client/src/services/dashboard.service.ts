import api from '@/lib/api'

export interface DashboardStats {
  totalVehiclesToday: number    // Total unique vehicles entered today
  vehiclesInStation: number     // Currently in station
  vehiclesDepartedToday: number // Already departed
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

export interface WeeklyStat {
  day: string
  dayName: string
  departed: number
  inStation: number
  total: number
}

export interface MonthlyStat {
  month: string
  monthName: string
  departed: number
  waiting: number
  other: number
}

export interface RouteBreakdown {
  routeId: string
  routeName: string
  count: number
  percentage: number
}

export interface DashboardData {
  stats: DashboardStats
  chartData: ChartDataPoint[]
  recentActivity: RecentActivity[]
  warnings: Warning[]
  weeklyStats: WeeklyStat[]
  monthlyStats: MonthlyStat[]
  routeBreakdown: RouteBreakdown[]
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    try {
      const response = await api.get<DashboardStats>('/dashboard/stats')
      return response.data
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return {
        totalVehiclesToday: 0,
        vehiclesInStation: 0,
        vehiclesDepartedToday: 0,
        revenueToday: 0,
        invalidVehicles: 0,
      }
    }
  },

  getChartData: async (): Promise<ChartDataPoint[]> => {
    try {
      const response = await api.get<ChartDataPoint[]>('/dashboard/chart-data')
      return response.data
    } catch (error) {
      console.error('Error fetching chart data:', error)
      return []
    }
  },

  getRecentActivity: async (): Promise<RecentActivity[]> => {
    try {
      const response = await api.get<RecentActivity[]>('/dashboard/recent-activity')
      return response.data
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      return []
    }
  },

  getWarnings: async (): Promise<Warning[]> => {
    try {
      const response = await api.get<Warning[]>('/dashboard/warnings')
      return response.data
    } catch (error) {
      console.error('Error fetching warnings:', error)
      return []
    }
  },

  getDashboardData: async (): Promise<DashboardData> => {
    try {
      const response = await api.get<DashboardData>('/dashboard')
      return response.data
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to individual calls
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
        weeklyStats: [],
        monthlyStats: [],
        routeBreakdown: [],
      }
    }
  },
}
