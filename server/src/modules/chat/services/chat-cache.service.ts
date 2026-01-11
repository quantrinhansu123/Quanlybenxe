import { firebase } from '../../../config/database.js'

// Supabase table names (matching existing schema)
const TABLES = {
  vehicles: 'vehicles',
  badges: 'vehicle_badges',
  operators: 'operators',
  routes: 'routes',
  drivers: 'drivers',
  dispatch_records: 'dispatch_records',
  schedules: 'schedules',
  services: 'services',
  shifts: 'shifts',
  invoices: 'invoices',
  violations: 'violations',
  service_charges: 'service_charges'
}

interface CacheStats {
  vehicles: number
  badges: number
  operators: number
  routes: number
  drivers: number
  dispatch_records: number
  schedules: number
  services: number
  shifts: number
  invoices: number
  violations: number
  service_charges: number
  lastRefresh: string
}

class ChatCacheService {
  private cache: Map<string, any[]> = new Map()
  private plateIndex: Map<string, any[]> = new Map()
  private nameIndex: Map<string, any[]> = new Map()
  private codeIndex: Map<string, any[]> = new Map()
  private lastRefresh: Date | null = null
  private refreshInterval: NodeJS.Timeout | null = null
  private isWarming = false

  async preWarm(): Promise<void> {
    if (this.isWarming) return
    this.isWarming = true

    console.log('[ChatCache] Pre-warming cache from Supabase...')
    const startTime = Date.now()

    try {
      const loadPromises = Object.entries(TABLES).map(async ([key, table]) => {
        try {
          const { data, error } = await firebase.from(table).select('*')
          if (error) {
            console.warn(`[ChatCache] Error loading ${key}:`, error.message)
            this.cache.set(key, [])
            return { key, count: 0 }
          }
          const items = data || []
          this.cache.set(key, items)
          return { key, count: items.length }
        } catch (error) {
          console.warn(`[ChatCache] Failed to load ${key}:`, error)
          this.cache.set(key, [])
          return { key, count: 0 }
        }
      })

      const results = await Promise.all(loadPromises)
      this.buildIndexes()
      this.lastRefresh = new Date()

      const totalItems = results.reduce((sum, r) => sum + r.count, 0)
      console.log(`[ChatCache] Loaded ${totalItems} items in ${Date.now() - startTime}ms`)
      results.forEach(r => console.log(`  - ${r.key}: ${r.count}`))

      // Start auto-refresh every 5 minutes
      if (!this.refreshInterval) {
        this.refreshInterval = setInterval(() => this.refresh(), 5 * 60 * 1000)
      }
    } finally {
      this.isWarming = false
    }
  }

  async refresh(): Promise<void> {
    console.log('[ChatCache] Refreshing cache...')
    await this.preWarm()
  }

  private buildIndexes(): void {
    this.plateIndex.clear()
    this.nameIndex.clear()
    this.codeIndex.clear()

    // Index vehicles by plate (Supabase uses snake_case)
    const vehicles = this.cache.get('vehicles') || []
    vehicles.forEach((v: any) => {
      const plate = this.normalizePlate(v.plate_number || '')
      if (plate) {
        const existing = this.plateIndex.get(plate) || []
        this.plateIndex.set(plate, [...existing, { ...v, _source: 'vehicles' }])
      }
    })

    // Index badges by plate (Supabase uses snake_case)
    const badges = this.cache.get('badges') || []
    badges.forEach((b: any) => {
      const plate = this.normalizePlate(b.plate_number || b.license_plate_sheet || '')
      if (plate) {
        const existing = this.plateIndex.get(plate) || []
        this.plateIndex.set(plate, [...existing, { ...b, _source: 'badges' }])
      }
    })

    // Index operators by name (Supabase uses 'name')
    const operators = this.cache.get('operators') || []
    operators.forEach((o: any) => {
      const name = this.normalizeText(o.name || '')
      if (name) {
        const existing = this.nameIndex.get(name) || []
        this.nameIndex.set(name, [...existing, { ...o, _source: 'operators' }])
      }
    })

    // Index drivers by name (Supabase uses 'full_name')
    const drivers = this.cache.get('drivers') || []
    drivers.forEach((d: any) => {
      const name = this.normalizeText(d.full_name || '')
      if (name) {
        const existing = this.nameIndex.get(name) || []
        this.nameIndex.set(name, [...existing, { ...d, _source: 'drivers' }])
      }
    })

    // Index routes by code (Supabase uses 'route_code')
    const routes = this.cache.get('routes') || []
    routes.forEach((r: any) => {
      const code = this.normalizeText(r.route_code || '')
      if (code) {
        const existing = this.codeIndex.get(code) || []
        this.codeIndex.set(code, [...existing, { ...r, _source: 'routes' }])
      }
    })

    console.log(`[ChatCache] Built indexes: plates=${this.plateIndex.size}, names=${this.nameIndex.size}, codes=${this.codeIndex.size}`)
  }

