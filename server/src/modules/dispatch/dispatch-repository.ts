/**
 * Dispatch Repository - Drizzle ORM Version
 * Handles all PostgreSQL operations for dispatch records via Supabase
 * Includes in-memory caching for fast reads
 */
import { db, withTransaction } from '../../db/drizzle'
import { dispatchRecords } from '../../db/schema'
import { DrizzleRepository, eq, and, gte, lte, desc, sql } from '../../shared/database/drizzle-repository'
import type { DispatchFilters } from './dispatch-types'

// Infer types from schema
type DispatchRecord = typeof dispatchRecords.$inferSelect
type NewDispatchRecord = typeof dispatchRecords.$inferInsert

// Simple in-memory cache for dispatch records
interface DispatchCache {
  data: DispatchRecord[] | null
  timestamp: number
}
const dispatchCache: DispatchCache = { data: null, timestamp: 0 }
const CACHE_TTL = 5000 // 5 seconds - short TTL for real-time data

/**
 * Dispatch Repository class - extends DrizzleRepository for common CRUD
 */
class DrizzleDispatchRepository extends DrizzleRepository<
  typeof dispatchRecords,
  DispatchRecord,
  NewDispatchRecord
> {
  protected table = dispatchRecords
  protected idColumn = dispatchRecords.id

  /**
   * Invalidate cache - call after any mutation
   */
  invalidateCache(): void {
    dispatchCache.data = null
    dispatchCache.timestamp = 0
  }

  /**
   * Find all dispatch records with optional filters
   * Uses cache for unfiltered queries
   */
  async findAllWithFilters(filters?: DispatchFilters): Promise<DispatchRecord[]> {
    const database = this.getDb()
    const hasFilters = filters && Object.values(filters).some(v => v !== undefined)

    // For unfiltered queries, use cache
    if (!hasFilters) {
      const now = Date.now()
      if (dispatchCache.data && (now - dispatchCache.timestamp) < CACHE_TTL) {
        return dispatchCache.data
      }

      // Fetch and cache
      const records = await database
        .select()
        .from(dispatchRecords)
        .orderBy(desc(dispatchRecords.entryTime))

      dispatchCache.data = records
      dispatchCache.timestamp = now
      return records
    }

    // Filtered queries go directly to DB
    const conditions = []

    if (filters?.status) {
      conditions.push(eq(dispatchRecords.status, filters.status))
    }
    if (filters?.vehicleId) {
      conditions.push(eq(dispatchRecords.vehicleId, filters.vehicleId))
    }
    if (filters?.driverId) {
      conditions.push(eq(dispatchRecords.driverId, filters.driverId))
    }
    if (filters?.routeId) {
      conditions.push(eq(dispatchRecords.routeId, filters.routeId))
    }
    if (filters?.startDate) {
      conditions.push(gte(dispatchRecords.entryTime, new Date(filters.startDate)))
    }
    if (filters?.endDate) {
      conditions.push(lte(dispatchRecords.entryTime, new Date(filters.endDate)))
    }

    let query = database.select().from(dispatchRecords)

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query
    }

    return query.orderBy(desc(dispatchRecords.entryTime))
  }

  /**
   * Find dispatch records by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<DispatchRecord[]> {
    const database = this.getDb()

    return database
      .select()
      .from(dispatchRecords)
      .where(
        and(
          gte(dispatchRecords.entryTime, new Date(startDate)),
          lte(dispatchRecords.entryTime, new Date(endDate))
        )
      )
      .orderBy(desc(dispatchRecords.entryTime))
  }

  /**
   * Find dispatch records by vehicle plate number
   */
  async findByPlateNumber(plateNumber: string): Promise<DispatchRecord[]> {
    const database = this.getDb()

    return database
      .select()
      .from(dispatchRecords)
      .where(eq(dispatchRecords.vehiclePlateNumber, plateNumber))
      .orderBy(desc(dispatchRecords.entryTime))
  }

  /**
   * Find today's dispatch records
   */
  async findToday(): Promise<DispatchRecord[]> {
    const database = this.getDb()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return database
      .select()
      .from(dispatchRecords)
      .where(
        and(
          gte(dispatchRecords.entryTime, today),
          lte(dispatchRecords.entryTime, tomorrow)
        )
      )
      .orderBy(desc(dispatchRecords.entryTime))
  }

  /**
   * Update dispatch status - invalidates cache
   */
  async updateStatus(id: string, status: string, additionalData?: Partial<NewDispatchRecord>): Promise<DispatchRecord | null> {
    const database = this.getDb()

    const [result] = await database
      .update(dispatchRecords)
      .set({
        status,
        ...additionalData,
        updatedAt: new Date(),
      })
      .where(eq(dispatchRecords.id, id))
      .returning()

    // Invalidate cache after mutation
    this.invalidateCache()

    return result || null
  }

  /**
   * Count dispatch records by status
   */
  async countByStatus(status: string): Promise<number> {
    const database = this.getDb()

    const [result] = await database
      .select({ count: sql<number>`count(*)` })
      .from(dispatchRecords)
      .where(eq(dispatchRecords.status, status))

    return Number(result?.count || 0)
  }

  /**
   * Create dispatch record with transaction support - invalidates cache
   */
  async createWithTransaction<T>(
    data: NewDispatchRecord,
    callback?: (tx: NonNullable<typeof db>, dispatchId: string) => Promise<T>
  ): Promise<DispatchRecord> {
    const result = await withTransaction(async (tx) => {
      const [dispatch] = await tx
        .insert(dispatchRecords)
        .values(data)
        .returning()

      if (callback) {
        await callback(tx, dispatch.id)
      }

      return dispatch
    })

    // Invalidate cache after mutation
    this.invalidateCache()

    return result
  }

  /**
   * Override base create to invalidate cache
   */
  async create(data: NewDispatchRecord): Promise<DispatchRecord> {
    const result = await super.create(data)
    this.invalidateCache()
    return result
  }

  /**
   * Override base update to invalidate cache
   */
  async update(id: string, data: Partial<NewDispatchRecord>): Promise<DispatchRecord | null> {
    const result = await super.update(id, data)
    this.invalidateCache()
    return result
  }

  /**
   * Override base delete to invalidate cache
   */
  async delete(id: string): Promise<boolean> {
    const result = await super.delete(id)
    this.invalidateCache()
    return result
  }
}

// Export singleton instance
export const dispatchRepository = new DrizzleDispatchRepository()

// Re-export types
export type { DispatchRecord, NewDispatchRecord }
