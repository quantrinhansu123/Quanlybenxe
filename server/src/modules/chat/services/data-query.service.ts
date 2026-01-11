// TODO: Migrate to use ChatCacheService (see plan: data-query-consolidation)
// This file still uses Firebase RTDB - deferred migration to separate plan
import { firebaseDb } from '../../../config/database.js'
import type { IntentResult, QueryResult } from '../types/chat.types.js'

export class DataQueryService {
  async execute(intent: IntentResult): Promise<QueryResult> {
    const { type, extractedParams } = intent

    switch (type) {
      case 'VEHICLE_LOOKUP':
        return this.queryVehicleComplete(extractedParams.plateNumber, extractedParams.listAll === 'true')
      case 'DRIVER_SEARCH':
        return this.queryDriver(extractedParams.searchTerm)
      case 'ROUTE_INFO':
        return this.queryRoute(extractedParams.searchTerm, extractedParams.destination)
      case 'SCHEDULE_QUERY':
        return this.querySchedule(extractedParams.searchTerm)
      case 'DISPATCH_STATS':
        return this.queryDispatchStats(extractedParams.period)
      case 'BADGE_LOOKUP':
        return this.queryBadge(extractedParams.badgeNumber)
      case 'OPERATOR_INFO':
        return this.queryOperator(extractedParams.searchTerm)
      default:
        return { success: false, error: 'Unknown query type', source: 'none' }
    }
  }

  // Query xe + phù hiệu + datasheet/Xe theo biển số
  async queryVehicleComplete(plateNumber: string, listAll: boolean = false): Promise<QueryResult> {
    try {
      const results: any = {
        vehicles: [],
        badges: [],
        legacyVehicles: []
      }

      // If listAll mode, return summary
      if (listAll || !plateNumber) {
        const [vehiclesSnap, badgesSnap, xeSnap] = await Promise.all([
          firebaseDb.ref('vehicles').once('value'),
          firebaseDb.ref('vehicle_badges').once('value'),
          firebaseDb.ref('datasheet/Xe').once('value')
        ])

        const vehicleCount = vehiclesSnap.numChildren()
        const badgeCount = badgesSnap.numChildren()
        const legacyCount = xeSnap.numChildren()

        // Get sample plates
        const samplePlates: string[] = []
        const vehiclesData = vehiclesSnap.val()
        if (vehiclesData) {
          let count = 0
          for (const v of Object.values(vehiclesData)) {
            const plate = (v as any).plate_number || (v as any).plateNumber
            if (plate && count < 5) {
              samplePlates.push(plate)
              count++
            }
          }
        }

        return {
          success: true,
          data: {
            summary: true,
            vehicleCount,
            badgeCount,
            legacyCount,
            samplePlates,
            message: `Hệ thống có ${vehicleCount} xe đăng ký, ${badgeCount} phù hiệu, ${legacyCount} xe từ dữ liệu cũ. Hãy nhập biển số cụ thể để tra cứu (VD: xe 98H07480)`
          },
          source: 'vehicles'
        }
      }

      const searchPlate = plateNumber.toUpperCase()

      // 1. Search in vehicles collection
      const vehiclesSnap = await firebaseDb.ref('vehicles').once('value')
      const vehiclesData = vehiclesSnap.val()

      if (vehiclesData) {
        for (const [key, vehicle] of Object.entries(vehiclesData)) {
          const v = vehicle as any
          const plate = (v.plate_number || v.plateNumber || '').toUpperCase()
          if (plate.includes(searchPlate)) {
            // Get operator info
            let operatorName = ''
            if (v.operator_id || v.operatorId) {
              const opSnap = await firebaseDb.ref(`operators/${v.operator_id || v.operatorId}`).once('value')
              const opData = opSnap.val()
              operatorName = opData?.name || ''
            }
            results.vehicles.push({ ...v, id: key, operatorName })
          }
        }
      }

      // 2. Search in vehicle_badges
      const badgesSnap = await firebaseDb.ref('vehicle_badges').once('value')
      const badgesData = badgesSnap.val()

      if (badgesData) {
        for (const [key, badge] of Object.entries(badgesData)) {
          const b = badge as any
          const plate = (b.BienSoXe || b.plate_number || '').toUpperCase()
          if (plate.includes(searchPlate)) {
            results.badges.push({ ...b, id: key })
          }
        }
      }

      // 3. Search in datasheet/Xe (legacy data)
      const xeSnap = await firebaseDb.ref('datasheet/Xe').once('value')
      const xeData = xeSnap.val()

      if (xeData) {
        for (const [key, xe] of Object.entries(xeData)) {
          const x = xe as any
          if (!x) continue
          const plate = (x.plate_number || x.BienSo || '').toUpperCase()
          if (plate.includes(searchPlate)) {
            results.legacyVehicles.push({ ...x, id: key })
          }
        }
      }

      // Check if any results found
      const totalFound = results.vehicles.length + results.badges.length + results.legacyVehicles.length
      if (totalFound === 0) {
        return { 
          success: false, 
          error: `Không tìm thấy xe với biển số "${plateNumber}". Hãy kiểm tra lại biển số hoặc thử tìm kiếm khác.`, 
          source: 'vehicles' 
        }
      }

      return {
        success: true,
        data: {
          plateNumber,
          ...results,
          totalFound
        },
        source: 'vehicles+badges'
      }
    } catch (error: any) {
      console.error('queryVehicleComplete error:', error)
      return { success: false, error: error.message, source: 'vehicles' }
    }
  }

