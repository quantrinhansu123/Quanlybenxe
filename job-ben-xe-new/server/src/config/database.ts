import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getDatabase, Database } from 'firebase-admin/database'
import dotenv from 'dotenv'

dotenv.config()

const firebaseDatabaseURL = process.env.FIREBASE_DATABASE_URL || 'https://webbenxe-default-rtdb.asia-southeast1.firebasedatabase.app/'

let app: App | null = null
let db: Database | null = null

// Initialize Firebase Admin
if (!getApps().length) {
  // For Firebase Realtime Database, we can use service account or environment credentials
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
  
  try {
    if (serviceAccountPath) {
      // If service account JSON file path is provided
      const serviceAccount = require(serviceAccountPath)
      app = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: firebaseDatabaseURL
      })
    } else if (googleApplicationCredentials) {
      // Use GOOGLE_APPLICATION_CREDENTIALS environment variable
      app = initializeApp({
        databaseURL: firebaseDatabaseURL
      })
    } else {
      // Try to initialize with default credentials (if running on GCP or with gcloud auth)
      // For local development, you may need to set up service account
      app = initializeApp({
        databaseURL: firebaseDatabaseURL
      })
      console.warn('⚠️  Firebase initialized without explicit credentials. Make sure you have:')
      console.warn('   1. Service account JSON file and set FIREBASE_SERVICE_ACCOUNT_PATH, OR')
      console.warn('   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable, OR')
      console.warn('   3. Running on GCP with default credentials')
    }
  } catch (error: any) {
    console.error('Firebase initialization error:', error)
    throw new Error(`Failed to initialize Firebase: ${error.message}. Please check FIREBASE_DATABASE_URL and authentication setup.`)
  }
} else {
  app = getApps()[0]
}

if (!app) {
  throw new Error('Failed to initialize Firebase app')
}

db = getDatabase(app)

// Export database reference
export { db }

// Helper functions to work with Firebase Realtime Database
export const firebaseDb = {
  // Get reference to a path
  ref: (path: string) => db!.ref(path),
  
  // Get data from a path
  get: async (path: string) => {
    const snapshot = await db!.ref(path).once('value')
    return snapshot.val()
  },
  
  // Set data at a path
  set: async (path: string, data: any) => {
    await db!.ref(path).set(data)
    return data
  },
  
  // Update data at a path
  update: async (path: string, data: any) => {
    await db!.ref(path).update(data)
    return data
  },
  
  // Push data to a path (creates new key)
  push: async (path: string, data: any) => {
    const ref = db!.ref(path).push()
    await ref.set(data)
    return { key: ref.key, ...data }
  },
  
  // Remove data at a path
  remove: async (path: string) => {
    await db!.ref(path).remove()
  },
  
  // Check if path exists
  exists: async (path: string) => {
    const snapshot = await db!.ref(path).once('value')
    return snapshot.exists()
  },
  
  // Query helpers (simulating Supabase-like queries)
  query: (collection: string) => {
    return new FirebaseQuery(db!.ref(collection), collection)
  }
}

// Firebase Query Builder (similar to Supabase query builder)
class FirebaseQuery {
  private ref: any
  private collection: string
  private filters: Array<{ field: string; operator: string; value: any }> = []
  private orderByField?: string
  private orderByDirection: 'asc' | 'desc' = 'asc'
  private limitCount?: number
  private selectFields?: string[]
  private isSingle: boolean = false
  private updateData?: any
  private insertData?: any | any[]
  private isDelete: boolean = false

  constructor(ref: any, collection: string) {
    this.ref = ref
    this.collection = collection
  }

  select(fields: string) {
    this.selectFields = fields.split(',').map(f => f.trim())
    return this
  }

  eq(field: string, value: any) {
    this.filters.push({ field, operator: '==', value })
    return this
  }

  neq(field: string, value: any) {
    this.filters.push({ field, operator: '!=', value })
    return this
  }

  gt(field: string, value: any) {
    this.filters.push({ field, operator: '>', value })
    return this
  }

  gte(field: string, value: any) {
    this.filters.push({ field, operator: '>=', value })
    return this
  }

  lt(field: string, value: any) {
    this.filters.push({ field, operator: '<', value })
    return this
  }

