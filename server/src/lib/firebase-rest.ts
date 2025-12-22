/**
 * Firebase REST API wrapper using Firebase Admin SDK
 * This provides authenticated access to Firebase Realtime Database
 */

import { firebaseDb } from '../config/database.js'

export class FirebaseREST {
  async get(path: string): Promise<any> {
    try {
      const snapshot = await firebaseDb.ref(path).once('value')
      return snapshot.val()
    } catch (error: any) {
      console.error(`[FirebaseREST] GET ${path} error:`, error.message)
      throw new Error(`Firebase error: ${error.message}`)
    }
  }

  async set(path: string, data: any): Promise<void> {
    try {
      await firebaseDb.ref(path).set(data)
    } catch (error: any) {
      console.error(`[FirebaseREST] SET ${path} error:`, error.message)
      throw new Error(`Firebase error: ${error.message}`)
    }
  }

  async update(path: string, data: any): Promise<void> {
    try {
      await firebaseDb.ref(path).update(data)
    } catch (error: any) {
      console.error(`[FirebaseREST] UPDATE ${path} error:`, error.message)
      throw new Error(`Firebase error: ${error.message}`)
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await firebaseDb.ref(path).remove()
    } catch (error: any) {
      console.error(`[FirebaseREST] REMOVE ${path} error:`, error.message)
      throw new Error(`Firebase error: ${error.message}`)
    }
  }
}

export const firebaseREST = new FirebaseREST()
