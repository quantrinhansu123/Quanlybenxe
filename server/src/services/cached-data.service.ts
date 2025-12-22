/**
 * Cached Data Service
 * Provides cached access to frequently accessed static/semi-static data
 * Reduces Firebase RTDB reads significantly
 */

import { firebase } from '../config/database.js'
import { cache, cacheKeys, cacheTags, MemoryCache } from '../lib/cache.js'

// Type definitions
interface Operator {
  id: string
  name: string
  code: string
  [key: string]: any
}

interface VehicleType {
  id: string
  name: string
  [key: string]: any
}

interface Route {
  id: string
  name: string
  code: string
  [key: string]: any
}

interface Schedule {
  id: string
  route_id: string
  [key: string]: any
}

interface Vehicle {
  id: string
  plate_number: string
  operator_id?: string
  vehicle_type_id?: string
  [key: string]: any
}

interface Driver {
  id: string
  full_name: string
  operator_id?: string
  [key: string]: any
}

/**
 * Cached Data Service - singleton
 */
class CachedDataService {
  // ================== OPERATORS ==================
  async getAllOperators(): Promise<Operator[]> {
    return cache.getOrSet(
      cacheKeys.operators(),
      async () => {
        const { data, error } = await firebase.from('operators').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.OPERATORS] }
    )
  }

  async getOperatorById(id: string): Promise<Operator | null> {
    return cache.getOrSet(
      cacheKeys.operatorById(id),
      async () => {
        const { data, error } = await firebase
          .from('operators')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        return data || null
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.OPERATORS] }
    )
  }

  async getOperatorsMap(): Promise<Map<string, Operator>> {
    const operators = await this.getAllOperators()
    return new Map(operators.map((op) => [op.id, op]))
  }

  // ================== VEHICLE TYPES ==================
  async getAllVehicleTypes(): Promise<VehicleType[]> {
    return cache.getOrSet(
      cacheKeys.vehicleTypes(),
      async () => {
        const { data, error } = await firebase.from('vehicle_types').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.STATIC, tags: [cacheTags.STATIC] }
    )
  }

  async getVehicleTypesMap(): Promise<Map<string, VehicleType>> {
    const types = await this.getAllVehicleTypes()
    return new Map(types.map((t) => [t.id, t]))
  }

  // ================== ROUTES ==================
  async getAllRoutes(): Promise<Route[]> {
    return cache.getOrSet(
      cacheKeys.routes(),
      async () => {
        const { data, error } = await firebase.from('routes').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.ROUTES] }
    )
  }

  async getRouteById(id: string): Promise<Route | null> {
    return cache.getOrSet(
      cacheKeys.routeById(id),
      async () => {
        const { data, error } = await firebase
          .from('routes')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        return data || null
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.ROUTES] }
    )
  }

  async getRoutesMap(): Promise<Map<string, Route>> {
    const routes = await this.getAllRoutes()
    return new Map(routes.map((r) => [r.id, r]))
  }

  // ================== SCHEDULES ==================
  async getAllSchedules(): Promise<Schedule[]> {
    return cache.getOrSet(
      cacheKeys.schedules(),
      async () => {
        const { data, error } = await firebase.from('schedules').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.SCHEDULES] }
    )
  }

  async getSchedulesByRoute(routeId: string): Promise<Schedule[]> {
    return cache.getOrSet(
      cacheKeys.schedulesByRoute(routeId),
      async () => {
        const { data, error } = await firebase
          .from('schedules')
          .select('*')
          .eq('route_id', routeId)
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.SCHEDULES] }
    )
  }

  // ================== VEHICLES ==================
  async getAllVehicles(activeOnly = true): Promise<Vehicle[]> {
    const cacheKey = activeOnly ? cacheKeys.vehicles() : `${cacheKeys.vehicles()}:all`
    return cache.getOrSet(
      cacheKey,
      async () => {
        let query = firebase.from('vehicles').select('*').order('created_at', { ascending: false })
        if (activeOnly) {
          query = query.eq('is_active', true)
        }
        const { data, error } = await query
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.MEDIUM, tags: [cacheTags.VEHICLES] }
    )
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    return cache.getOrSet(
      cacheKeys.vehicleById(id),
      async () => {
        const { data, error } = await firebase
          .from('vehicles')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        return data || null
      },
      { ttl: MemoryCache.TTL.MEDIUM, tags: [cacheTags.VEHICLES] }
    )
  }

  async getVehiclesMap(): Promise<Map<string, Vehicle>> {
    const vehicles = await this.getAllVehicles()
    return new Map(vehicles.map((v) => [v.id, v]))
  }

  // ================== DRIVERS ==================
  async getAllDrivers(): Promise<Driver[]> {
    return cache.getOrSet(
      cacheKeys.drivers(),
      async () => {
        const { data, error } = await firebase
          .from('drivers')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.MEDIUM, tags: [cacheTags.DRIVERS] }
    )
  }

  async getDriverById(id: string): Promise<Driver | null> {
    return cache.getOrSet(
      cacheKeys.driverById(id),
      async () => {
        const { data, error } = await firebase
          .from('drivers')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        return data || null
      },
      { ttl: MemoryCache.TTL.MEDIUM, tags: [cacheTags.DRIVERS] }
    )
  }

  async getDriversMap(): Promise<Map<string, Driver>> {
    const drivers = await this.getAllDrivers()
    return new Map(drivers.map((d) => [d.id, d]))
  }

  // ================== SERVICES ==================
  async getAllServices(): Promise<any[]> {
    return cache.getOrSet(
      cacheKeys.services(),
      async () => {
        const { data, error } = await firebase.from('services').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.SERVICES] }
    )
  }

  async getAllServiceFormulas(): Promise<any[]> {
    return cache.getOrSet(
      cacheKeys.serviceFormulas(),
      async () => {
        const { data, error } = await firebase.from('service_formulas').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.SERVICES] }
    )
  }

  // ================== STATIC DATA ==================
  async getAllShifts(): Promise<any[]> {
    return cache.getOrSet(
      cacheKeys.shifts(),
      async () => {
        const { data, error } = await firebase.from('shifts').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.STATIC, tags: [cacheTags.STATIC] }
    )
  }

  async getAllLocations(): Promise<any[]> {
    return cache.getOrSet(
      cacheKeys.locations(),
      async () => {
        const { data, error } = await firebase.from('locations').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.STATIC, tags: [cacheTags.STATIC] }
    )
  }

  async getAllProvinces(): Promise<any[]> {
    return cache.getOrSet(
      cacheKeys.provinces(),
      async () => {
        const { data, error } = await firebase.from('provinces').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.STATIC, tags: [cacheTags.STATIC] }
    )
  }

  async getAllVehicleBadges(): Promise<any[]> {
    return cache.getOrSet(
      cacheKeys.vehicleBadges(),
      async () => {
        const { data, error } = await firebase.from('vehicle_badges').select('*')
        if (error) throw error
        return data || []
      },
      { ttl: MemoryCache.TTL.LONG, tags: [cacheTags.STATIC] }
    )
  }

  // ================== CACHE INVALIDATION ==================
  invalidateVehicles(): void {
    cache.invalidateByTag(cacheTags.VEHICLES)
  }

  invalidateDrivers(): void {
    cache.invalidateByTag(cacheTags.DRIVERS)
  }

  invalidateOperators(): void {
    cache.invalidateByTag(cacheTags.OPERATORS)
  }

  invalidateRoutes(): void {
    cache.invalidateByTag(cacheTags.ROUTES)
  }

  invalidateSchedules(): void {
    cache.invalidateByTag(cacheTags.SCHEDULES)
  }

  invalidateServices(): void {
    cache.invalidateByTag(cacheTags.SERVICES)
  }

  invalidateDispatch(): void {
    cache.invalidateByTag(cacheTags.DISPATCH)
  }

  invalidateAll(): void {
    cache.clear()
  }

  // ================== PRELOAD ==================
  async preloadCommonData(): Promise<void> {
    console.log('[Cache] Preloading common data...')
    const start = Date.now()

    await Promise.all([
      this.getAllOperators(),
      this.getAllVehicleTypes(),
      this.getAllRoutes(),
      this.getAllSchedules(),
      this.getAllVehicles(),
      this.getAllDrivers(),
      this.getAllServices(),
      this.getAllShifts(),
      this.getAllVehicleBadges(),
    ])

    console.log(`[Cache] Preloaded in ${Date.now() - start}ms`)
  }
}

// Singleton export
export const cachedData = new CachedDataService()
