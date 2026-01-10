/**
 * Drizzle Database Client
 * Connects to Supabase PostgreSQL using connection pooling
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Connection string from environment
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn('[Drizzle] DATABASE_URL not set. Supabase features will be unavailable.')
}

// Create postgres client with connection pooling config
// Note: For Supabase, use the connection pooler URL (port 6543) for better performance
const client = connectionString
  ? postgres(connectionString, {
      max: 10, // Maximum connections in pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
      prepare: false, // Required for Supabase Transaction Mode
    })
  : null

// Create drizzle instance with schema for type inference
export const db = client ? drizzle(client, { schema }) : null

// Export type for use in repositories
export type Database = typeof db

/**
 * Test database connection
 * Call this on startup to verify configuration
 */
export async function testDrizzleConnection(): Promise<boolean> {
  if (!db) {
    console.error('[Drizzle] Database client not initialized. Check DATABASE_URL.')
    return false
  }

  try {
    // Simple query to test connection
    const result = await db.execute('SELECT NOW() as current_time')
    console.log('[Drizzle] Connection test: SUCCESS at', result[0]?.current_time)
    return true
  } catch (error: unknown) {
    console.error('[Drizzle] Connection test: FAILED -', error)
    return false
  }
}

/**
 * Gracefully close database connection
 * Call this on server shutdown
 */
export async function closeDrizzleConnection(): Promise<void> {
  if (client) {
    await client.end()
    console.log('[Drizzle] Database connection closed.')
  }
}