  // Keep old method for backward compatibility
  async queryVehicle(plateNumber: string): Promise<QueryResult> {
    return this.queryVehicleComplete(plateNumber, false)
  }

  async queryDriver(searchTerm: string): Promise<QueryResult> {
    if (!searchTerm) {
      return { success: false, error: 'Không có thông tin tìm kiếm', source: 'drivers' }
    }

    try {
      const driversSnap = await firebaseDb.ref('drivers').once('value')
      const driversData = driversSnap.val()
      const results: any[] = []

      if (driversData) {
        const searchLower = searchTerm.toLowerCase()
        for (const [key, driver] of Object.entries(driversData)) {
          const d = driver as any
          const fullName = (d.full_name || d.fullName || '').toLowerCase()
          const licenseNumber = (d.license_number || d.licenseNumber || '').toLowerCase()

          if (fullName.includes(searchLower) || licenseNumber.includes(searchLower)) {
            results.push({ ...d, id: key })
          }
        }
      }

      if (results.length > 0) {
        return { success: true, data: results, source: 'drivers' }
      }

      return { success: false, error: `Không tìm thấy tài xế "${searchTerm}"`, source: 'drivers' }
    } catch (error: any) {
      return { success: false, error: error.message, source: 'drivers' }
    }
  }

  async queryRoute(searchTerm: string, _destination?: string): Promise<QueryResult> {
    if (!searchTerm) {
      return { success: false, error: 'Không có thông tin tuyến', source: 'routes' }
    }

    try {
      // Search in routes collection
      const routesSnap = await firebaseDb.ref('routes').once('value')
      const routesData = routesSnap.val()
      const results: any[] = []

      if (routesData) {
        const searchLower = searchTerm.toLowerCase()
        for (const [key, route] of Object.entries(routesData)) {
          const r = route as any
          const routeName = (r.route_name || r.routeName || '').toLowerCase()
          const routeCode = (r.route_code || r.routeCode || '').toLowerCase()

          if (routeName.includes(searchLower) || routeCode.includes(searchLower)) {
            results.push({ ...r, id: key })
          }
        }
      }

      // Also search in datasheet/DANHMUCTUYENCODINH
      const danhMucSnap = await firebaseDb.ref('datasheet/DANHMUCTUYENCODINH').once('value')
      const danhMucData = danhMucSnap.val()

      if (danhMucData) {
        const searchLower = searchTerm.toLowerCase()
        for (const [key, tuyen] of Object.entries(danhMucData)) {
          const t = tuyen as any
          if (!t) continue
          const routeCode = (t.route_code || t.MaSoTuyen || '').toLowerCase()
          const departureSt = (t.departure_station || t.BenDi || '').toLowerCase()
          const arrivalSt = (t.arrival_station || t.BenDen || '').toLowerCase()

          if (routeCode.includes(searchLower) ||
              departureSt.includes(searchLower) ||
              arrivalSt.includes(searchLower)) {
            results.push({ ...t, id: key, source: 'legacy' })
          }
        }
      }

      if (results.length > 0) {
        return { success: true, data: results.slice(0, 10), source: 'routes' }
      }

      return { success: false, error: `Không tìm thấy tuyến "${searchTerm}"`, source: 'routes' }
    } catch (error: any) {
      return { success: false, error: error.message, source: 'routes' }
    }
  }