  lte(field: string, value: any) {
    this.filters.push({ field, operator: '<=', value })
    return this
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, operator: 'in', value: values })
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderByField = field
    this.orderByDirection = options?.ascending === false ? 'desc' : 'asc'
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.limitCount = 1
    this.isSingle = true
    return this
  }

  insert(data: any | any[]) {
    this.insertData = data
    return this
  }

  update(data: any) {
    this.updateData = data
    return this
  }

  delete() {
    this.isDelete = true
    return this
  }

  async execute() {
    return new Promise(async (resolve, reject) => {
      try {
        // Handle INSERT
        if (this.insertData) {
          const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData]
          const results: any[] = []
          
          for (const item of dataArray) {
            // Generate ID if not provided
            const id = item.id || this.generateId()
            const dataWithId = { ...item, id }
            
            // Add timestamps if not present
            if (!dataWithId.created_at) {
              dataWithId.created_at = new Date().toISOString()
            }
            if (!dataWithId.updated_at) {
              dataWithId.updated_at = new Date().toISOString()
            }
            
            await db!.ref(`${this.collection}/${id}`).set(dataWithId)
            results.push(dataWithId)
          }
          
          resolve({ 
            data: Array.isArray(this.insertData) ? results : results[0], 
            error: null 
          })
          return
        }

        // Handle UPDATE
        if (this.updateData) {
          // Add updated_at timestamp
          const updateData = {
            ...this.updateData,
            updated_at: new Date().toISOString()
          }
          
          // Find records matching filters
          const snapshot = await this.ref.once('value')
          let allData = snapshot.val()
          
          if (!allData) {
            resolve({ data: null, error: { message: 'No records found' } })
            return
          }
          
          // Convert to array
          const records = Object.keys(allData).map(key => ({
            id: key,
            ...allData[key]
          }))
          
          // Apply filters
          const filteredRecords = this.applyFilters(records)
          
          if (filteredRecords.length === 0) {
            resolve({ data: null, error: { message: 'No records found' } })
            return
          }
          
          // Update each matching record
          const updatedRecords: any[] = []
          for (const record of filteredRecords) {
            const updated = { ...record, ...updateData }
            await db!.ref(`${this.collection}/${record.id}`).update(updateData)
            updatedRecords.push(updated)
          }
          
          resolve({ 
            data: this.isSingle ? updatedRecords[0] : updatedRecords, 
            error: null 
          })
          return
        }

        // Handle DELETE
        if (this.isDelete) {
          // Find records matching filters
          const snapshot = await this.ref.once('value')
          let allData = snapshot.val()
          
          if (!allData) {
            resolve({ data: null, error: null })
            return
          }
          
          // Convert to array
          const records = Object.keys(allData).map(key => ({
            id: key,
            ...allData[key]
          }))
          
          // Apply filters
          const filteredRecords = this.applyFilters(records)
          
          // Delete each matching record
          for (const record of filteredRecords) {
            await db!.ref(`${this.collection}/${record.id}`).remove()
          }
          
          resolve({ data: null, error: null })
          return
        }

        // Handle SELECT (read)
        let queryRef: any = this.ref

        // Apply ordering
        if (this.orderByField) {
          queryRef = queryRef.orderByChild(this.orderByField)
          if (this.orderByDirection === 'desc') {
            queryRef = queryRef.limitToLast(this.limitCount || 1000)
          } else {
            queryRef = queryRef.limitToFirst(this.limitCount || 1000)
          }
        } else if (this.limitCount) {
          queryRef = queryRef.limitToFirst(this.limitCount)
        }

        const snapshot = await queryRef.once('value')
        let data = snapshot.val()

        // Convert to array if object
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          data = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }))
        } else if (!data) {
          data = []
        }

        // Apply filters (client-side filtering for complex queries)
        if (this.filters.length > 0 && Array.isArray(data)) {
          data = this.applyFilters(data)
        }

        // Apply field selection
        if (this.selectFields && Array.isArray(data)) {
          data = data.map((item: any) => {
            // Handle nested fields like "operators:operator_id(id, name)"
            if (this.selectFields!.some(f => f.includes(':'))) {
              // For nested queries, we'll need to fetch related data
              // For now, return all fields and handle nesting in controllers
              return item
            }
            
            // Handle wildcard
            if (this.selectFields!.includes('*')) {
              return item
            }
            
            const selected: any = { id: item.id }
            this.selectFields!.forEach(field => {
              if (item.hasOwnProperty(field)) {
                selected[field] = item[field]
              }
            })
            return selected
          })
        }

        // If single() was called, return single object or null
        if (this.isSingle && Array.isArray(data)) {
          resolve({ data: data[0] || null, error: data[0] ? null : { message: 'Not found' } })
        } else {
          resolve({ data, error: null })
        }
      } catch (error: any) {
        reject({ data: null, error })
      }
    })
  }

  private applyFilters(data: any[]) {
    if (this.filters.length === 0) return data
    
    return data.filter((item: any) => {
      return this.filters.every(filter => {
        const fieldValue = item[filter.field]
        switch (filter.operator) {
          case '==':
            return fieldValue === filter.value
          case '!=':
            return fieldValue !== filter.value
          case '>':
            return fieldValue > filter.value
          case '>=':
            return fieldValue >= filter.value
          case '<':
            return fieldValue < filter.value
          case '<=':
            return fieldValue <= filter.value
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(fieldValue)
          default:
            return true
        }
      })
    })
  }

  private generateId(): string {
    // Generate a unique ID using timestamp and random string
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 15)
    return `${timestamp}-${randomPart}`
  }
}

// Create a thenable query builder that proxies all methods
function createThenableQuery(query: FirebaseQuery): any {
  const proxy = new Proxy(query, {
    get(target: FirebaseQuery, prop: string) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (onResolve: any, onReject?: any) => {
          return target.execute().then(onResolve, onReject)
        }
      }
      const value = (target as any)[prop]
      if (typeof value === 'function') {
        return function(...args: any[]) {
          const result = value.apply(target, args)
          // If method returns the query instance, return the proxy for chaining
          return result === target ? proxy : result
        }
      }
      return value
    }
  })
  return proxy
}

// For backward compatibility, export a supabase-like interface
export const supabase = {
  from: (table: string) => {
    const query = firebaseDb.query(table)
    return createThenableQuery(query)
  },
  rpc: async (_functionName: string, _params?: any) => {
    // RPC functions not supported in Realtime Database
    return { data: null, error: { message: 'RPC not supported in Firebase Realtime Database' } }
  }
}

// Export for backward compatibility
export const supabaseAnon = supabase
