import { Response } from 'express'
import { firebase } from '../config/database.js'
import { AuthRequest } from '../middleware/auth.js'

export const getDashboardData = async (_req: AuthRequest, res: Response) => {
  try {
    const [stats, chartData, recentActivity, warnings] = await Promise.all([
      getStatsData(),
      getChartDataData(),
      getRecentActivityData(),
      getWarningsData(),
    ])

    return res.json({
      stats,
      chartData,
      recentActivity,
      warnings,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return res.status(500).json({ error: 'Failed to fetch dashboard data' })
  }
}

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getStatsData()
    return res.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
}

export const getChartData = async (_req: AuthRequest, res: Response) => {
  try {
    const chartData = await getChartDataData()
    return res.json(chartData)
  } catch (error) {
    console.error('Error fetching chart data:', error)
    return res.status(500).json({ error: 'Failed to fetch chart data' })
  }
}

export const getRecentActivity = async (_req: AuthRequest, res: Response) => {
  try {
    const activity = await getRecentActivityData()
    return res.json(activity)
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return res.status(500).json({ error: 'Failed to fetch recent activity' })
  }
}

export const getWarnings = async (_req: AuthRequest, res: Response) => {
  try {
    const warnings = await getWarningsData()
    return res.json(warnings)
  } catch (error) {
    console.error('Error fetching warnings:', error)
    return res.status(500).json({ error: 'Failed to fetch warnings' })
  }
}

// Helper function to get Vietnam timezone date
function getVietnamDate() {
  const now = new Date()
  // Vietnam is UTC+7
  const vietnamOffset = 7 * 60 // minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
  return new Date(utcTime + (vietnamOffset * 60000))
}

// Helper functions
async function getStatsData() {
  const vietnamNow = getVietnamDate()
  const todayStart = new Date(vietnamNow.getFullYear(), vietnamNow.getMonth(), vietnamNow.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(vietnamNow.getFullYear(), vietnamNow.getMonth(), vietnamNow.getDate(), 23, 59, 59, 999)
  // Convert back to UTC for comparison
  const vietnamOffset = 7 * 60 * 60 * 1000
  const todayStartUTC = new Date(todayStart.getTime() - vietnamOffset)
  const todayEndUTC = new Date(todayEnd.getTime() - vietnamOffset)

  // Get all dispatch records using firebase query builder
  const { data: dispatchArray } = await firebase
    .from('dispatch_records')
    .select('*') as { data: any[] }

  const records = dispatchArray || []

  // Vehicles currently in station (any vehicle that hasn't departed yet, regardless of entry date)
  const vehiclesInStation = records.filter((record: any) => 
    ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(record.current_status) &&
    !record.exit_time
  ).length

  // Vehicles that departed TODAY (based on exit_time)
  const vehiclesDepartedToday = records.filter((record: any) => {
    if (record.current_status !== 'departed' || !record.exit_time) return false
    const exitTime = new Date(record.exit_time)
    return exitTime >= todayStartUTC && exitTime <= todayEndUTC
  }).length

  // Total vehicles = currently in station + departed today
  // This represents all vehicles that were active in the station today
  const totalVehiclesToday = vehiclesInStation + vehiclesDepartedToday

  // Format Vietnam date as YYYY-MM-DD string
  const todayStr = `${vietnamNow.getFullYear()}-${String(vietnamNow.getMonth() + 1).padStart(2, '0')}-${String(vietnamNow.getDate()).padStart(2, '0')}`

  // Revenue today - from dispatch_records with payment_amount (paid status)
  // Filter records that were paid today based on payment_time or updated_at
  const paidRecords = records.filter((record: any) => {
    if (record.current_status !== 'paid' && record.current_status !== 'departed') return false
    if (!record.payment_amount) return false
    
    // Check payment time or updated_at for today
    const paymentTime = record.payment_time || record.updated_at
    if (!paymentTime) return false
    
    const paidDate = new Date(paymentTime)
    return paidDate >= todayStartUTC && paidDate <= todayEndUTC
  })

  const revenueToday = paidRecords.reduce((sum: number, record: any) => 
    sum + (parseFloat(record.payment_amount) || 0), 0
  )

  // Invalid vehicles (vehicles with expired documents)
  const { data: documentsArray } = await firebase
    .from('vehicle_documents')
    .select('*') as { data: any[] }
  
  const invalidVehicles = (documentsArray || []).filter((doc: any) => {
    const expiryDate = doc.expiry_date?.split('T')[0] || doc.expiry_date
    return expiryDate && expiryDate < todayStr
  }).length

  return {
    totalVehiclesToday,    // Total unique vehicles entered today (main KPI)
    vehiclesInStation,     // Currently in station (subset of totalVehiclesToday)
    vehiclesDepartedToday, // Already departed (subset of totalVehiclesToday)
    revenueToday,
    invalidVehicles,
  }
}

async function getChartDataData() {
  const chartDate = new Date()
  const hours = Array.from({ length: 12 }, (_, i) => i + 6) // 6h to 17h

  // Get all dispatch records
  const { data: dispatchArray } = await firebase
    .from('dispatch_records')
    .select('*') as { data: any[] }

  const records = dispatchArray || []

  const chartData = hours.map((hour) => {
    const hourStart = new Date(chartDate)
    hourStart.setHours(hour, 0, 0, 0)
    const hourEnd = new Date(chartDate)
    hourEnd.setHours(hour, 59, 59, 999)

    const count = records.filter((record: any) => {
      if (!record.entry_time) return false
      const entryTime = new Date(record.entry_time)
      return entryTime >= hourStart && entryTime <= hourEnd
    }).length

    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      count,
    }
  })

  return chartData
}

async function getRecentActivityData() {
  // Get all dispatch records
  const { data: dispatchArray } = await firebase
    .from('dispatch_records')
    .select('*')
    .order('entry_time', { ascending: false })
    .limit(10) as { data: any[] }

  // Get vehicles and routes
  const { data: vehiclesArray } = await firebase.from('vehicles').select('*') as { data: any[] }
  const { data: routesArray } = await firebase.from('routes').select('*') as { data: any[] }

  // Convert to lookup maps
  const vehicles: Record<string, any> = {}
  const routes: Record<string, any> = {}
  
  ;(vehiclesArray || []).forEach((v: any) => { vehicles[v.id] = v })
  ;(routesArray || []).forEach((r: any) => { routes[r.id] = r })

  // Filter records with entry_time
  const sorted = (dispatchArray || []).filter((r: any) => r.entry_time)

  return sorted.map((record: any) => {
    const vehicle = vehicles[record.vehicle_id] || {}
    const route = routes[record.route_id] || {}
    
    return {
      id: record.id,
      vehiclePlateNumber: vehicle.plate_number || record.vehicle_plate_number || '',
      route: route.route_name || '',
      entryTime: record.entry_time,
      status: record.current_status,
    }
  })
}

async function getWarningsData() {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  const warnings: any[] = []

  // Get vehicle documents and vehicles
  const { data: documentsArray } = await firebase
    .from('vehicle_documents')
    .select('*') as { data: any[] }
  
  const { data: vehiclesArray } = await firebase
    .from('vehicles')
    .select('*') as { data: any[] }

  // Convert to lookup map
  const vehicles: Record<string, any> = {}
  ;(vehiclesArray || []).forEach((v: any) => { vehicles[v.id] = v })

  // Check vehicle documents expiring within 30 days
  const docTypeMap: Record<string, string> = {
    'registration': 'Đăng kiểm',
    'inspection': 'Đăng kiểm',
    'insurance': 'Bảo hiểm',
    'operation_permit': 'Phù hiệu',
    'emblem': 'Phù hiệu',
  }

  for (const doc of (documentsArray || [])) {
    if (!doc.expiry_date) continue
    
    const expiryDate = doc.expiry_date.split('T')[0] || doc.expiry_date
    if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
      const vehicle = vehicles[doc.vehicle_id] || {}
      warnings.push({
        type: 'vehicle',
        plateNumber: vehicle.plate_number || '',
        document: docTypeMap[doc.document_type] || doc.document_type,
        expiryDate: expiryDate,
      })
    }
  }

  // Check driver licenses expiring within 30 days
  const { data: driversArray } = await firebase
    .from('drivers')
    .select('*') as { data: any[] }

  for (const driver of (driversArray || [])) {
    if (!driver.license_expiry_date) continue
    
    const expiryDate = driver.license_expiry_date.split('T')[0] || driver.license_expiry_date
    if (expiryDate >= todayStr && expiryDate <= thirtyDaysFromNowStr) {
      warnings.push({
        type: 'driver',
        name: driver.full_name || '',
        document: 'Bằng lái',
        expiryDate: expiryDate,
      })
    }
  }

  return warnings.sort((a, b) => 
    new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  )
}

