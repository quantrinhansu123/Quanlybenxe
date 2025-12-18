/**
 * Dual-Write Module for Gradual Migration
 *
 * This module enables writing to both RTDB and Firestore simultaneously
 * during the gradual migration phase. This ensures data consistency
 * and allows for safe rollback if needed.
 *
 * Configuration via environment variables:
 * - DUAL_WRITE_ENABLED: Enable/disable dual-write (default: false)
 * - PRIMARY_DATABASE: 'rtdb' or 'firestore' (default: 'rtdb')
 * - FIRESTORE_WRITE_ENABLED: Enable writing to Firestore (default: false)
 *
 * Usage:
 * 1. Start with PRIMARY_DATABASE=rtdb, FIRESTORE_WRITE_ENABLED=true
 * 2. Run migration script to copy existing data
 * 3. Enable DUAL_WRITE_ENABLED=true
 * 4. Verify data consistency
 * 5. Switch PRIMARY_DATABASE=firestore
 * 6. Disable DUAL_WRITE_ENABLED when confident
 */

import { firebase as rtdbClient, firebaseDb } from './database.js'
import { firestore as firestoreClient, getFirestoreInstance } from './firestore.js'

// Configuration
interface DualWriteConfig {
  enabled: boolean
  primaryDatabase: 'rtdb' | 'firestore'
  firestoreWriteEnabled: boolean
}

// Get configuration from environment
function getConfig(): DualWriteConfig {
  return {
    enabled: process.env.DUAL_WRITE_ENABLED === 'true',
    primaryDatabase: (process.env.PRIMARY_DATABASE as 'rtdb' | 'firestore') || 'rtdb',
    firestoreWriteEnabled: process.env.FIRESTORE_WRITE_ENABLED === 'true',
  }
}

// Log configuration on startup
const config = getConfig()
console.log(`[Dual-Write] Configuration:`)
console.log(`  - Enabled: ${config.enabled}`)
console.log(`  - Primary: ${config.primaryDatabase}`)
console.log(`  - Firestore Write: ${config.firestoreWriteEnabled}`)

// Error tracking for dual-write failures
interface WriteError {
  database: 'rtdb' | 'firestore'
  collection: string
  operation: string
  error: string
  timestamp: string
}

const writeErrors: WriteError[] = []

function logWriteError(db: 'rtdb' | 'firestore', collection: string, operation: string, error: any) {
  const writeError: WriteError = {
    database: db,
    collection,
    operation,
    error: error.message || String(error),
    timestamp: new Date().toISOString(),
  }
  writeErrors.push(writeError)
  console.error(`[Dual-Write] ${db} error on ${collection}.${operation}: ${writeError.error}`)

  // Keep only last 100 errors
  if (writeErrors.length > 100) {
    writeErrors.shift()
  }
}

// Get write errors for monitoring
export function getWriteErrors(): WriteError[] {
  return [...writeErrors]
}

// Clear write errors
export function clearWriteErrors(): void {
  writeErrors.length = 0
}

// Dual-write query builder
class DualWriteQuery {
  private collectionName: string
  private filters: Array<{ method: string; args: any[] }> = []
  private orderByData?: { field: string; options?: { ascending?: boolean } }
  private limitCount?: number
  private selectFieldsStr?: string
  private isSingle: boolean = false
  private updateData?: Record<string, any>
  private insertData?: Record<string, any> | Record<string, any>[]
  private isDelete: boolean = false

  constructor(collectionName: string) {
    this.collectionName = collectionName
  }

  select(fields: string): this {
    this.selectFieldsStr = fields
    return this
  }

  eq(field: string, value: any): this {
    this.filters.push({ method: 'eq', args: [field, value] })
    return this
  }

  neq(field: string, value: any): this {
    this.filters.push({ method: 'neq', args: [field, value] })
    return this
  }

  gt(field: string, value: any): this {
    this.filters.push({ method: 'gt', args: [field, value] })
    return this
  }

  gte(field: string, value: any): this {
    this.filters.push({ method: 'gte', args: [field, value] })
    return this
  }

  lt(field: string, value: any): this {
    this.filters.push({ method: 'lt', args: [field, value] })
    return this
  }

  lte(field: string, value: any): this {
    this.filters.push({ method: 'lte', args: [field, value] })
    return this
  }