  private normalizePlate(plate: string): string {
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  // Search functions
  searchVehicleByPlate(plate: string): any[] {
    const normalized = this.normalizePlate(plate)
    const results: any[] = []

    // Exact match
    if (this.plateIndex.has(normalized)) {
      results.push(...(this.plateIndex.get(normalized) || []))
    }

    // Partial match
    if (results.length === 0) {
      this.plateIndex.forEach((items, key) => {
        if (key.includes(normalized) || normalized.includes(key)) {
          results.push(...items)
        }
      })
    }

    // Fallback to full scan (Supabase uses snake_case)
    if (results.length === 0 && normalized.length >= 3) {
      const vehicles = this.cache.get('vehicles') || []
      vehicles.forEach((v: any) => {
        const vPlate = this.normalizePlate(v.plate_number || '')
        if (vPlate.includes(normalized)) {
          results.push({ ...v, _source: 'vehicles' })
        }
      })
    }

    return this.deduplicateResults(results)
  }

  searchDriverByName(name: string): any[] {
    const normalized = this.normalizeText(name)
    const results: any[] = []

    // Search in name index
    this.nameIndex.forEach((items, key) => {
      if (key.includes(normalized) || normalized.includes(key)) {
        items.filter((i: any) => i._source === 'drivers').forEach((item: any) => results.push(item))
      }
    })

    // Fallback to full scan (Supabase uses 'full_name')
    if (results.length === 0) {
      const drivers = this.cache.get('drivers') || []
      drivers.forEach((d: any) => {
        const dName = this.normalizeText(d.full_name || '')
        if (dName.includes(normalized)) {
          results.push({ ...d, _source: 'drivers' })
        }
      })
    }

    return this.deduplicateResults(results)
  }

  searchOperatorByName(name: string): any[] {
    const normalized = this.normalizeText(name)
    const results: any[] = []

    // Search in name index
    this.nameIndex.forEach((items, key) => {
      if (key.includes(normalized) || normalized.includes(key)) {
        items.filter((i: any) => i._source === 'operators').forEach((item: any) => results.push(item))
      }
    })

    // Fallback to full scan (Supabase uses 'name')
    if (results.length === 0) {
      const operators = this.cache.get('operators') || []
      operators.forEach((o: any) => {
        const oName = this.normalizeText(o.name || '')
        if (oName.includes(normalized)) {
          results.push({ ...o, _source: 'operators' })
        }
      })
    }

    return this.deduplicateResults(results)
  }

  searchRouteByCode(code: string): any[] {
    const normalized = this.normalizeText(code)
    const results: any[] = []

    // Search in code index
    this.codeIndex.forEach((items, key) => {
      if (key.includes(normalized) || normalized.includes(key)) {
        results.push(...items)
      }
    })

    // Search by departure/arrival station (Supabase uses snake_case)
    if (results.length === 0) {
      const routes = this.cache.get('routes') || []
      routes.forEach((r: any) => {
        const departure = this.normalizeText(r.departure_station || '')
        const arrival = this.normalizeText(r.arrival_station || '')
        if (departure.includes(normalized) || arrival.includes(normalized)) {
          results.push({ ...r, _source: 'routes' })
        }
      })
    }

    return this.deduplicateResults(results)
  }

  searchBadgeByNumber(number: string): any[] {
    const normalized = this.normalizePlate(number)
    const badges = this.cache.get('badges') || []

    return badges.filter((b: any) => {
      const badgeNum = this.normalizePlate(b.badge_number || '')
      const plate = this.normalizePlate(b.plate_number || b.license_plate_sheet || '')
      return badgeNum.includes(normalized) || plate.includes(normalized)
    }).map((b: any) => ({ ...b, _source: 'badges' }))
  }

  searchSchedules(term: string): any[] {
    const normalized = this.normalizeText(term)
    const schedules = this.cache.get('schedules') || []

    if (!term || term === 'today') {
      return schedules.slice(0, 20).map((s: any) => ({ ...s, _source: 'schedules' }))
    }

    return schedules.filter((s: any) => {
      const code = this.normalizeText(s.schedule_code || '')
      return code.includes(normalized)
    }).map((s: any) => ({ ...s, _source: 'schedules' }))
  }

  searchServices(term: string): any[] {
    const normalized = this.normalizeText(term)
    const services = this.cache.get('services') || []

    if (!term) {
      return services.slice(0, 20).map((s: any) => ({ ...s, _source: 'services' }))
    }

    return services.filter((s: any) => {
      const name = this.normalizeText(s.name || s.service_name || '')
      const code = this.normalizeText(s.code || s.service_code || '')
      return name.includes(normalized) || code.includes(normalized)
    }).map((s: any) => ({ ...s, _source: 'services' }))
  }

  getDispatchStats(date?: string): { date: string; entered: number; departed: number; total: number } {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const records = this.cache.get('dispatch_records') || []

    let entered = 0
    let departed = 0

    records.forEach((r: any) => {
      const entryDate = (r.entry_time || '').split('T')[0]
      const exitDate = (r.exit_time || '').split('T')[0]
      const status = r.current_status || r.status || ''

      if (entryDate === targetDate) {
        entered++
      }
      if (exitDate === targetDate || (status === 'departed' && entryDate === targetDate)) {
        departed++
      }
    })

    return { date: targetDate, entered, departed, total: entered }
  }

  getSystemStats(): CacheStats {
    return {
      vehicles: (this.cache.get('vehicles') || []).length,
      badges: (this.cache.get('badges') || []).length,
      operators: (this.cache.get('operators') || []).length,
      routes: (this.cache.get('routes') || []).length,
      drivers: (this.cache.get('drivers') || []).length,
      dispatch_records: (this.cache.get('dispatch_records') || []).length,
      schedules: (this.cache.get('schedules') || []).length,
      services: (this.cache.get('services') || []).length,
      shifts: (this.cache.get('shifts') || []).length,
      invoices: (this.cache.get('invoices') || []).length,
      violations: (this.cache.get('violations') || []).length,
      service_charges: (this.cache.get('service_charges') || []).length,
      lastRefresh: this.lastRefresh?.toISOString() || 'never'
    }
  }

  getShiftInfo(date?: string): any[] {
    const shifts = this.cache.get('shifts') || []
    if (!date) {
      return shifts.slice(0, 10).map((s: any) => ({ ...s, _source: 'shifts' }))
    }
    return shifts.filter((s: any) => {
      const shiftDate = (s.date || s.shift_date || '').split('T')[0]
      return shiftDate === date
    }).map((s: any) => ({ ...s, _source: 'shifts' }))
  }

  getInvoices(date?: string, limit: number = 10): any[] {
    const invoices = this.cache.get('invoices') || []
    if (!date) {
      return invoices.slice(0, limit).map((i: any) => ({ ...i, _source: 'invoices' }))
    }
    return invoices.filter((i: any) => {
      const invoiceDate = (i.date || i.invoice_date || i.created_at || '').split('T')[0]
      return invoiceDate === date
    }).slice(0, limit).map((i: any) => ({ ...i, _source: 'invoices' }))
  }

  getViolations(plate?: string): any[] {
    const violations = this.cache.get('violations') || []
    if (!plate) {
      return violations.slice(0, 20).map((v: any) => ({ ...v, _source: 'violations' }))
    }
    const normalized = this.normalizePlate(plate)
    return violations.filter((v: any) => {
      const vPlate = this.normalizePlate(v.plate_number || '')
      return vPlate.includes(normalized)
    }).map((v: any) => ({ ...v, _source: 'violations' }))
  }

  getServiceCharges(service?: string): any[] {
    const charges = this.cache.get('service_charges') || []
    if (!service) {
      return charges.slice(0, 20).map((c: any) => ({ ...c, _source: 'service_charges' }))
    }
    const normalized = this.normalizeText(service)
    return charges.filter((c: any) => {
      const name = this.normalizeText(c.service_name || c.name || '')
      return name.includes(normalized)
    }).map((c: any) => ({ ...c, _source: 'service_charges' }))
  }

  // Fuzzy search across all collections (fallback)
  fuzzySearch(query: string): any[] {
    const normalized = this.normalizeText(query)
    const results: any[] = []

    // Check if it looks like a plate number
    const plateMatch = query.match(/([0-9]{2}[A-Z][0-9A-Z\-\.]+)/i)
    if (plateMatch) {
      results.push(...this.searchVehicleByPlate(plateMatch[1]))
    }

    // Search operators
    const operators = this.searchOperatorByName(normalized)
    if (operators.length > 0) {
      results.push(...operators)
    }

    // Search drivers
    const drivers = this.searchDriverByName(normalized)
    if (drivers.length > 0) {
      results.push(...drivers)
    }

    // Search routes
    const routes = this.searchRouteByCode(normalized)
    if (routes.length > 0) {
      results.push(...routes)
    }

    return this.deduplicateResults(results).slice(0, 10)
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>()
    return results.filter(item => {
      const key = item.id || JSON.stringify(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  isReady(): boolean {
    return this.lastRefresh !== null
  }
}

export const chatCacheService = new ChatCacheService()
