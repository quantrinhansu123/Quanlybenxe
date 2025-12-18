/**
 * Timezone utilities for Vietnam (UTC+7)
 * 
 * This module handles timezone conversions to ensure dates are stored
 * and retrieved correctly in Vietnam timezone.
 */

const VIETNAM_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000 // 7 hours in milliseconds

/**
 * Convert UTC ISO string to Vietnam timezone and return as ISO string
 * This ensures the timestamp represents Vietnam time when stored in database
 * 
 * @param utcISOString - UTC ISO date string (e.g., "2024-12-25T07:30:00.000Z")
 * @returns ISO string representing Vietnam time (UTC+7)
 * 
 * @example
 * convertUTCToVietnam("2024-12-25T07:30:00.000Z")
 * // Returns: "2024-12-25T14:30:00.000Z" (VN time represented in UTC)
 */
export function convertUTCToVietnam(utcISOString: string): string {
  const utcDate = new Date(utcISOString)
  
  if (isNaN(utcDate.getTime())) {
    throw new Error(`Invalid UTC date string: ${utcISOString}`)
  }
  
  // Add 7 hours to get Vietnam time
  const vietnamTime = new Date(utcDate.getTime() + VIETNAM_TIMEZONE_OFFSET_MS)
  
  return vietnamTime.toISOString()
}

/**
 * Convert Vietnam time ISO string back to UTC ISO string
 * 
 * @param vietnamISOString - ISO date string representing Vietnam time
 * @returns UTC ISO date string
 * 
 * @example
 * convertVietnamToUTC("2024-12-25T14:30:00.000Z")
 * // Returns: "2024-12-25T07:30:00.000Z" (UTC)
 */
export function convertVietnamToUTC(vietnamISOString: string): string {
  const vietnamDate = new Date(vietnamISOString)
  
  if (isNaN(vietnamDate.getTime())) {
    throw new Error(`Invalid date string: ${vietnamISOString}`)
  }
  
  // Subtract 7 hours to get UTC
  const utcTime = new Date(vietnamDate.getTime() - VIETNAM_TIMEZONE_OFFSET_MS)
  
  return utcTime.toISOString()
}

/**
 * Convert Vietnam time ISO string (with +07:00) to UTC ISO string for database storage.
 * This preserves the Vietnam time value by storing it as UTC with +7 hours offset.
 * 
 * @param vietnamISOString - ISO string with +07:00 (e.g., "2024-12-25T14:30:00+07:00")
 * @returns UTC ISO string representing the same moment (e.g., "2024-12-25T07:30:00.000Z")
 * 
 * @example
 * convertVietnamISOToUTCForStorage("2024-12-25T14:30:00+07:00")
 * // Returns: "2024-12-25T14:30:00.000Z" (stored as UTC but represents VN time)
 */
export function convertVietnamISOToUTCForStorage(vietnamISOString: string): string {
  // Parse the Vietnam time string
  const date = new Date(vietnamISOString)
  
  // Get the UTC components (which represent Vietnam time after parsing)
  // When we parse "2024-12-25T14:30:00+07:00", JavaScript converts to UTC
  // So we need to add 7 hours back to preserve the Vietnam time value
  const vietnamTimeMs = date.getTime() + VIETNAM_TIMEZONE_OFFSET_MS
  const preservedDate = new Date(vietnamTimeMs)
  
  // Return as UTC ISO string (this represents Vietnam time stored as UTC+7)
  return preservedDate.toISOString()
}

/**
 * Get current time in Vietnam timezone as ISO string with +07:00 offset
 * 
 * @returns ISO string with +07:00 offset representing current Vietnam time
 * 
 * @example
 * getCurrentVietnamTime()
 * // Returns: "2024-12-25T14:30:00+07:00" (current Vietnam time)
 */
export function getCurrentVietnamTime(): string {
  const now = new Date()
  // Get current UTC time and add 7 hours
  const vietnamTimeMs = now.getTime() + VIETNAM_TIMEZONE_OFFSET_MS
  const vietnamDate = new Date(vietnamTimeMs)
  
  // Format as ISO string with +07:00 offset
  const year = vietnamDate.getUTCFullYear()
  const month = String(vietnamDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(vietnamDate.getUTCDate()).padStart(2, '0')
  const hours = String(vietnamDate.getUTCHours()).padStart(2, '0')
  const minutes = String(vietnamDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(vietnamDate.getUTCSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`
}

