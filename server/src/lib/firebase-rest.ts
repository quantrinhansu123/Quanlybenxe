import dotenv from 'dotenv'

dotenv.config()

// Use RTDB_URL instead of FIREBASE_DATABASE_URL (reserved prefix in Firebase Functions)
const RTDB_URL = process.env.RTDB_URL || 'https://benxe-management-20251218-default-rtdb.asia-southeast1.firebasedatabase.app/'
const baseUrl = RTDB_URL.replace(/\/$/, '')

export class FirebaseREST {
  async get(path: string): Promise<any> {
    const url = `${baseUrl}/${path}.json`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Firebase REST API error: ${response.status} ${response.statusText}`)
    }
    
    return await response.json()
  }

  async set(path: string, data: any): Promise<void> {
    const url = `${baseUrl}/${path}.json`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`Firebase REST API error: ${response.status} ${response.statusText}`)
    }
  }

  async update(path: string, data: any): Promise<void> {
    const url = `${baseUrl}/${path}.json`
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`Firebase REST API error: ${response.status} ${response.statusText}`)
    }
  }

  async remove(path: string): Promise<void> {
    const url = `${baseUrl}/${path}.json`
    const response = await fetch(url, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error(`Firebase REST API error: ${response.status} ${response.statusText}`)
    }
  }
}

export const firebaseREST = new FirebaseREST()
