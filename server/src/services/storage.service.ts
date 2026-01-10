/**
 * Supabase Storage Service
 * Handles file uploads to Supabase Storage
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('[Storage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    }
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  }
  return supabase
}

const BUCKET_NAME = 'dispatch-images'

export const storageService = {
  /**
   * Upload file to Supabase Storage
   * @param file - Express Multer file object
   * @param folder - Subfolder within bucket (default: 'entries')
   * @returns Public URL of uploaded file
   */
  async upload(
    file: Express.Multer.File,
    folder: string = 'entries'
  ): Promise<string> {
    const client = getSupabaseClient()
    const timestamp = Date.now()
    const ext = file.originalname.split('.').pop() || 'jpg'
    const randomStr = Math.random().toString(36).substring(7)
    const fileName = `${folder}/${timestamp}-${randomStr}.${ext}`

    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('[Storage] Upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Return public URL
    const { data: urlData } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  },

  /**
   * Delete file from Supabase Storage
   * @param fileUrl - Public URL of file to delete
   */
  async delete(fileUrl: string): Promise<void> {
    const client = getSupabaseClient()

    // Extract path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/dispatch-images/entries/xxx.jpg
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`)
    const filePath = pathParts[1]

    if (!filePath) {
      console.warn('[Storage] Could not extract file path from URL:', fileUrl)
      return
    }

    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error('[Storage] Delete error:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  },

  /**
   * Check if file exists in storage
   * @param filePath - Path within bucket
   */
  async exists(filePath: string): Promise<boolean> {
    const client = getSupabaseClient()
    const folder = filePath.split('/').slice(0, -1).join('/')
    const fileName = filePath.split('/').pop()

    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .list(folder, {
        search: fileName,
      })

    if (error) return false
    return data.length > 0
  },
}
