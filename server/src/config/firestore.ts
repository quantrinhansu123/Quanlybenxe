/**
 * Cloud Firestore Configuration and Query Builder
 *
 * This module provides a Firestore client with a query builder API
 * that is compatible with the existing RTDB query interface.
 *
 * This allows for gradual migration from RTDB to Firestore without
 * changing the existing controller code.
 */

import { getFirestore, Firestore, CollectionReference, Query, WhereFilterOp } from 'firebase-admin/firestore'
import { getApps } from 'firebase-admin/app'

// Firestore instance
let firestoreDb: Firestore | null = null

// Initialize Firestore (uses same Firebase Admin app as RTDB)
function getFirestoreInstance(): Firestore {
  if (firestoreDb) return firestoreDb

  const apps = getApps()
  if (apps.length === 0) {
    throw new Error('Firebase Admin app not initialized. Please ensure database.ts is imported first.')
  }

  firestoreDb = getFirestore(apps[0])

  // Configure Firestore settings for better performance
  firestoreDb.settings({
    ignoreUndefinedProperties: true,
  })

  return firestoreDb
}

// Type definitions for query builder
interface FilterCondition {
  field: string
  operator: WhereFilterOp
  value: any
}

interface OrderByCondition {
  field: string
  direction: 'asc' | 'desc'
}

// Firestore Query Builder - chainable API compatible with RTDB interface
class FirestoreQuery {
  private collectionName: string
  private filters: FilterCondition[] = []
  private orderByConditions: OrderByCondition[] = []
  private limitCount?: number
  private selectFields?: string[]
  private isSingle: boolean = false
  private updateData?: Record<string, any>
  private insertData?: Record<string, any> | Record<string, any>[]
  private isDelete: boolean = false

  constructor(collectionName: string) {
    this.collectionName = collectionName
  }

  select(fields: string): this {
    // Parse fields like "*, origin:origin_id(id, name, code)"
    // Note: Firestore doesn't support field selection in queries,
    // but we store this for API compatibility (filtering happens client-side if needed)
    this.selectFields = fields.split(',').map(f => f.trim())
    return this
  }

  // Getter for selectFields (used for compatibility checks)
  getSelectFields(): string[] | undefined {
    return this.selectFields
  }

  eq(field: string, value: any): this {
    this.filters.push({ field, operator: '==', value })
    return this
  }

  neq(field: string, value: any): this {
    this.filters.push({ field, operator: '!=', value })
    return this
  }

  gt(field: string, value: any): this {
    this.filters.push({ field, operator: '>', value })
    return this
  }

  gte(field: string, value: any): this {
    this.filters.push({ field, operator: '>=', value })
    return this
  }

  lt(field: string, value: any): this {
    this.filters.push({ field, operator: '<', value })
    return this
  }

  lte(field: string, value: any): this {
    this.filters.push({ field, operator: '<=', value })
    return this
  }

