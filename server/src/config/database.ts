import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getDatabase, Database } from 'firebase-admin/database'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config()

// Use RTDB_URL instead of FIREBASE_DATABASE_URL (reserved prefix in Firebase Functions)
const firebaseDatabaseURL = process.env.RTDB_URL || 'https://benxe-management-20251218-default-rtdb.asia-southeast1.firebasedatabase.app/'

let app: App | null = null
let db: Database | null = null
let initialized = false

// Lazy initialization function - only called when database is actually needed
function initializeFirebase(): Database {
  if (initialized && db) {
    return db
  }

  if (!getApps().length) {
    // Use SERVICE_ACCOUNT_PATH instead of FIREBASE_SERVICE_ACCOUNT_PATH (reserved prefix in Firebase Functions)
    const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH
    const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS

    try {
      if (serviceAccountPath) {
        const absolutePath = resolve(process.cwd(), serviceAccountPath)
        const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf-8'))
        app = initializeApp({
          credential: cert(serviceAccount),
          databaseURL: firebaseDatabaseURL
        })
      } else if (googleApplicationCredentials) {
        app = initializeApp({
          databaseURL: firebaseDatabaseURL
        })
      } else {
        app = initializeApp({
          databaseURL: firebaseDatabaseURL
        })
        console.warn('Firebase initialized without explicit credentials. Make sure you have:')
        console.warn('   1. Service account JSON file and set SERVICE_ACCOUNT_PATH, OR')
        console.warn('   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable, OR')
        console.warn('   3. Running on GCP/Firebase with default credentials')
      }
    } catch (error: any) {
      console.error('Firebase initialization error:', error)
      throw new Error(`Failed to initialize Firebase: ${error.message}. Please check RTDB_URL and authentication setup.`)
    }
  } else {
    app = getApps()[0]
  }

  if (!app) {
    throw new Error('Failed to initialize Firebase app')
  }

  db = getDatabase(app)
  initialized = true
  return db
}

// Getter for database instance (triggers lazy init)
function getDb(): Database {
  return initializeFirebase()
}

// Export database reference (lazy)
export { db }

// Helper functions to work with Firebase Realtime Database
export const firebaseDb = {
  ref: (path: string) => getDb().ref(path),

  get: async (path: string) => {
    const snapshot = await getDb().ref(path).once('value')
    return snapshot.val()
  },

  set: async (path: string, data: any) => {
    await getDb().ref(path).set(data)
    return data
  },

  update: async (path: string, data: any) => {
    await getDb().ref(path).update(data)
    return data
  },

  push: async (path: string, data: any) => {
    const ref = getDb().ref(path).push()
    await ref.set(data)
    return { key: ref.key, ...data }
  },

  remove: async (path: string) => {
    await getDb().ref(path).remove()
  },

  exists: async (path: string) => {
    const snapshot = await getDb().ref(path).once('value')
    return snapshot.exists()
  },

  query: (collection: string) => {
    return new FirebaseQuery(getDb().ref(collection), collection)
  }
}

// Firebase Query Builder - chainable API for Firebase Realtime Database
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

  select(fields?: string) {
    if (!fields || fields === '*') {
      this.selectFields = ['*']
    } else {
      this.selectFields = fields.split(',').map(f => f.trim())
    }
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
    const database = getDb()

    return new Promise(async (resolve, reject) => {
      try {
        // Handle INSERT
        if (this.insertData) {
          const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData]
          const results: any[] = []

          for (const item of dataArray) {
            const id = item.id || this.generateId()
            const dataWithId = { ...item, id }

            if (!dataWithId.created_at) {
              dataWithId.created_at = new Date().toISOString()
            }
            if (!dataWithId.updated_at) {
              dataWithId.updated_at = new Date().toISOString()
            }

            await database.ref(`${this.collection}/${id}`).set(dataWithId)
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
          const updateData = {
            ...this.updateData,
            updated_at: new Date().toISOString()
          }

          const snapshot = await this.ref.once('value')
          let allData = snapshot.val()

          if (!allData) {
            resolve({ data: null, error: { message: 'No records found' } })
            return
          }

          const records = Object.keys(allData).map(key => ({
            id: key,
            ...allData[key]
          }))

          const filteredRecords = this.applyFilters(records)

          if (filteredRecords.length === 0) {
            resolve({ data: null, error: { message: 'No records found' } })
            return
          }

          const updatedRecords: any[] = []
          for (const record of filteredRecords) {
            const updated = { ...record, ...updateData }
            await database.ref(`${this.collection}/${record.id}`).update(updateData)
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
          const snapshot = await this.ref.once('value')
          let allData = snapshot.val()

          if (!allData) {
            resolve({ data: null, error: null })
            return
          }

          const records = Object.keys(allData).map(key => ({
            id: key,
            ...allData[key]
          }))

          const filteredRecords = this.applyFilters(records)

          for (const record of filteredRecords) {
            await database.ref(`${this.collection}/${record.id}`).remove()
          }

          resolve({ data: null, error: null })
          return
        }

        // Handle SELECT (read)
        let queryRef: any = this.ref

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

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          data = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }))
        } else if (!data) {
          data = []
        }

        if (this.filters.length > 0 && Array.isArray(data)) {
          data = this.applyFilters(data)
        }

        if (this.selectFields && Array.isArray(data)) {
          data = data.map((item: any) => {
            if (this.selectFields!.some(f => f.includes(':'))) {
              return item
            }

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
          return result === target ? proxy : result
        }
      }
      return value
    }
  })
  return proxy
}

// Firebase query interface with chainable API
export const firebase = {
  from: (table: string) => {
    const query = firebaseDb.query(table)
    return createThenableQuery(query)
  },
  rpc: async (_functionName: string, _params?: any) => {
    return { data: null, error: { message: 'RPC not supported in Firebase Realtime Database' } }
  }
}
