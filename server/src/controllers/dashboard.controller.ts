import { Response } from 'express'
import { firebaseREST } from '../lib/firebase-rest.js'
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

// Helper functions
async function getStatsData() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  // Get all dispatch records
  const dispatchRecords: any = await firebaseREST.get('dispatch_records') || {}
  const dispatchArray = Object.keys(dispatchRecords).map(key => ({
    id: key,
    ...dispatchRecords[key]
  }))

  // Vehicles in station (status = 'entered' or other non-departed statuses, and exit_time is NULL)
  const vehiclesInStation = dispatchArray.filter((record: any) => 
    ['entered', 'passengers_dropped', 'permit_issued', 'paid', 'departure_ordered'].includes(record.current_status) &&
    !record.exit_time
  ).length

  // Vehicles departed today
  const vehiclesDepartedToday = dispatchArray.filter((record: any) => {
    if (record.current_status !== 'departed' || !record.exit_time) return false
    const exitTime = new Date(record.exit_time)
    return exitTime >= todayStart && exitTime <= todayEnd
  }).length

  // Revenue today (from invoices)
  const invoices: any = await firebaseREST.get('invoices') || {}
  const invoicesArray = Object.keys(invoices).map(key => ({
    id: key,
    ...invoices[key]
  }))
  
  const todayStr = todayStart.toISOString().split('T')[0]
  const invoicesToday = invoicesArray.filter((inv: any) => {
    const issueDate = inv.issue_date?.split('T')[0] || inv.issue_date
    return issueDate === todayStr
  })

  const revenueToday = invoicesToday.reduce((sum: number, inv: any) => 
    sum + (parseFloat(inv.total_amount) || 0), 0
  )

  // Invalid vehicles (vehicles with expired documents)
  const vehicleDocuments: any = await firebaseREST.get('vehicle_documents') || {}
  const documentsArray = Object.keys(vehicleDocuments).map(key => ({
    id: key,
    ...vehicleDocuments[key]
  }))
  
  const today = new Date().toISOString().split('T')[0]
  const invalidVehicles = documentsArray.filter((doc: any) => {
    const expiryDate = doc.expiry_date?.split('T')[0] || doc.expiry_date
    return expiryDate && expiryDate < today
  }).length

  return {
    vehiclesInStation,
    vehiclesDepartedToday,
    revenueToday,
    invalidVehicles,
  }
}

async function getChartDataData() {
  const chartDate = new Date()
  const hours = Array.from({ length: 12 }, (_, i) => i + 6) // 6h to 17h

  // Get all dispatch records
  const dispatchRecords: any = await firebaseREST.get('dispatch_records') || {}
  const dispatchArray = Object.keys(dispatchRecords).map(key => ({
    id: key,
    ...dispatchRecords[key]
  }))

  const chartData = hours.map((hour) => {
    const hourStart = new Date(chartDate)
    hourStart.setHours(hour, 0, 0, 0)
    const hourEnd = new Date(chartDate)
    hourEnd.setHours(hour, 59, 59, 999)

    const count = dispatchArray.filter((record: any) => {
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
  const dispatchRecords: any = await firebaseREST.get('dispatch_records') || {}
  const dispatchArray = Object.keys(dispatchRecords).map(key => ({
    id: key,
    ...dispatchRecords[key]
  }))

  // Get vehicles and routes
  const vehicles: any = await firebaseREST.get('vehicles') || {}
  const routes: any = await firebaseREST.get('routes') || {}

  // Sort by entry_time descending and take first 10
  const sorted = dispatchArray
    .filter((r: any) => r.entry_time)
    .sort((a: any, b: any) => 
      new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
    )
    .slice(0, 10)

  return sorted.map((record: any) => {
    const vehicle = vehicles[record.vehicle_id] || {}
    const route = routes[record.route_id] || {}
    
    return {
      id: record.id,
      vehiclePlateNumber: vehicle.plate_number || '',
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
  const vehicleDocuments: any = await firebaseREST.get('vehicle_documents') || {}
  const documentsArray = Object.keys(vehicleDocuments).map(key => ({
    id: key,
    ...vehicleDocuments[key]
  }))
  
  const vehicles: any = await firebaseREST.get('vehicles') || {}

  // Check vehicle documents expiring within 30 days
  const docTypeMap: Record<string, string> = {
    'registration': 'Đăng kiểm',
    'inspection': 'Đăng kiểm',
    'insurance': 'Bảo hiểm',
    'operation_permit': 'Phù hiệu',
    'emblem': 'Phù hiệu',
  }

  for (const doc of documentsArray) {
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
  const drivers: any = await firebaseREST.get('drivers') || {}
  const driversArray = Object.keys(drivers).map(key => ({
    id: key,
    ...drivers[key]
  }))

  for (const driver of driversArray) {
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

