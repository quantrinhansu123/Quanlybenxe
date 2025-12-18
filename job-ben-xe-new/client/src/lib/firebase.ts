// Firebase REST API Client for direct data access
// This bypasses the backend and fetches data directly from Firebase

const FIREBASE_URL = 'https://webbenxe-default-rtdb.asia-southeast1.firebasedatabase.app'

export const firebaseClient = {
  // Get data from a path
  get: async <T>(path: string): Promise<T | null> => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${path}.json`)
      if (!response.ok) {
        throw new Error(`Firebase error: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Firebase GET ${path} error:`, error)
      return null
    }
  },

  // Get data as array (converts Firebase object to array)
  getAsArray: async <T>(path: string): Promise<T[]> => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${path}.json`)
      if (!response.ok) {
        throw new Error(`Firebase error: ${response.status}`)
      }
      const data = await response.json()
      if (!data) return []
      
      // Convert Firebase object to array
      return Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) as T[]
    } catch (error) {
      console.error(`Firebase GET ${path} error:`, error)
      return []
    }
  },

  // Set data at a path
  set: async <T>(path: string, data: T): Promise<boolean> => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return response.ok
    } catch (error) {
      console.error(`Firebase SET ${path} error:`, error)
      return false
    }
  },

  // Update data at a path (PATCH)
  update: async <T>(path: string, data: Partial<T>): Promise<boolean> => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return response.ok
    } catch (error) {
      console.error(`Firebase UPDATE ${path} error:`, error)
      return false
    }
  },

  // Push new data (creates new key)
  push: async <T>(path: string, data: T): Promise<string | null> => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.name // Firebase returns { name: "generated-key" }
    } catch (error) {
      console.error(`Firebase PUSH ${path} error:`, error)
      return null
    }
  },

  // Delete data at a path
  delete: async (path: string): Promise<boolean> => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'DELETE'
      })
      return response.ok
    } catch (error) {
      console.error(`Firebase DELETE ${path} error:`, error)
      return false
    }
  },

  // Generate unique ID
  generateId: (): string => {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 15)
    return `${timestamp}-${randomPart}`
  }
}