  in(field: string, values: any[]): this {
    this.filters.push({ method: 'in', args: [field, values] })
    return this
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderByData = { field, options }
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  single(): this {
    this.isSingle = true
    return this
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this.insertData = data
    return this
  }

  update(data: Record<string, any>): this {
    this.updateData = data
    return this
  }

  delete(): this {
    this.isDelete = true
    return this
  }

  // Build query for a specific database
  private buildQuery(db: 'rtdb' | 'firestore') {
    const client = db === 'rtdb' ? rtdbClient : firestoreClient
    let query = client.from(this.collectionName)

    if (this.selectFieldsStr) {
      query = query.select(this.selectFieldsStr)
    }

    for (const filter of this.filters) {
      query = (query as any)[filter.method](...filter.args)
    }

    if (this.orderByData) {
      query = query.order(this.orderByData.field, this.orderByData.options)
    }

    if (this.limitCount) {
      query = query.limit(this.limitCount)
    }

    if (this.isSingle) {
      query = query.single()
    }

    if (this.insertData) {
      query = query.insert(this.insertData)
    }

    if (this.updateData) {
      query = query.update(this.updateData)
    }

    if (this.isDelete) {
      query = query.delete()
    }

    return query
  }

  async execute(): Promise<{ data: any; error: any }> {
    const cfg = getConfig()
    const isWrite = this.insertData || this.updateData || this.isDelete
    const operation = this.insertData ? 'insert' : this.updateData ? 'update' : this.isDelete ? 'delete' : 'select'

    // For read operations, use primary database only
    if (!isWrite) {
      try {
        const result = await this.buildQuery(cfg.primaryDatabase)
        return result
      } catch (error: any) {
        return { data: null, error: { message: error.message } }
      }
    }

    // For write operations
    let primaryResult: { data: any; error: any } = { data: null, error: null }
    let secondaryResult: { data: any; error: any } = { data: null, error: null }

    // Write to primary database
    try {
      primaryResult = await this.buildQuery(cfg.primaryDatabase)
    } catch (error: any) {
      logWriteError(cfg.primaryDatabase, this.collectionName, operation, error)
      return { data: null, error: { message: error.message } }
    }

    // If primary failed, don't write to secondary
    if (primaryResult.error) {
      return primaryResult
    }

    // Write to secondary database if dual-write is enabled
    const secondaryDb = cfg.primaryDatabase === 'rtdb' ? 'firestore' : 'rtdb'
    const shouldWriteSecondary = cfg.enabled || (secondaryDb === 'firestore' && cfg.firestoreWriteEnabled)

    if (shouldWriteSecondary) {
      try {
        secondaryResult = await this.buildQuery(secondaryDb)
        if (secondaryResult.error) {
          logWriteError(secondaryDb, this.collectionName, operation, secondaryResult.error)
        }
      } catch (error: any) {
        logWriteError(secondaryDb, this.collectionName, operation, error)
        // Don't fail the operation if secondary write fails
        // The primary write succeeded
      }
    }

    return primaryResult
  }
}

// Create thenable query builder
function createThenableQuery(query: DualWriteQuery): any {
  const proxy = new Proxy(query, {
    get(target: DualWriteQuery, prop: string) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (onResolve: any, onReject?: any) => {
          return target.execute().then(onResolve, onReject)
        }
      }
      const value = (target as any)[prop]
      if (typeof value === 'function') {
        return function(...args: any[]) {
          const result = value.apply(target, args)
          return result === target ? proxy : result
        }
      }
      return value
    }
  })
  return proxy
}

/**
 * Dual-write database client
 * API compatible with both firebase and firestore clients
 */
export const dualWrite = {
  from: (collection: string) => {
    const query = new DualWriteQuery(collection)
    return createThenableQuery(query)
  },

  // RPC placeholder
  rpc: async (_functionName: string, _params?: any) => {
    return { data: null, error: { message: 'RPC not supported in dual-write mode' } }
  },

  // Get current configuration
  getConfig,

  // Check if dual-write is enabled
  isEnabled: () => getConfig().enabled,

  // Get primary database
  getPrimary: () => getConfig().primaryDatabase,

  // Get write errors
  getErrors: getWriteErrors,

  // Clear errors
  clearErrors: clearWriteErrors,
}

/**
 * Utility to compare data between RTDB and Firestore
 * Useful for verifying data consistency during migration
 */
export async function compareCollectionData(collectionName: string): Promise<{
  rtdbCount: number
  firestoreCount: number
  matched: number
  missingInFirestore: string[]
  missingInRtdb: string[]
}> {
  const result = {
    rtdbCount: 0,
    firestoreCount: 0,
    matched: 0,
    missingInFirestore: [] as string[],
    missingInRtdb: [] as string[],
  }

  try {
    // Get RTDB data
    const rtdbData = await firebaseDb.get(collectionName)
    const rtdbIds = rtdbData ? Object.keys(rtdbData) : []
    result.rtdbCount = rtdbIds.length

    // Get Firestore data
    const firestoreDb = getFirestoreInstance()
    const firestoreSnapshot = await firestoreDb.collection(collectionName).get()
    const firestoreIds = firestoreSnapshot.docs.map(doc => doc.id)
    result.firestoreCount = firestoreIds.length

    // Compare
    const rtdbSet = new Set(rtdbIds)
    const firestoreSet = new Set(firestoreIds)

    for (const id of rtdbIds) {
      if (firestoreSet.has(id)) {
        result.matched++
      } else {
        result.missingInFirestore.push(id)
      }
    }

    for (const id of firestoreIds) {
      if (!rtdbSet.has(id)) {
        result.missingInRtdb.push(id)
      }
    }
  } catch (error) {
    console.error(`Error comparing ${collectionName}:`, error)
  }

  return result
}

/**
 * Utility to sync a single document from RTDB to Firestore
 */
export async function syncDocumentToFirestore(collectionName: string, documentId: string): Promise<boolean> {
  try {
    const rtdbData = await firebaseDb.get(`${collectionName}/${documentId}`)
    if (!rtdbData) {
      console.log(`Document ${documentId} not found in RTDB`)
      return false
    }

    const firestoreDb = getFirestoreInstance()
    await firestoreDb.collection(collectionName).doc(documentId).set({
      id: documentId,
      ...rtdbData,
    })

    console.log(`Synced ${collectionName}/${documentId} to Firestore`)
    return true
  } catch (error) {
    console.error(`Error syncing ${collectionName}/${documentId}:`, error)
    return false
  }
}

// Export for direct RTDB access when needed
export { rtdbClient as rtdb, firestoreClient as fs }