  async querySchedule(_searchTerm: string): Promise<QueryResult> {
    try {
      const schedulesSnap = await firebaseDb.ref('schedules').once('value')
      const schedulesData = schedulesSnap.val()

      if (!schedulesData) {
        return { success: false, error: 'Chưa có lịch trình nào', source: 'schedules' }
      }

      const results = Object.entries(schedulesData)
        .map(([key, schedule]) => ({ ...(schedule as any), id: key }))
        .filter((s: any) => s.is_active !== false)
        .slice(0, 20)

      return { success: true, data: results, source: 'schedules' }
    } catch (error: any) {
      return { success: false, error: error.message, source: 'schedules' }
    }
  }

  async queryDispatchStats(_period: string): Promise<QueryResult> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const dispatchSnap = await firebaseDb.ref('dispatch_records').once('value')
      const dispatchData = dispatchSnap.val()

      if (!dispatchData) {
        return { success: true, data: { totalToday: 0, entered: 0, exited: 0 }, source: 'dispatch_records' }
      }

      let entered = 0
      let exited = 0

      for (const [_key, record] of Object.entries(dispatchData)) {
        const r = record as any
        const entryDate = (r.entry_time || r.entryTime || '').split('T')[0]
        const exitDate = (r.exit_time || r.exitTime || '').split('T')[0]

        if (entryDate === today) entered++
        if (exitDate === today) exited++
      }

      return {
        success: true,
        data: { date: today, totalToday: entered, entered, exited },
        source: 'dispatch_records'
      }
    } catch (error: any) {
      return { success: false, error: error.message, source: 'dispatch_records' }
    }
  }

  async queryBadge(badgeNumber: string): Promise<QueryResult> {
    if (!badgeNumber) {
      return { success: false, error: 'Không có số phù hiệu', source: 'vehicle_badges' }
    }

    try {
      const badgesSnap = await firebaseDb.ref('vehicle_badges').once('value')
      const badgesData = badgesSnap.val()

      if (badgesData) {
        const searchUpper = badgeNumber.toUpperCase()
        for (const [key, badge] of Object.entries(badgesData)) {
          const b = badge as any
          const number = (b.SoPhuHieu || b.badge_number || '').toUpperCase()
          const plate = (b.BienSoXe || b.plate_number || '').toUpperCase()

          if (number.includes(searchUpper) || plate.includes(searchUpper)) {
            return { success: true, data: { ...b, id: key }, source: 'vehicle_badges' }
          }
        }
      }

      return { success: false, error: `Không tìm thấy phù hiệu "${badgeNumber}"`, source: 'vehicle_badges' }
    } catch (error: any) {
      return { success: false, error: error.message, source: 'vehicle_badges' }
    }
  }

  async queryOperator(searchTerm: string): Promise<QueryResult> {
    if (!searchTerm) {
      return { success: false, error: 'Không có thông tin đơn vị', source: 'operators' }
    }

    try {
      const operatorsSnap = await firebaseDb.ref('operators').once('value')
      const operatorsData = operatorsSnap.val()
      const results: any[] = []

      if (operatorsData) {
        const searchLower = searchTerm.toLowerCase()
        for (const [key, operator] of Object.entries(operatorsData)) {
          const o = operator as any
          const name = (o.name || '').toLowerCase()
          const code = (o.code || '').toLowerCase()

          if (name.includes(searchLower) || code.includes(searchLower)) {
            results.push({ ...o, id: key })
          }
        }
      }

      if (results.length > 0) {
        return { success: true, data: results, source: 'operators' }
      }

      return { success: false, error: `Không tìm thấy đơn vị "${searchTerm}"`, source: 'operators' }
    } catch (error: any) {
      return { success: false, error: error.message, source: 'operators' }
    }
  }

  async getContextForAI(message: string): Promise<any> {
    const context: any = {}

    // Extract potential vehicle reference
    const vehicleMatch = message.match(/([0-9]{2}[A-Z][0-9A-Z\-\.]+)/i)
    if (vehicleMatch) {
      const vehicleResult = await this.queryVehicle(vehicleMatch[1])
      if (vehicleResult.success) {
        context.vehicle = vehicleResult.data
      }
    }

    // Get general stats
    try {
      const [vehiclesSnap, driversSnap, operatorsSnap] = await Promise.all([
        firebaseDb.ref('vehicles').once('value'),
        firebaseDb.ref('drivers').once('value'),
        firebaseDb.ref('operators').once('value')
      ])

      context.stats = {
        totalVehicles: vehiclesSnap.numChildren(),
        totalDrivers: driversSnap.numChildren(),
        totalOperators: operatorsSnap.numChildren()
      }
    } catch {
      // Ignore stats errors
    }

    return context
  }
}

export const dataQueryService = new DataQueryService()