  in(field: string, values: any[]): this {
    if (values.length === 0) {
      // Empty array - return no results by using impossible condition
      this.filters.push({ field: '__impossible__', operator: '==', value: '__never_match__' })
    } else if (values.length <= 30) {
      // Firestore supports up to 30 values in 'in' query
      this.filters.push({ field, operator: 'in', value: values })
    } else {
      // For more than 30 values, we'll need to handle in execute()
      this.filters.push({ field, operator: 'in', value: values })
    }
    return this
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderByConditions.push({
      field,
      direction: options?.ascending === false ? 'desc' : 'asc'
    })
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  single(): this {
    this.limitCount = 1
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

  async execute(): Promise<{ data: any; error: any }> {
    try {
      const db = getFirestoreInstance()
      const collectionRef = db.collection(this.collectionName)

      // Handle INSERT
      if (this.insertData) {
        return await this.executeInsert(collectionRef)
      }

      // Handle UPDATE
      if (this.updateData) {
        return await this.executeUpdate(db, collectionRef)
      }

      // Handle DELETE
      if (this.isDelete) {
        return await this.executeDelete(db, collectionRef)
      }

      // Handle SELECT (read)
      return await this.executeSelect(collectionRef)
    } catch (error: any) {
      console.error(`Firestore query error on ${this.collectionName}:`, error)
      return { data: null, error: { message: error.message, code: error.code } }
    }
  }

  private async executeInsert(collectionRef: CollectionReference): Promise<{ data: any; error: any }> {
    const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData!]
    const results: any[] = []

    for (const item of dataArray) {
      // Generate ID if not provided
      const id = item.id || collectionRef.doc().id
      const dataWithId = { ...item, id }

      // Add timestamps if not present
      const now = new Date().toISOString()
      if (!dataWithId.created_at) {
        dataWithId.created_at = now
      }
      if (!dataWithId.updated_at) {
        dataWithId.updated_at = now
      }

      // Write to Firestore
      await collectionRef.doc(id).set(dataWithId)
      results.push(dataWithId)
    }

    return {
      data: Array.isArray(this.insertData) ? results : results[0],
      error: null
    }
  }

  private async executeUpdate(db: Firestore, collectionRef: CollectionReference): Promise<{ data: any; error: any }> {
    // Add updated_at timestamp
    const updateData = {
      ...this.updateData,
      updated_at: new Date().toISOString()
    }

    // Build query with filters
    let query: Query = collectionRef

    for (const filter of this.filters) {
      if (filter.field === '__impossible__') {
        // No documents to update
        return { data: null, error: { message: 'No records found' } }
      }
      query = query.where(filter.field, filter.operator, filter.value)
    }

    // Get matching documents
    const snapshot = await query.get()

    if (snapshot.empty) {
      return { data: null, error: { message: 'No records found' } }
    }

    // Update each document
    const batch = db.batch()
    const updatedRecords: any[] = []

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, updateData)
      updatedRecords.push({ id: doc.id, ...doc.data(), ...updateData })
    })

    await batch.commit()

    return {
      data: this.isSingle ? updatedRecords[0] : updatedRecords,
      error: null
    }
  }

  private async executeDelete(db: Firestore, collectionRef: CollectionReference): Promise<{ data: any; error: any }> {
    // Build query with filters
    let query: Query = collectionRef

    for (const filter of this.filters) {
      if (filter.field === '__impossible__') {
        // No documents to delete
        return { data: null, error: null }
      }
      query = query.where(filter.field, filter.operator, filter.value)
    }

    // Get matching documents
    const snapshot = await query.get()

    if (snapshot.empty) {
      return { data: null, error: null }
    }

    // Delete in batch
    const batch = db.batch()
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })

    await batch.commit()

    return { data: null, error: null }
  }

  private async executeSelect(collectionRef: CollectionReference): Promise<{ data: any; error: any }> {
    // Check for large 'in' queries that need chunking
    const largeInFilter = this.filters.find(f => f.operator === 'in' && Array.isArray(f.value) && f.value.length > 30)

    if (largeInFilter) {
      return await this.executeChunkedSelect(collectionRef, largeInFilter)
    }

    // Build query
    let query: Query = collectionRef

    // Apply filters
    for (const filter of this.filters) {
      if (filter.field === '__impossible__') {
        return { data: this.isSingle ? null : [], error: this.isSingle ? { message: 'Not found' } : null }
      }
      query = query.where(filter.field, filter.operator, filter.value)
    }

    // Apply ordering
    for (const orderBy of this.orderByConditions) {
      query = query.orderBy(orderBy.field, orderBy.direction)
    }

    // Apply limit
    if (this.limitCount) {
      query = query.limit(this.limitCount)
    }

    // Execute query
    const snapshot = await query.get()

    // Transform results
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Handle single()
    if (this.isSingle) {
      return {
        data: data[0] || null,
        error: data[0] ? null : { message: 'Not found' }
      }
    }

    return { data, error: null }
  }

  private async executeChunkedSelect(
    collectionRef: CollectionReference,
    largeInFilter: FilterCondition
  ): Promise<{ data: any; error: any }> {
    const values = largeInFilter.value as any[]
    const chunks: any[][] = []

    // Split into chunks of 30 (Firestore limit)
    for (let i = 0; i < values.length; i += 30) {
      chunks.push(values.slice(i, i + 30))
    }

    // Execute queries for each chunk in parallel
    const results = await Promise.all(
      chunks.map(async chunk => {
        let query: Query = collectionRef

        // Apply the chunked 'in' filter
        query = query.where(largeInFilter.field, 'in', chunk)

        // Apply other filters
        for (const filter of this.filters) {
          if (filter !== largeInFilter && filter.field !== '__impossible__') {
            query = query.where(filter.field, filter.operator, filter.value)
          }
        }

        // Apply ordering
        for (const orderBy of this.orderByConditions) {
          query = query.orderBy(orderBy.field, orderBy.direction)
        }

        const snapshot = await query.get()
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      })
    )

    // Flatten results
    let data = results.flat()

    // Apply client-side sorting if we had to chunk (since each chunk is sorted independently)
    if (this.orderByConditions.length > 0) {
      data.sort((a, b) => {
        for (const orderBy of this.orderByConditions) {
          const aVal = (a as any)[orderBy.field]
          const bVal = (b as any)[orderBy.field]

          if (aVal < bVal) return orderBy.direction === 'asc' ? -1 : 1
          if (aVal > bVal) return orderBy.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    // Apply limit after merging
    if (this.limitCount) {
      data = data.slice(0, this.limitCount)
    }

    // Handle single()
    if (this.isSingle) {
      return {
        data: data[0] || null,
        error: data[0] ? null : { message: 'Not found' }
      }
    }

    return { data, error: null }
  }
}

// Create a thenable query builder (allows async/await without explicit execute())
function createThenableQuery(query: FirestoreQuery): any {
  const proxy = new Proxy(query, {
    get(target: FirestoreQuery, prop: string) {
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
 * Firestore client with chainable query builder
 * API compatible with existing RTDB interface (firebase.from())
 */
export const firestore = {
  from: (collection: string) => {
    const query = new FirestoreQuery(collection)
    return createThenableQuery(query)
  },

  // Direct Firestore access for advanced operations
  db: () => getFirestoreInstance(),

  // Batch operations
  batch: () => getFirestoreInstance().batch(),

  // Transaction support
  runTransaction: <T>(fn: (transaction: FirebaseFirestore.Transaction) => Promise<T>) => {
    return getFirestoreInstance().runTransaction(fn)
  },

  // RPC placeholder (for compatibility)
  rpc: async (_functionName: string, _params?: any) => {
    return { data: null, error: { message: 'RPC not supported directly. Use Cloud Functions instead.' } }
  }
}

// Export Firestore instance getter for advanced use cases
export { getFirestoreInstance }

// Type exports for use in other files
export type { FilterCondition, OrderByCondition }
